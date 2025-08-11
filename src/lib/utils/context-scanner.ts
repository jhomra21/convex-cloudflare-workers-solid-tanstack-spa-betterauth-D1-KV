import type { ContextItem } from '~/types/context';

// Convert agents to context items (only image agents for chat context)
export function convertAgentsToContextItems(agents: Array<{
  id: string;
  prompt: string;
  imageUrl?: string;
  type: string;
}>): ContextItem[] {
  // Filter to only include image agents (image-generate and image-edit)
  // Exclude voice-generate, video-generate, video-image-to-video, and ai-chat agents
  const imageAgentsOnly = agents.filter(agent => 
    agent.type === 'image-generate' || agent.type === 'image-edit'
  );
  
  return imageAgentsOnly.map(agent => ({
    id: `agent:${agent.id}`,
    name: agent.type.replace('-', ' '),
    type: 'agent' as const,
    description: agent.prompt,
    imageUrl: agent.imageUrl,
    icon: 'bot',
  }));
}

// Get all available context items (only agents)
export function getAllContextItems(agents: Array<{
  id: string;
  prompt: string;
  imageUrl?: string;
  type: string;
}> = []): ContextItem[] {
  return convertAgentsToContextItems(agents);
}

// Filter context items by search query
export function filterContextItems(items: ContextItem[], query: string): ContextItem[] {
  if (!query.trim()) return items;
  
  const searchTerm = query.toLowerCase();
  
  return items.filter(item => 
    item.name.toLowerCase().includes(searchTerm) ||
    item.description?.toLowerCase().includes(searchTerm)
  );
}
