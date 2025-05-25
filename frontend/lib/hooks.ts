import { useCallback, useState } from 'react';
import useSWR, { SWRConfiguration, useSWRConfig } from 'swr';
import { useDebounce } from 'use-debounce';
import { 
  getConnectionResources, 
  getKnowledgeBaseResources,
  getConnections,
  createKnowledgeBase,
  syncKnowledgeBase
} from './api';
import { isAuthenticated } from './auth';
import { Connection, ResourceResponse, KnowledgeBase } from '@/types/api';

const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateIfStale: true,
  errorRetryCount: 3,
  dedupingInterval: 5000, // 5 seconds
};

export function useConnections(config?: SWRConfiguration) {
  return useSWR<Connection[]>(
    isAuthenticated() ? 'connections' : null, 
    () => getConnections(),
    { ...defaultConfig, ...config }
  );
}

export function useConnectionResources(
  connectionId: string | null, 
  resourceId?: string, 
  config?: SWRConfiguration
) {
  const shouldFetch = Boolean(connectionId);
  
  return useSWR(
    shouldFetch ? [`connections/${connectionId}/resources`, resourceId] : null,
    async () => {
      if (!connectionId) return null;
      return getConnectionResources(connectionId, resourceId);
    },
    { ...defaultConfig, ...config }
  );
}

export function useKnowledgeBaseResources(
  knowledgeBaseId: string | null, 
  resourcePath: string = '/', 
  config?: SWRConfiguration
) {
  const shouldFetch = Boolean(knowledgeBaseId);
  
  return useSWR(
    shouldFetch ? [`knowledge_bases/${knowledgeBaseId}/resources`, resourcePath] : null,
    async () => {
      if (!knowledgeBaseId) return null;
      return getKnowledgeBaseResources(knowledgeBaseId, resourcePath);
    },
    { ...defaultConfig, ...config }
  );
}

export function useResourceSearch(
  resources: ResourceResponse | undefined,
  debounceMs: number = 300
) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, debounceMs);
  
  const filteredResources = useCallback(() => {
    if (!resources?.data || !debouncedQuery.trim()) {
      return resources?.data || [];
    }
    
    const query = debouncedQuery.toLowerCase();
    return resources.data.filter(resource => 
      resource.inode_path.path.toLowerCase().includes(query)
    );
  }, [resources, debouncedQuery]);
  
  return {
    searchQuery,
    setSearchQuery,
    debouncedQuery,
    filteredResources: filteredResources(),
  };
}

export function useResourceSelection() {
  const [selectedResources, setSelectedResources] = useState<Record<string, boolean>>({});
  
  const toggleSelection = useCallback((resourceId: string) => {
    setSelectedResources(prev => ({
      ...prev,
      [resourceId]: !prev[resourceId]
    }));
  }, []);
  
  const selectAll = useCallback((resourceIds: string[]) => {
    const newSelection: Record<string, boolean> = {};
    resourceIds.forEach(id => {
      newSelection[id] = true;
    });
    setSelectedResources(newSelection);
  }, []);
  
  const clearSelection = useCallback(() => {
    setSelectedResources({});
  }, []);
  
  const getSelectedIds = useCallback(() => {
    return Object.entries(selectedResources)
      .filter(([, isSelected]) => isSelected)
      .map(([id]) => id);
  }, [selectedResources]);
  
  return {
    selectedResources,
    toggleSelection,
    selectAll,
    clearSelection,
    getSelectedIds,
    hasSelection: Object.values(selectedResources).some(Boolean),
    selectionCount: Object.values(selectedResources).filter(Boolean).length,
  };
}

export function useKnowledgeBaseOperations(knowledgeBaseId: string | null, orgId: string | null) {
  const { mutate } = useSWRConfig();
  
  const createAndSyncKnowledgeBase = useCallback(async (
    connectionId: string,
    resourceIds: string[],
    name: string,
    description: string
  ): Promise<KnowledgeBase> => {
    if (!orgId) {
      throw new Error('Organization ID is required');
    }
    const kb = await createKnowledgeBase(connectionId, resourceIds, name, description);
    
    await syncKnowledgeBase(kb.knowledge_base_id, orgId);
    
    mutate('connections');
    
    return kb;
  }, [orgId, mutate]);
  
  return {
    createAndSyncKnowledgeBase,
  };
}

export function usePrefetchResources(connectionId: string | null) {
  const { mutate } = useSWRConfig();
  
  const prefetchResource = useCallback((resourceId: string) => {
    if (!connectionId) return;
    
    const key = [`connections/${connectionId}/resources`, resourceId];
    
    mutate(
      key, 
      getConnectionResources(connectionId, resourceId),
      { revalidate: false, populateCache: true }
    );
  }, [connectionId, mutate]);
  
  return { prefetchResource };
}

export function useIndexingStatus() {
  const [indexingStatus, setIndexingStatus] = useState<Record<string, string>>({});
  
  const updateIndexingStatus = useCallback((resourceId: string, status: string) => {
    setIndexingStatus(prev => ({
      ...prev,
      [resourceId]: status
    }));
  }, []);
  
  const updateBulkIndexingStatus = useCallback((resourceIds: string[], status: string) => {
    setIndexingStatus(prev => {
      const updated = { ...prev };
      resourceIds.forEach(id => {
        updated[id] = status;
      });
      return updated;
    });
  }, []);
  
  return {
    indexingStatus,
    updateIndexingStatus,
    updateBulkIndexingStatus,
  };
}
