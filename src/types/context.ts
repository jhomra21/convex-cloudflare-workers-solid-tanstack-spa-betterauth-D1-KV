export interface ContextItem {
  id: string;
  name: string;
  type: 'file' | 'folder' | 'agent';
  path?: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
}
