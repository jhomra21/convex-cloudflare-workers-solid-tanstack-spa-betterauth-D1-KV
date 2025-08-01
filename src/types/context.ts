export interface ContextItem {
  id: string;
  name: string;
  type: 'file' | 'folder' | 'agent';
  path?: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  // For agents, this indicates the agent type (image-generate, image-edit, etc.)
  agentType?: string;
}
