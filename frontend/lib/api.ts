import { getAuthHeaders } from "./auth";
import { 
  ResourceResponse, 
  Connection, 
  KnowledgeBase, 
  OrganizationResponse, 
} from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.stack-ai.com";

export async function fetchWithAuth<T>(
  url: string, 
  options: RequestInit = {}
): Promise<T> {
  try {
    const authHeaders = await getAuthHeaders();
    
    const headers = {
      ...options.headers,
      ...authHeaders,
    };

    const response = await fetch(url, { 
      ...options, 
      headers,
      cache: options.method !== 'GET' ? 'no-store' : undefined,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }
    
    if (response.status === 204) {
      return null as T;
    }
    
    return response.json() as T;
  } catch (error) {
    throw error;
  }
}

export async function getCurrentOrgId(): Promise<string> {
  const data = await fetchWithAuth<OrganizationResponse>(
    `${API_BASE_URL}/organizations/me/current`
  );
  return data.org_id;
}

export async function getConnections(): Promise<Connection[]> {
  return fetchWithAuth<Connection[]>(
    `${API_BASE_URL}/connections?connection_provider=gdrive&limit=5`
  );
}

export async function getConnectionResources(
  connectionId: string, 
  resourceId?: string
): Promise<ResourceResponse> {
  const url = new URL(`${API_BASE_URL}/connections/${connectionId}/resources/children`);
  
  if (resourceId) {
    url.searchParams.append('resource_id', resourceId);
  }
  
  return fetchWithAuth<ResourceResponse>(url.toString());
}

export async function getKnowledgeBaseResources(
  knowledgeBaseId: string,
  resourcePath: string = '/'
): Promise<ResourceResponse> {
  const url = new URL(`${API_BASE_URL}/knowledge_bases/${knowledgeBaseId}/resources/children`);
  url.searchParams.append('resource_path', resourcePath);
  
  try {
    const response = await fetchWithAuth<ResourceResponse>(url.toString());
    return response;
  } catch (error) {
    console.error('Failed to get knowledge base resources', error);
    return { data: [], next_cursor: null, current_cursor: null };
  }
}

export async function createKnowledgeBase(
  connectionId: string,
  connectionSourceIds: string[],
  name: string,
  description: string
): Promise<KnowledgeBase> {
  const response = await fetchWithAuth<KnowledgeBase>(`${API_BASE_URL}/knowledge_bases`, {
    method: 'POST',
    body: JSON.stringify({
      connection_id: connectionId,
      connection_source_ids: connectionSourceIds,
      name,
      description,
      indexing_params: {
        ocr: false,
        unstructured: true,
        embedding_params: { embedding_model: "text-embedding-ada-002" },
        chunker_params: { chunk_size: 1500, chunk_overlap: 500, chunker_type: "sentence" },
      }
    })
  });
  
  return response;
}

export async function syncKnowledgeBase(
  knowledgeBaseId: string,
  orgId: string
): Promise<void> {
  return await fetchWithAuth<void>(
    `${API_BASE_URL}/knowledge_bases/sync/trigger/${knowledgeBaseId}/${orgId}`
  );
}

export async function getKnowledgeBaseStatus(
  knowledgeBaseId: string
): Promise<KnowledgeBase> {
  return await fetchWithAuth<KnowledgeBase>(
    `${API_BASE_URL}/knowledge_bases/${knowledgeBaseId}`
  );
}

export async function updateKnowledgeBase(
  knowledgeBaseId: string,
  updates: Partial<KnowledgeBase>
): Promise<KnowledgeBase> {
  return await fetchWithAuth<KnowledgeBase>(
    `${API_BASE_URL}/knowledge_bases/${knowledgeBaseId}`,
    {
      method: 'PUT',
      body: JSON.stringify(updates)
    }
  );
}

export async function createAndSyncKnowledgeBase(
  connectionId: string,
  connectionSourceIds: string[],
  name: string,
  description: string,
  orgId: string
): Promise<KnowledgeBase> {
  const knowledgeBase = await createKnowledgeBase(
    connectionId,
    connectionSourceIds,
    name,
    description
  );

  await syncKnowledgeBase(knowledgeBase.knowledge_base_id, orgId);
  
  return knowledgeBase;
}

export async function addResourcesToKnowledgeBase(
  knowledgeBaseId: string,
  connectionId: string,
  resourceIds: string[],
  orgId: string
): Promise<void> {
  try {
    const currentKb = await getKnowledgeBaseStatus(knowledgeBaseId);

    const currentSourceIds = currentKb.connection_source_ids || [];
    const newSourceIds = [...new Set([...currentSourceIds, ...resourceIds])];

    await updateKnowledgeBase(knowledgeBaseId, {
      ...currentKb,
      connection_source_ids: newSourceIds
    });
    
    await syncKnowledgeBase(knowledgeBaseId, orgId);
    
  } catch (error) {
    throw error;
  }
}

export async function addResourceToKnowledgeBase(
  knowledgeBaseId: string,
  connectionId: string,
  resourceId: string,
  orgId: string
): Promise<void> {
  return addResourcesToKnowledgeBase(knowledgeBaseId, connectionId, [resourceId], orgId);
}

export async function getKnowledgeBaseResourceStatus(
  knowledgeBaseId: string,
  resourceIds: string[]
): Promise<Record<string, string>> {
  try {
    const kb = await getKnowledgeBaseStatus(knowledgeBaseId);
    const sourceIds = kb.connection_source_ids || [];
    
    const statusMap: Record<string, string> = {};
    
    resourceIds.forEach(resourceId => {
      if (sourceIds.includes(resourceId)) {
        statusMap[resourceId] = 'indexed';
      }
    });
    
    return statusMap;
  } catch (error) {
    console.error('Failed to get knowledge base resource status:', error);
    return {};
  }
}

export async function createKnowledgeBaseFile(
  knowledgeBaseId: string,
  resourcePath: string,
  fileContent: Blob | File,
  fileName: string
): Promise<void> {
  const formData = new FormData();
  formData.append('resource_type', 'file');
  formData.append('resource_path', resourcePath);
  formData.append('file', fileContent, fileName);

  const authHeaders = await getAuthHeaders();
  const headers = {
    'Authorization': authHeaders.Authorization,
  };

  const response = await fetch(
    `${API_BASE_URL}/knowledge_bases/${knowledgeBaseId}/resources`, 
    {
      method: 'POST',
      headers,
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create file: ${response.status} - ${errorText}`);
  }

  return;
}

export async function removeResourcesFromKnowledgeBase(
  knowledgeBaseId: string,
  resourceIds: string[],
  orgId: string
): Promise<void> {
  try {
    const currentKb = await getKnowledgeBaseStatus(knowledgeBaseId);

    const currentSourceIds = currentKb.connection_source_ids || [];
    const newSourceIds = currentSourceIds.filter(id => !resourceIds.includes(id));

    await updateKnowledgeBase(knowledgeBaseId, {
      ...currentKb,
      connection_source_ids: newSourceIds
    });
 
    await syncKnowledgeBase(knowledgeBaseId, orgId);
  } catch (error) {
    throw error;
  }
}

export async function removeResourceFromKnowledgeBase(
  knowledgeBaseId: string,
  resourceId: string,
  orgId: string
): Promise<void> {
  return removeResourcesFromKnowledgeBase(knowledgeBaseId, [resourceId], orgId);
}
