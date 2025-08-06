import type { ContextItem } from '~/types/context';

// Convert agents to context items
export function convertAgentsToContextItems(agents: Array<{
  id: string;
  prompt: string;
  imageUrl?: string;
  type: string;
}>): ContextItem[] {
  return agents.map(agent => ({
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
