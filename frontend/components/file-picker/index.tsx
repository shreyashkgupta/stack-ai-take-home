"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useConnectionResources, useResourceSelection, usePrefetchResources, useIndexingStatus } from '@/lib/hooks';
import { Resource } from '@/types/api';
import { FileTable } from './file-table';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Loader2, 
  AlertCircle, 
  FolderOpen,
  Check,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { 
  getConnectionResources,
  getKnowledgeBaseResources, 
  createAndSyncKnowledgeBase, 
  removeResourceFromKnowledgeBase,
  removeResourcesFromKnowledgeBase,
  addResourcesToKnowledgeBase,
  getKnowledgeBaseResourceStatus,
  getKnowledgeBaseStatus
} from '@/lib/api';
import Image from "next/image";

// Extended resource type with hierarchy info
export interface HierarchicalResource extends Resource {
  depth: number;
  isExpanded?: boolean;
  parentId?: string;
}

export interface FilePickerProps {
  connectionId: string;
  knowledgeBaseId?: string;
  orgId: string;
  onCreateKnowledgeBase?: (knowledgeBase: Record<string, unknown>) => void;
  className?: string;
}

export function FilePicker({
  connectionId,
  knowledgeBaseId,
  orgId,
  onCreateKnowledgeBase,
  className,
}: FilePickerProps) {
  // State for expanded folders
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  
  // State for loaded folder contents
  const [folderContents, setFolderContents] = useState<Record<string, Resource[]>>({});
  
  // State for loading folders
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  
  // Selection hooks
  const { 
    selectedResources, 
    toggleSelection,  
    clearSelection, 
    getSelectedIds,
    hasSelection,
    selectionCount,
  } = useResourceSelection();
  
  // Fetch root resources with SWR
  const { 
    data: rootData, 
    error, 
    isLoading: isLoadingRoot, 
    mutate: refreshResources 
  } = useConnectionResources(connectionId, '');
  
  // Prefetching on hover
  const { prefetchResource } = usePrefetchResources(connectionId);
  
  // Add indexing status tracking
  const { 
    indexingStatus, 
    updateIndexingStatus,
    updateBulkIndexingStatus
  } = useIndexingStatus();
  
  // Add state for storing our own knowledge base ID
  const [localKnowledgeBaseId, setLocalKnowledgeBaseId] = useState<string | null>(null);
  
  // Initialization effect - create KB if needed
  useEffect(() => {
    // If knowledgeBaseId was provided, use that
    if (knowledgeBaseId) {
      setLocalKnowledgeBaseId(knowledgeBaseId);
      return;
    }
    
    // Check if we have a stored KB ID in localStorage
    const storedKbId = localStorage.getItem('stackAI_knowledgeBaseId');
    if (storedKbId) {
      setLocalKnowledgeBaseId(storedKbId);
      return;
    }
    
    // Otherwise, create a new knowledge base
    const initializeKnowledgeBase = async () => {
      if (!connectionId || !orgId) {
        return;
      }
      
      try {
        const kb = await createAndSyncKnowledgeBase(
          connectionId,
          [], // Start with no resources
          'Stack AI Take Home Knowledge Base',
          'Knowledge base for the Stack AI take home project',
          orgId
        );
        
        const newKbId = kb.knowledge_base_id;
        
        // Store in localStorage for persistence
        localStorage.setItem('stackAI_knowledgeBaseId', newKbId);
        setLocalKnowledgeBaseId(newKbId);
        
        // Notify parent if needed
        if (onCreateKnowledgeBase) {
          onCreateKnowledgeBase(kb as unknown as Record<string, unknown>);
        }
        
        toast.success('Initialized knowledge base');
      } catch (error) {
        console.error('Failed to initialize knowledge base', error);
        toast.error('Failed to initialize knowledge base');
      }
    };
    
    initializeKnowledgeBase();
  }, [connectionId, knowledgeBaseId, orgId, onCreateKnowledgeBase]);
  
  // Now we use the effective KB ID throughout the component
  const effectiveKnowledgeBaseId = localKnowledgeBaseId || knowledgeBaseId;
  
  // Fixed status loading that checks connection_source_ids
  const loadIndexingStatus = async () => {
    if (!effectiveKnowledgeBaseId) {
      return;
    }

    try {
      // Get the KB status to check connection_source_ids
      const kb = await getKnowledgeBaseStatus(effectiveKnowledgeBaseId);
      const sourceIds = kb.connection_source_ids || [];
      
      // Also get visible resources for their current status
      const kbResources = await getKnowledgeBaseResources(effectiveKnowledgeBaseId);
      
      const newStatus: Record<string, string> = {};
      
      // Mark resources that are in connection_source_ids as indexed
      sourceIds.forEach(sourceId => {
        newStatus[sourceId] = 'indexed';
      });
      
      // Override with actual status from visible resources if available
      kbResources.data.forEach(resource => {
        if (resource.status) {
          newStatus[resource.resource_id] = resource.status;
        }
      });
      
      // Update the indexing status for each resource
      Object.entries(newStatus).forEach(([resourceId, status]) => {
        updateIndexingStatus(resourceId, status);
      });
      
    } catch (error) {
      console.error('Failed to load indexing status', error);
    }
  };
  
  // Add an effect to load the indexing status from the knowledge base
  useEffect(() => {
    if (!effectiveKnowledgeBaseId) return;
    
    // Load immediately on mount
    loadIndexingStatus();
    
    // And then set up a refresh interval
    const intervalId = setInterval(loadIndexingStatus, 30000); // Every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [effectiveKnowledgeBaseId, updateIndexingStatus]);
  
  // Improved polling logic that respects manual status updates
  const pollIndexingStatus = useCallback(async (
    knowledgeBaseId: string, 
    resourceIds: string[], 
    toastId?: string | number
  ) => {
    const maxAttempts = 30; // 5 minutes max (10s intervals)
    let attempts = 0;
    let completedResources: string[] = [];
    
    const poll = async (): Promise<void> => {
      attempts++;
      
      try {
        const statusMap = await getKnowledgeBaseResourceStatus(knowledgeBaseId, resourceIds);
        
        let allCompleted = true;
        let hasErrors = false;
        completedResources = []; // Reset completed list
        
        for (const resourceId of resourceIds) {
          const currentLocalStatus = indexingStatus[resourceId];
          const apiStatus = statusMap[resourceId];
          
          // Don't override manual status changes (like de-indexing)
          if (currentLocalStatus === 'de-indexing' || currentLocalStatus === 'resource') {
            continue;
          }
          
          if (apiStatus) {
            const finalStatus = apiStatus === 'completed' ? 'indexed' : apiStatus;
            
            if (finalStatus !== currentLocalStatus) {
              updateIndexingStatus(resourceId, finalStatus);
            }
            
            if (finalStatus === 'indexed') {
              completedResources.push(resourceId);
            } else if (finalStatus === 'pending' || finalStatus === 'processing') {
              allCompleted = false;
            } else if (finalStatus === 'error' || finalStatus === 'failed' || finalStatus === 'timeout') {
              hasErrors = true;
            }
          } else {
            // Resource not found in KB - might have been de-indexed
            allCompleted = false;
          }
        }
        
        if (allCompleted || hasErrors || attempts >= maxAttempts) {
          if (toastId) {
            if (hasErrors) {
              toast.error('Some files failed to index', { id: toastId });
            } else if (attempts >= maxAttempts) {
              toast.error('Indexing timed out', { id: toastId });
            } else {
              // Use the actual completed resources count from API
              const successCount = completedResources.length;
              if (successCount > 0) {
                toast.success(`${successCount} file(s) indexed successfully`, { id: toastId });
              } else {
                toast.success('Indexing completed', { id: toastId });
              }
            }
          }
          
          // Final refresh to ensure UI is in sync
          refreshResources();
          return;
        }
        
        // Continue polling
        setTimeout(poll, 10000); // 10 second intervals
      } catch (error) {
        console.error('❌ Error during polling:', error);
        if (attempts >= maxAttempts) {
          if (toastId) {
            toast.error('Failed to check indexing status', { id: toastId });
          }
          return;
        }
        
        // Retry on error
        setTimeout(poll, 10000);
      }
    };
    
    // Start polling
    poll();
  }, [indexingStatus, updateIndexingStatus, refreshResources]);
  
  // Load folder contents
  const loadFolderContents = useCallback(async (folderId: string) => {
    if (folderContents[folderId] || loadingFolders.has(folderId)) {
      return; // Already loaded or loading
    }
    
    setLoadingFolders(prev => new Set(prev).add(folderId));
    
    try {
      const response = await getConnectionResources(connectionId, folderId);
      setFolderContents(prev => ({
        ...prev,
        [folderId]: response.data
      }));
    } catch (error) {
      console.error('Failed to load folder contents', error);
      toast.error('Failed to load folder contents');
    } finally {
      setLoadingFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderId);
        return newSet;
      });
    }
  }, [connectionId, folderContents, loadingFolders]);
  
  // Handle folder toggle
  const handleFolderToggle = useCallback(async (resource: Resource) => {
    const folderId = resource.resource_id;
    
    if (expandedFolders.has(folderId)) {
      // Collapse folder
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderId);
        return newSet;
      });
    } else {
      // Expand folder
      setExpandedFolders(prev => new Set(prev).add(folderId));
      
      // Load contents if not already loaded
      if (!folderContents[folderId]) {
        await loadFolderContents(folderId);
      }
    }
  }, [expandedFolders, folderContents, loadFolderContents]);
  
  // Build hierarchical data structure
  const hierarchicalData = useMemo(() => {
    if (!rootData?.data) return [];
    
    const buildHierarchy = (resources: Resource[], depth: number = 0, parentId?: string): HierarchicalResource[] => {
      return resources.reduce((acc: HierarchicalResource[], resource) => {
        const hierarchicalResource: HierarchicalResource = {
          ...resource,
          depth,
          parentId,
          isExpanded: expandedFolders.has(resource.resource_id)
        };
        
        acc.push(hierarchicalResource);
        
        // If this is an expanded folder, add its children
        if (resource.inode_type === 'directory' && 
            expandedFolders.has(resource.resource_id) && 
            folderContents[resource.resource_id]) {
          const children = buildHierarchy(
            folderContents[resource.resource_id], 
            depth + 1, 
            resource.resource_id
          );
          acc.push(...children);
        }
        
        return acc;
      }, []);
    };
    
    return buildHierarchy(rootData.data);
  }, [rootData?.data, expandedFolders, folderContents]);
  
  // Handle navigation (now just toggles folders)
  const handleNavigate = useCallback((resource: Resource) => {
    if (resource.inode_type === 'directory') {
      handleFolderToggle(resource);
    }
  }, [handleFolderToggle]);
  
  // Handle indexing with proper status tracking
  const handleIndex = useCallback(async (resource: Resource) => {
    if (!connectionId || !effectiveKnowledgeBaseId || !orgId) {
      toast.error('Knowledge base not ready yet');
      return;
    }

    try {
      // Set initial status to pending
      updateIndexingStatus(resource.resource_id, 'pending');
      
      // Show loading toast
      const loadingToast = toast.loading(`Indexing "${resource.inode_path.path}"...`);
      
      try {
        // Add the single resource to the knowledge base and trigger sync
        await addResourcesToKnowledgeBase(
          effectiveKnowledgeBaseId,
          connectionId,
          [resource.resource_id],
          orgId
        );
        
        // Update to processing toast
        toast.loading(`Processing "${resource.inode_path.path}"...`, { id: loadingToast });
        
        // Start polling for this specific resource
        pollIndexingStatus(effectiveKnowledgeBaseId, [resource.resource_id], loadingToast);
        
      } catch (error) {
        console.error('Failed to add resource to KB:', error);
        updateIndexingStatus(resource.resource_id, 'failed');
        toast.error(`Failed to index "${resource.inode_path.path}"`, { id: loadingToast });
      }
    } catch (error) {
      console.error('Error in handleIndex:', error);
      updateIndexingStatus(resource.resource_id, 'failed');
      toast.error(`Failed to index "${resource.inode_path.path}"`);
    }
  }, [connectionId, effectiveKnowledgeBaseId, orgId, updateIndexingStatus, pollIndexingStatus]);
  
  // Helper function to get all files recursively from a folder
  const getAllFilesInFolder = useCallback(async (folderId: string): Promise<string[]> => {
    const fileIds: string[] = [];
    
    const collectFiles = async (currentFolderId: string): Promise<void> => {
      try {
        // Load folder contents if not already loaded
        if (!folderContents[currentFolderId]) {
          await loadFolderContents(currentFolderId);
        }
        
        const contents = folderContents[currentFolderId] || [];
        
        for (const resource of contents) {
          if (resource.inode_type === 'directory') {
            // Recursively collect files from subdirectories
            await collectFiles(resource.resource_id);
          } else {
            // Add file to collection
            fileIds.push(resource.resource_id);
          }
        }
      } catch (error) {
        console.error(`Failed to collect files from folder ${currentFolderId}:`, error);
      }
    };
    
    await collectFiles(folderId);
    return fileIds;
  }, [folderContents, loadFolderContents]);

  // Enhanced handle selection with folder support - FIXED
  const handleSelect = useCallback(async (resource: Resource) => {
    if (resource.inode_type === 'directory') {
      // For folders, select/deselect all files inside (but NOT the folder itself)
      const isCurrentlySelected = selectedResources[resource.resource_id];
      
      if (isCurrentlySelected) {
        // Deselect folder and all its files
        toggleSelection(resource.resource_id); // Remove folder from selection
        
        // Get all files in this folder and deselect them
        try {
          const fileIds = await getAllFilesInFolder(resource.resource_id);
          fileIds.forEach(fileId => {
            if (selectedResources[fileId]) {
              toggleSelection(fileId);
            }
          });
        } catch (error) {
          console.error('Failed to deselect files in folder:', error);
        }
      } else {
        // DON'T select the folder itself - only select files inside
        // toggleSelection(resource.resource_id); // ❌ Remove this line
        
        // Get all files in this folder and select them
        try {
          const fileIds = await getAllFilesInFolder(resource.resource_id);
          fileIds.forEach(fileId => {
            if (!selectedResources[fileId]) {
              toggleSelection(fileId);
            }
          });
          
          if (fileIds.length > 0) {
            toast.success(`Selected ${fileIds.length} files from "${resource.inode_path.path}"`);
          }
        } catch (error) {
          console.error('Failed to select files in folder:', error);
          toast.error('Failed to select files in folder');
        }
      }
    } else {
      // For files, just toggle selection normally
      toggleSelection(resource.resource_id);
    }
  }, [selectedResources, toggleSelection, getAllFilesInFolder]);

  // Enhanced bulk indexing that only indexes files (not folders)
  const handleBulkIndex = useCallback(async () => {
    if (!connectionId || !effectiveKnowledgeBaseId || !orgId) {
      toast.error('Knowledge base not ready yet');
      return;
    }
    
    const selectedIds = getSelectedIds();
    
    if (selectedIds.length === 0) {
      return;
    }
    
    // Filter out folders - only index actual files
    const fileIds = selectedIds.filter(id => {
      const resource = hierarchicalData.find(r => r.resource_id === id);
      return resource && resource.inode_type !== 'directory';
    });
    
    if (fileIds.length === 0) {
      toast.warning('No files selected for indexing (folders cannot be indexed)');
      return;
    }
    
    // Show info if some folders were excluded
    const folderCount = selectedIds.length - fileIds.length;
    if (folderCount > 0) {
      toast.info(`Indexing ${fileIds.length} files (${folderCount} folders excluded)`);
    }
    
    try {
      // Set initial status to pending for all selected files only
      updateBulkIndexingStatus(fileIds, 'pending');
      
      // Show loading toast
      const loadingToast = toast.loading(`Indexing ${fileIds.length} files...`);
      
      try {
        // Add all file resources to the knowledge base in one call
        await addResourcesToKnowledgeBase(
          effectiveKnowledgeBaseId,
          connectionId,
          fileIds,
          orgId
        );
        
        // Update to processing toast
        toast.loading(`Processing ${fileIds.length} files...`, { id: loadingToast });
        
        // Clear selection after successful submission
        clearSelection();
        
        // Start polling for all selected file resources
        pollIndexingStatus(effectiveKnowledgeBaseId, fileIds, loadingToast);
        
      } catch (error) {
        console.error('Failed to index resources', error);
        updateBulkIndexingStatus(fileIds, 'failed');
        toast.error(`Failed to index ${fileIds.length} files`, { id: loadingToast });
      }
    } catch (error) {
      console.error('Failed to index resources', error);
      updateBulkIndexingStatus(fileIds, 'failed');
      toast.error("Failed to index selected files");
    }
  }, [connectionId, effectiveKnowledgeBaseId, orgId, getSelectedIds, clearSelection, updateBulkIndexingStatus, pollIndexingStatus, hierarchicalData]);
  
  // Handle de-indexing with proper KB state management
  const handleDeIndex = useCallback(async (resource: Resource) => {
    if (!effectiveKnowledgeBaseId || !orgId) {
      toast.error('Knowledge base not initialized yet');
      return;
    }
    
    try {
      // Set initial status to de-indexing
      updateIndexingStatus(resource.resource_id, 'de-indexing');
      
      // Show loading toast
      const loadingToast = toast.loading(`De-indexing "${resource.inode_path.path}"...`);
      
      try {
        // Properly remove the resource from KB (removes from connection_source_ids AND deletes resource)
        await removeResourceFromKnowledgeBase(
          effectiveKnowledgeBaseId,
          resource.resource_id,
          orgId
        );
        
        // Update status to reflect de-indexed state
        updateIndexingStatus(resource.resource_id, 'resource');
        
        // Refresh resources to reflect changes
        refreshResources();
        
        toast.success(`"${resource.inode_path.path}" de-indexed successfully`, { id: loadingToast });
      } catch (error) {
        console.error('Failed to de-index resource', error);
        updateIndexingStatus(resource.resource_id, 'error');
        toast.error(`Failed to de-index "${resource.inode_path.path}"`, { id: loadingToast });
      }
    } catch (error) {
      console.error('Failed to de-index resource', error);
      updateIndexingStatus(resource.resource_id, 'error');
      toast.error(`Failed to de-index "${resource.inode_path.path}"`);
    }
  }, [effectiveKnowledgeBaseId, orgId, updateIndexingStatus, refreshResources]);
  
  // Handle bulk de-indexing
  const handleBulkDeIndex = useCallback(async () => {
    if (!effectiveKnowledgeBaseId || !orgId) {
      toast.error('Knowledge base not ready yet');
      return;
    }
    
    // Get only indexed files from selection
    const selectedIds = getSelectedIds();
    const indexedSelectedIds = selectedIds.filter(id => 
      indexingStatus[id] === 'indexed' || indexingStatus[id] === 'completed'
    );
    
    if (indexedSelectedIds.length === 0) {
      toast.warning('No indexed files selected');
      return;
    }
    
    try {
      // Set initial status to de-indexing for all selected indexed resources
      updateBulkIndexingStatus(indexedSelectedIds, 'de-indexing');
      
      // Show loading toast
      const loadingToast = toast.loading(`De-indexing ${indexedSelectedIds.length} files...`);
      
      try {
        // Remove all resources from the knowledge base using the bulk function
        await removeResourcesFromKnowledgeBase(
          effectiveKnowledgeBaseId,
          indexedSelectedIds,
          orgId
        );
        
        // Update status to reflect de-indexed state for all
        updateBulkIndexingStatus(indexedSelectedIds, 'resource');
        
        // Clear selection after successful de-indexing
        clearSelection();
        
        // Refresh resources to reflect changes
        refreshResources();
        
        toast.success(`${indexedSelectedIds.length} files de-indexed successfully`, { id: loadingToast });
      } catch (error) {
        console.error('Failed to de-index resources', error);
        updateBulkIndexingStatus(indexedSelectedIds, 'error');
        toast.error(`Failed to de-index ${indexedSelectedIds.length} files`, { id: loadingToast });
      }
    } catch (error) {
      console.error('Failed to de-index resources', error);
      updateBulkIndexingStatus(indexedSelectedIds, 'error');
      toast.error("Failed to de-index selected files");
    }
  }, [effectiveKnowledgeBaseId, orgId, getSelectedIds, clearSelection, updateBulkIndexingStatus, refreshResources]);
  
  // Render file list content based on loading/error state
  const renderContent = useCallback(() => {
    if (isLoadingRoot) {
      return (
        <div className="flex flex-col h-full">
          {/* Search and Columns skeleton - Fixed at top */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Skeleton className="h-9 w-[250px] md:w-[300px]" />
              </div>
            </div>
            <Skeleton className="h-9 w-20" />
          </div>

          {/* Table skeleton wrapper */}
          <div className="rounded-md border flex-1 flex flex-col">
            {/* Fixed table header skeleton */}
            <div className="border-b">
              <div className="flex">
                {/* Select column */}
                <div className="w-[60px] p-4 border-r">
                  <Skeleton className="h-4 w-4 mx-auto" />
                </div>
                {/* Name column */}
                <div className="flex-1 p-4 border-r">
                  <Skeleton className="h-4 w-16" />
                </div>
                {/* Modified column */}
                <div className="w-[150px] p-4 border-r">
                  <Skeleton className="h-4 w-16" />
                </div>
                {/* Size column */}
                <div className="w-[100px] p-4 border-r">
                  <Skeleton className="h-4 w-8" />
                </div>
                {/* Status column */}
                <div className="w-[120px] p-4 border-r">
                  <Skeleton className="h-4 w-12" />
                </div>
                {/* Actions column */}
                <div className="w-[70px] p-4">
                  <Skeleton className="h-4 w-4 mx-auto" />
                </div>
              </div>
            </div>
            
            {/* Scrollable table body skeleton */}
            <div className="overflow-auto h-[350px] p-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center py-3 border-b last:border-b-0">
                  {/* Select column */}
                  <div className="w-[60px] flex justify-center">
                    <Skeleton className="h-4 w-4" />
                  </div>
                  {/* Name column with hierarchical indentation */}
                  <div className="flex-1 flex items-center gap-2" style={{ paddingLeft: `${(i % 3) * 20}px` }}>
                    {/* Expand/collapse icon for some rows */}
                    {i % 4 === 0 && <Skeleton className="h-3 w-3" />}
                    {/* File icon */}
                    <Skeleton className="h-4 w-4" />
                    {/* File name */}
                    <Skeleton className={`h-4 ${i % 3 === 0 ? 'w-32' : i % 3 === 1 ? 'w-24' : 'w-40'}`} />
                  </div>
                  {/* Modified column */}
                  <div className="w-[150px] px-4">
                    <Skeleton className="h-4 w-20" />
                  </div>
                  {/* Size column */}
                  <div className="w-[100px] px-4">
                    <Skeleton className="h-4 w-12" />
                  </div>
                  {/* Status column */}
                  <div className="w-[120px] px-4">
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                  {/* Actions column */}
                  <div className="w-[70px] flex justify-center">
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mb-2" />
          <h3 className="font-semibold text-lg">Failed to load resources</h3>
          <p className="text-muted-foreground mb-4">
            There was a problem loading your files.
          </p>
          <Button onClick={() => refreshResources()}>
            Try Again
          </Button>
        </div>
      );
    }
    
    if (hierarchicalData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground mb-2" />
          <h3 className="font-semibold text-lg">No files found</h3>
          <p className="text-muted-foreground">
            This folder is empty
          </p>
        </div>
      );
    }
    
    return (
      <FileTable
        data={hierarchicalData}
        isLoading={isLoadingRoot}
        onNavigate={handleNavigate}
        onSelect={handleSelect}
        onIndex={handleIndex}
        onDeIndex={handleDeIndex}
        selectedResources={selectedResources}
        onPrefetch={prefetchResource}
        indexingStatus={indexingStatus}
        loadingFolders={loadingFolders}
      />
    );
  }, [
    isLoadingRoot, 
    error, 
    hierarchicalData, 
    refreshResources, 
    handleNavigate, 
    handleSelect, 
    handleIndex, 
    handleDeIndex, 
    selectedResources,
    prefetchResource,
    indexingStatus,
    loadingFolders
  ]);
  
  return (
    <div className={cn("flex flex-col h-full border rounded-md", className)}>
      <div className="py-4 px-5 border-b bg-muted/40">
        <div className="flex items-center gap-1">
          <Image 
            src="/google-drive-logo.png" 
            alt="Google Drive" 
            width={32} 
            height={32} 
            className="flex-shrink-0"
          />
          <h2 className="text-lg font-semibold">Google Drive</h2>
        </div>
      </div>
      
      <div className="flex-1 p-4">
        {renderContent()}
      </div>
      
      <div className="p-4 border-t bg-muted/40 flex justify-between items-center">      
        <div className="text-sm text-muted-foreground">
          {isLoadingRoot ? (
            <span className="flex items-center">
              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              Loading...
            </span>
          ) : hasSelection ? (
            <span>
              {selectionCount} of {hierarchicalData.length} selected
            </span>
          ) : hierarchicalData.length > 0 ? (
            <span>
              {hierarchicalData.length} items
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={clearSelection}
                className="gap-2"
                disabled={!hasSelection}
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
              
              <Button 
                variant="default" 
                size="sm"
                onClick={handleBulkIndex}
                className="gap-2"
                disabled={!hasSelection}
              >
                <Check className="h-4 w-4" />
                Index Selected
              </Button>
              
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleBulkDeIndex}
                className="gap-2"
                disabled={!hasSelection || !getSelectedIds().some(id => 
                  indexingStatus[id] === 'indexed' || indexingStatus[id] === 'completed'
                )}
              >
                <X className="h-4 w-4" />
                De-index Selected
              </Button>
            </>
          }
        </div>
      </div>
    </div>
  );
}
