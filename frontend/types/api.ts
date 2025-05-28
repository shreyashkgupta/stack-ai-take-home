export interface InodePath {
  path: string;
}

export interface DataloaderMetadata {
  last_modified_at?: string;
  last_modified_by?: string | null;
  created_at?: string;
  created_by?: string | null;
  web_url?: string;
  path?: string;
}

export interface Resource {
  knowledge_base_id: string;
  created_at: string;
  modified_at: string;
  indexed_at: string | null;
  inode_type: 'file' | 'directory';
  resource_id: string;
  inode_path: InodePath;
  dataloader_metadata: DataloaderMetadata;
  user_metadata: Record<string, unknown>;
  inode_id: string | null;
  content_hash?: string;
  content_mime?: string;
  size?: number;
  status?: 'resource' | 'indexed' | 'pending' | 'failed';
}

export interface ResourceResponse {
  data: Resource[];
  next_cursor: string | null;
  current_cursor: string | null;
}

export interface Connection {
  connection_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  connection_provider: string;
  connection_provider_data?: Record<string, unknown>;
  connection_provider_type?: string;
}

export interface EmbeddingParams {
  api?: string | null;
  base_url?: string | null;
  embedding_model: string;
  batch_size?: number;
  track_usage?: boolean;
  timeout?: number;
}

export interface ChunkerParams {
  chunk_size: number;
  chunk_overlap: number;
  chunker_type: string;
}

export interface IndexingParams {
  ocr: boolean;
  unstructured: boolean;
  embedding_params: EmbeddingParams;
  chunker_params: ChunkerParams;
}

export interface KnowledgeBase {
  knowledge_base_id: string;
  connection_id: string;
  created_at: string;
  updated_at: string;
  connection_source_ids: string[];
  website_sources: Record<string, unknown>[];
  connection_provider_type: string;
  is_empty: boolean;
  total_size: number;
  name: string;
  description: string;
  indexing_params: IndexingParams;
  cron_job_id: string | null;
  org_id: string;
  org_level_role: string | null;
  user_metadata_schema: Record<string, unknown> | null;
  dataloader_metadata_schema: Record<string, unknown> | null;
}

export interface OrganizationResponse {
  org_id: string;
}

export interface HierarchicalResource extends Resource {
  depth: number;
  isExpanded?: boolean;
  parentId?: string;
}
