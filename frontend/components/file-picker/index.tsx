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
import { useSWRConfig } from 'swr';

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
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  
  const [folderContents, setFolderContents] = useState<Record<string, Resource[]>>({});
  
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  
  const { 
    selectedResources, 
    toggleSelection,  
    clearSelection, 
    getSelectedIds,
    hasSelection,
    selectionCount,
  } = useResourceSelection();
  
  const { 
    data: rootData, 
    error, 
    isLoading: isLoadingRoot, 
    mutate: refreshResources 
  } = useConnectionResources(connectionId, '');
  
  const { prefetchResource } = usePrefetchResources(connectionId);
  
  const { 
    indexingStatus, 
    updateIndexingStatus,
    updateBulkIndexingStatus
  } = useIndexingStatus();
  
  const [localKnowledgeBaseId, setLocalKnowledgeBaseId] = useState<string | null>(null);
  
  const { mutate } = useSWRConfig();
  
  useEffect(() => {
    if (knowledgeBaseId) {
      setLocalKnowledgeBaseId(knowledgeBaseId);
      return;
    }
    
    const storedKbId = localStorage.getItem('stackAI_knowledgeBaseId');
    if (storedKbId) {
      setLocalKnowledgeBaseId(storedKbId);
      return;
    }
    
    const initializeKnowledgeBase = async () => {
      if (!connectionId || !orgId) {
        return;
      }
      
      try {
        const kb = await createAndSyncKnowledgeBase(
          connectionId,
          [],
          'Stack AI Take Home KB',
          'KB for the Stack AI take home project',
          orgId
        );
        
        const newKbId = kb.knowledge_base_id;
        
        localStorage.setItem('stackAI_knowledgeBaseId', newKbId);
        setLocalKnowledgeBaseId(newKbId);
        
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
  
  const effectiveKnowledgeBaseId = localKnowledgeBaseId || knowledgeBaseId;
  
  const loadIndexingStatus = async () => {
    if (!effectiveKnowledgeBaseId) {
      return;
    }

    try {
      const kb = await getKnowledgeBaseStatus(effectiveKnowledgeBaseId);
      const sourceIds = kb.connection_source_ids || [];
      
      const kbResources = await getKnowledgeBaseResources(effectiveKnowledgeBaseId);
      
      const newStatus: Record<string, string> = {};
      
      sourceIds.forEach(sourceId => {
        newStatus[sourceId] = 'indexed';
      });
      
      kbResources.data.forEach(resource => {
        if (resource.status) {
          newStatus[resource.resource_id] = resource.status;
        }
      });
      
      Object.entries(newStatus).forEach(([resourceId, status]) => {
        updateIndexingStatus(resourceId, status);
      });
      
    } catch (error) {
      console.error('Failed to load indexing status', error);
    }
  };
  
  useEffect(() => {
    if (!effectiveKnowledgeBaseId) return;
    
    loadIndexingStatus();
    
    const intervalId = setInterval(loadIndexingStatus, 30000); // Every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [effectiveKnowledgeBaseId, updateIndexingStatus]);
  
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
        completedResources = [];
        
        for (const resourceId of resourceIds) {
          const currentLocalStatus = indexingStatus[resourceId];
          const apiStatus = statusMap[resourceId];
          
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
              const successCount = completedResources.length;
              if (successCount > 0) {
                toast.success(`${successCount} file(s) indexed successfully`, { id: toastId });
              } else {
                toast.success('Indexing completed', { id: toastId });
              }
            }
          }
          
          refreshResources();
          return;
        }
        
        setTimeout(poll, 10000); // 10 second intervals
      } catch (error) {
        console.error('Error during polling:', error);
        if (attempts >= maxAttempts) {
          if (toastId) {
            toast.error('Failed to check indexing status', { id: toastId });
          }
          return;
        }
        
        setTimeout(poll, 10000);
      }
    };
    
    poll();
  }, [indexingStatus, updateIndexingStatus, refreshResources]);
  
  const loadFolderContents = useCallback(async (folderId: string) => {
    if (folderContents[folderId] || loadingFolders.has(folderId)) {
      return;
    }
    
    const cacheKey = [`connections/${connectionId}/resources`, folderId];
    const cachedData = mutate(cacheKey);
    
    if (cachedData && typeof cachedData.then === 'function') {
      setLoadingFolders(prev => new Set(prev).add(folderId));
      
      try {
        const response = await cachedData;
        
        if (response && response.data) {
          setFolderContents(prev => ({
            ...prev,
            [folderId]: response.data
          }));

          if (response.data.length > 0) {
            response.data.forEach((childResource: Resource) => {
              if (childResource.inode_type === 'directory') {
                prefetchResource(childResource.resource_id);
              }
            });
          }
        } else {
          const directResponse = await getConnectionResources(connectionId, folderId);
          setFolderContents(prev => ({
            ...prev,
            [folderId]: directResponse.data
          }));

          if (directResponse.data && directResponse.data.length > 0) {
            directResponse.data.forEach(childResource => {
              if (childResource.inode_type === 'directory') {
                prefetchResource(childResource.resource_id);
              }
            });
          }
        }
      } catch (error) {
        console.error('Failed to load folder contents from cache, trying direct API call', error);
        
        try {
          const response = await getConnectionResources(connectionId, folderId);
          setFolderContents(prev => ({
            ...prev,
            [folderId]: response.data
          }));

          if (response.data && response.data.length > 0) {
            response.data.forEach(childResource => {
              if (childResource.inode_type === 'directory') {
                prefetchResource(childResource.resource_id);
              }
            });
          }
        } catch (directError) {
          console.error('Failed to load folder contents', directError);
          toast.error('Failed to load folder contents');
        }
      } finally {
        setLoadingFolders(prev => {
          const newSet = new Set(prev);
          newSet.delete(folderId);
          return newSet;
        });
      }
    } else if (cachedData && typeof cachedData === 'object' && 'data' in cachedData) {
      setFolderContents(prev => ({
        ...prev,
        [folderId]: (cachedData as { data: Resource[] }).data
      }));
    } else {
      setLoadingFolders(prev => new Set(prev).add(folderId));
      
      try {
        const response = await getConnectionResources(connectionId, folderId);
        setFolderContents(prev => ({
          ...prev,
          [folderId]: response.data
        }));

        if (response.data && response.data.length > 0) {
          response.data.forEach(childResource => {
            if (childResource.inode_type === 'directory') {
              prefetchResource(childResource.resource_id);
            }
          });
        }
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
    }
  }, [connectionId, folderContents, loadingFolders, prefetchResource, mutate]);
  
  const handleFolderToggle = useCallback(async (resource: Resource) => {
    const folderId = resource.resource_id;
    
    if (expandedFolders.has(folderId)) {
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderId);
        return newSet;
      });
    } else {
      setExpandedFolders(prev => new Set(prev).add(folderId));
      
      if (!folderContents[folderId]) {
        await loadFolderContents(folderId);
      }
    }
  }, [expandedFolders, folderContents, loadFolderContents]);
  
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
  
  const handleNavigate = useCallback((resource: Resource) => {
    if (resource.inode_type === 'directory') {
      handleFolderToggle(resource);
    }
  }, [handleFolderToggle]);
  
  const handleIndex = useCallback(async (resource: Resource) => {
    if (!connectionId || !effectiveKnowledgeBaseId || !orgId) {
      toast.error('Knowledge base not ready yet');
      return;
    }

    try {
      updateIndexingStatus(resource.resource_id, 'pending');
      
      const loadingToast = toast.loading(`Indexing "${resource.inode_path.path}"...`);
      
      try {
        await addResourcesToKnowledgeBase(
          effectiveKnowledgeBaseId,
          connectionId,
          [resource.resource_id],
          orgId
        );
        
        toast.loading(`Processing "${resource.inode_path.path}"...`, { id: loadingToast });
        
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
  
  const getAllFilesInFolder = useCallback(async (folderId: string): Promise<string[]> => {
    const fileIds: string[] = [];
    
    const collectFiles = async (currentFolderId: string): Promise<void> => {
      try {
        if (!folderContents[currentFolderId]) {
          await loadFolderContents(currentFolderId);
        }
        
        const contents = folderContents[currentFolderId] || [];
        
        for (const resource of contents) {
          if (resource.inode_type === 'directory') {
            await collectFiles(resource.resource_id);
          } else {
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

  const handleSelect = useCallback(async (resource: Resource) => {
    if (resource.inode_type === 'directory') {
      const isCurrentlySelected = selectedResources[resource.resource_id];
      
      if (isCurrentlySelected) {
        toggleSelection(resource.resource_id);
        
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
        toggleSelection(resource.resource_id);
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
      toggleSelection(resource.resource_id);
    }
  }, [selectedResources, toggleSelection, getAllFilesInFolder]);

  const handleBulkIndex = useCallback(async () => {
    if (!connectionId || !effectiveKnowledgeBaseId || !orgId) {
      toast.error('Knowledge base not ready yet');
      return;
    }
    
    const selectedIds = getSelectedIds();
    
    if (selectedIds.length === 0) {
      return;
    }
    
    const fileIds = selectedIds.filter(id => {
      const resource = hierarchicalData.find(r => r.resource_id === id);
      return resource && resource.inode_type !== 'directory';
    });
    
    if (fileIds.length === 0) {
      toast.warning('No files selected for indexing (folders cannot be indexed)');
      return;
    }
    
    const folderCount = selectedIds.length - fileIds.length;
    if (folderCount > 0) {
      toast.info(`Indexing ${fileIds.length} files (${folderCount} folders excluded)`);
    }
    
    try {
      updateBulkIndexingStatus(fileIds, 'pending');
      
      const loadingToast = toast.loading(`Indexing ${fileIds.length} files...`);
      
      try {
        await addResourcesToKnowledgeBase(
          effectiveKnowledgeBaseId,
          connectionId,
          fileIds,
          orgId
        );
        
        toast.loading(`Processing ${fileIds.length} files...`, { id: loadingToast });
      
        clearSelection();
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
  
  const handleDeIndex = useCallback(async (resource: Resource) => {
    if (!effectiveKnowledgeBaseId || !orgId) {
      toast.error('Knowledge base not initialized yet');
      return;
    }
    
    try {
      updateIndexingStatus(resource.resource_id, 'de-indexing');
      const loadingToast = toast.loading(`De-indexing "${resource.inode_path.path}"...`);
      
      try {
        await removeResourceFromKnowledgeBase(
          effectiveKnowledgeBaseId,
          resource.resource_id,
          orgId
        );
        
        updateIndexingStatus(resource.resource_id, 'resource');
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
  
  const handleBulkDeIndex = useCallback(async () => {
    if (!effectiveKnowledgeBaseId || !orgId) {
      toast.error('Knowledge base not ready yet');
      return;
    }
    
    const selectedIds = getSelectedIds();
    const indexedSelectedIds = selectedIds.filter(id => 
      indexingStatus[id] === 'indexed' || indexingStatus[id] === 'completed'
    );
    
    if (indexedSelectedIds.length === 0) {
      toast.warning('No indexed files selected');
      return;
    }
    
    try {
      updateBulkIndexingStatus(indexedSelectedIds, 'de-indexing');
      const loadingToast = toast.loading(`De-indexing ${indexedSelectedIds.length} files...`);
      
      try {
        await removeResourcesFromKnowledgeBase(
          effectiveKnowledgeBaseId,
          indexedSelectedIds,
          orgId
        );
        
        updateBulkIndexingStatus(indexedSelectedIds, 'resource');
        clearSelection();
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
  
  const renderContent = useCallback(() => {
    if (isLoadingRoot) {
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Skeleton className="h-9 w-[250px] md:w-[300px]" />
              </div>
            </div>
            <Skeleton className="h-9 w-28" />
          </div>

          <div className="rounded-md border flex-1 flex flex-col">
            <div className="border-b">
              <div className="flex h-12 items-center px-4">
                <div className="w-[60px] flex justify-center items-center pr-4 border-r">
                  <Skeleton className="h-4 w-4" />
                </div>
                <div className="flex-1 px-4 border-r">
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="w-[150px] px-4 border-r">
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="w-[100px] px-4 border-r">
                  <Skeleton className="h-4 w-12" />
                </div>
                <div className="w-[120px] px-4 border-r">
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="w-[70px] flex justify-center items-center pl-4">
                  <Skeleton className="h-4 w-4" />
                </div>
              </div>
            </div>
            
            <div className="overflow-hidden h-[350px] p-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center py-3 border-b last:border-b-0 h-14">
                  <div className="w-[60px] flex justify-center items-center pr-4">
                    <Skeleton className="h-4 w-4" />
                  </div>
                  <div 
                    className="flex-1 flex items-center gap-2 px-4" 
                    style={{ paddingLeft: `${(i % 3) * 20 + 16}px` }}
                  >
                    <Skeleton className="h-5 w-5 flex-shrink-0" />
                    <Skeleton className="h-4 w-full max-w-[200px]" />
                  </div>
                  <div className="w-[150px] px-4 flex items-center">
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="w-[100px] px-4 flex items-center">
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <div className="w-[120px] px-4 flex items-center">
                    <Skeleton className="h-6 w-20 rounded-md" />
                  </div>
                  <div className="w-[70px] flex justify-center items-center pl-4">
                    <Skeleton className="h-6 w-6" />
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
