import { createSignal, batch } from 'solid-js';
import { type Position, type Size } from '~/lib/utils/canvas-coordinates';
import { type Agent } from '~/types/agents';

export function useOptimisticUpdates() {
  // Agent transform state (position and size during drag/resize operations)
  const [optimisticPositions, setOptimisticPositions] = createSignal<Map<string, Position>>(new Map());
  const [optimisticSizes, setOptimisticSizes] = createSignal<Map<string, Size>>(new Map());
  
  // Optimistic create / delete
  const [optimisticNewAgents, setOptimisticNewAgents] = createSignal<Agent[]>([]);
  const [optimisticDeletedAgentIds, setOptimisticDeletedAgentIds] = createSignal<Set<string>>(new Set());

  // Update optimistic position
  const updateOptimisticPosition = (agentId: string, position: Position) => {
    setOptimisticPositions(prev => new Map(prev).set(agentId, position));
  };

  // Update optimistic size
  const updateOptimisticSize = (agentId: string, size: Size) => {
    setOptimisticSizes(prev => new Map(prev).set(agentId, size));
  };

  // Add optimistic agent
  const addOptimisticAgent = (agent: Agent) => {
    setOptimisticNewAgents(prev => [...prev, agent]);
  };

  // Remove optimistic agent
  const removeOptimisticAgent = (agentId: string) => {
    setOptimisticNewAgents(prev => prev.filter(a => a.id !== agentId));
  };

  // Mark agent as optimistically deleted
  const markAsOptimisticallyDeleted = (agentId: string) => {
    setOptimisticDeletedAgentIds(prev => new Set(prev).add(agentId));
  };

  // Restore optimistically deleted agent
  const restoreOptimisticallyDeleted = (agentId: string) => {
    setOptimisticDeletedAgentIds(prev => {
      const copy = new Set(prev);
      copy.delete(agentId);
      return copy;
    });
  };

  // Clear optimistic position after save
  const clearOptimisticPosition = (agentId: string) => {
    setOptimisticPositions(prev => {
      const newMap = new Map(prev);
      newMap.delete(agentId);
      return newMap;
    });
  };

  // Clear optimistic size after save
  const clearOptimisticSize = (agentId: string) => {
    setOptimisticSizes(prev => {
      const newMap = new Map(prev);
      newMap.delete(agentId);
      return newMap;
    });
  };

  // Clear both optimistic position and size
  const clearOptimisticTransform = (agentId: string) => {
    batch(() => {
      clearOptimisticPosition(agentId);
      clearOptimisticSize(agentId);
    });
  };

  return {
    optimisticPositions,
    optimisticSizes,
    optimisticNewAgents,
    optimisticDeletedAgentIds,
    updateOptimisticPosition,
    updateOptimisticSize,
    addOptimisticAgent,
    removeOptimisticAgent,
    markAsOptimisticallyDeleted,
    restoreOptimisticallyDeleted,
    clearOptimisticPosition,
    clearOptimisticSize,
    clearOptimisticTransform,
  };
}
