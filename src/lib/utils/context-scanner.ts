import type { ContextItem } from '~/types/context';

// Mock file system data - in a real app, this would come from your file system API
const mockFileSystem = [
  // Source files
  { path: 'src/components/ImageCanvas.tsx', type: 'file' as const },
  { path: 'src/components/FloatingChatInterface.tsx', type: 'file' as const },
  { path: 'src/components/AIChatAgent.tsx', type: 'file' as const },
  { path: 'src/components/ui/button.tsx', type: 'file' as const },
  { path: 'src/components/ui/icon.tsx', type: 'file' as const },
  { path: 'src/lib/hooks/use-agent-management.ts', type: 'file' as const },
  { path: 'src/lib/utils/index.ts', type: 'file' as const },
  { path: 'src/routes/dashboard.tsx', type: 'file' as const },
  { path: 'src/types/agents.ts', type: 'file' as const },
  
  // Config files
  { path: 'package.json', type: 'file' as const },
  { path: 'tsconfig.json', type: 'file' as const },
  { path: 'vite.config.ts', type: 'file' as const },
  { path: 'tailwind.config.cjs', type: 'file' as const },
  { path: 'wrangler.jsonc', type: 'file' as const },
  
  // API files
  { path: 'api/images.ts', type: 'file' as const },
  { path: 'api/ai-chat.ts', type: 'file' as const },
  
  // Documentation
  { path: 'README.md', type: 'file' as const },
  
  // Folders
  { path: 'src', type: 'folder' as const },
  { path: 'src/components', type: 'folder' as const },
  { path: 'src/components/ui', type: 'folder' as const },
  { path: 'src/lib', type: 'folder' as const },
  { path: 'src/lib/hooks', type: 'folder' as const },
  { path: 'src/routes', type: 'folder' as const },
  { path: 'api', type: 'folder' as const },
  { path: 'convex', type: 'folder' as const },
];

// Get file extension
function getFileExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

// Get file name from path
function getFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

// Get file description based on type and content
function getFileDescription(path: string, type: 'file' | 'folder'): string {
  if (type === 'folder') {
    return `Folder • ${path}`;
  }

  const ext = getFileExtension(path);
  const descriptions: Record<string, string> = {
    'tsx': 'TypeScript React Component',
    'ts': 'TypeScript File',
    'js': 'JavaScript File',
    'jsx': 'React Component',
    'json': 'JSON Configuration',
    'md': 'Markdown Documentation',
    'css': 'Stylesheet',
    'scss': 'Sass Stylesheet',
    'html': 'HTML File',
    'py': 'Python File',
    'rs': 'Rust File',
    'go': 'Go File',
    'java': 'Java File',
    'cpp': 'C++ File',
    'c': 'C File',
    'php': 'PHP File',
    'rb': 'Ruby File',
    'swift': 'Swift File',
    'kt': 'Kotlin File',
    'dart': 'Dart File',
    'vue': 'Vue Component',
    'svelte': 'Svelte Component',
  };

  const description = descriptions[ext] || 'File';
  return `${description} • ${path}`;
}

// Get appropriate icon for file type
function getFileIcon(path: string, type: 'file' | 'folder'): string {
  if (type === 'folder') {
    return 'folder';
  }

  const ext = getFileExtension(path);
  const fileName = getFileName(path).toLowerCase();

  // Special files
  if (fileName === 'package.json') return 'package';
  if (fileName === 'readme.md') return 'book-open';
  if (fileName.includes('config')) return 'settings';
  if (fileName.includes('test') || fileName.includes('spec')) return 'flask';

  // By extension
  const iconMap: Record<string, string> = {
    'tsx': 'file-code',
    'ts': 'file-code',
    'js': 'file-code',
    'jsx': 'file-code',
    'json': 'braces',
    'md': 'file-text',
    'css': 'palette',
    'scss': 'palette',
    'html': 'globe',
    'py': 'file-code',
    'rs': 'file-code',
    'go': 'file-code',
    'java': 'file-code',
    'cpp': 'file-code',
    'c': 'file-code',
    'php': 'file-code',
    'rb': 'file-code',
    'swift': 'file-code',
    'kt': 'file-code',
    'dart': 'file-code',
    'vue': 'file-code',
    'svelte': 'file-code',
    'png': 'image',
    'jpg': 'image',
    'jpeg': 'image',
    'gif': 'image',
    'svg': 'image',
    'pdf': 'file-text',
    'doc': 'file-text',
    'docx': 'file-text',
    'xls': 'table',
    'xlsx': 'table',
    'zip': 'archive',
    'tar': 'archive',
    'gz': 'archive',
  };

  return iconMap[ext] || 'file';
}

// Convert file system items to context items
export function scanFileSystem(): ContextItem[] {
  return mockFileSystem.map(item => ({
    id: `file:${item.path}`,
    name: getFileName(item.path),
    type: item.type,
    path: item.path,
    description: getFileDescription(item.path, item.type),
    icon: getFileIcon(item.path, item.type),
  }));
}

// Convert agents to context items - only include image agents
export function convertAgentsToContextItems(agents: Array<{
  id: string;
  prompt: string;
  imageUrl?: string;
  type: string;
}>): ContextItem[] {
  // Filter to only include image agents (image-generate and image-edit)
  const imageAgents = agents.filter(agent => 
    agent.type === 'image-generate' || agent.type === 'image-edit'
  );
  
  return imageAgents.map(agent => ({
    id: `agent:${agent.id}`,
    name: agent.type.replace('-', ' '),
    type: 'agent' as const,
    description: agent.prompt,
    imageUrl: agent.imageUrl,
    icon: 'image',
    agentType: agent.type,
  }));
}

// Get all available context items - only image agents for now
export function getAllContextItems(agents: Array<{
  id: string;
  prompt: string;
  imageUrl?: string;
  type: string;
}> = []): ContextItem[] {
  // Only return image agents, no file system items
  const agentItems = convertAgentsToContextItems(agents);
  
  return agentItems;
}

// Filter context items by search query
export function filterContextItems(items: ContextItem[], query: string): ContextItem[] {
  if (!query.trim()) return items;
  
  const searchTerm = query.toLowerCase();
  
  return items.filter(item => 
    item.name.toLowerCase().includes(searchTerm) ||
    item.path?.toLowerCase().includes(searchTerm) ||
    item.description?.toLowerCase().includes(searchTerm)
  );
}
