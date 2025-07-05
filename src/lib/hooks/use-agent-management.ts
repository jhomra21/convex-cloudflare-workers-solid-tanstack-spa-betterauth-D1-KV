import { createSignal, createMemo, createEffect, batch, onCleanup } from 'solid-js';
import { convexApi, useMutation } from '~/lib/convex';
import { toast } from 'solid-sonner';
import { 
  getCanvasElement,
  type Position,
  type Size
} from '~/lib/utils/canvas-coordinates';
import {
  type AgentData,
  type Agent,
  type AvailableAgent,
  agentDataToAgent,
  isAgentData,
} from '~/types/agents';
import { type ViewportState } from './use-viewport';
import { useOptimisticUpdates } from './use-optimistic-updates';

export interface UseAgentManagementProps {
  canvas: () => any;
  userId: () => string | null;
  dbAgents: any;
  viewport: () => ViewportState;
}

export function useAgentManagement(props: UseAgentManagementProps) {
  // Use optimistic updates hook
  const {
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
    clearOptimisticTransform,
  } = useOptimisticUpdates();

  // UI state
  const [activeAgentType, setActiveAgentType] = createSignal<'none' | 'generate' | 'edit' | 'voice'>('none');
  
  // Animation state management
  const [exitingAgents, setExitingAgents] = createSignal<Set<string>>(new Set());
  
  // Agent tracking for new agent z-index management
  const [previousAgentIds, setPreviousAgentIds] = createSignal<Set<string>>(new Set());

  // Mutations
  const createAgentMutation = useMutation();
  const deleteAgentMutation = useMutation();
  const updateAgentTransformMutation = useMutation();
  const updateAgentPromptMutation = useMutation();
  const connectAgentsMutation = useMutation();
  const disconnectAgentsMutation = useMutation();
  const clearCanvasAgentsMutation = useMutation();

  // Debounced saves for transforms to reduce API calls
  const debouncedSaves = new Map<string, number>();

  // Memoized agent processing with proper typing and validation
  const agents = createMemo((): Agent[] => {
    const rawAgentData = props.dbAgents.data();
    if (!rawAgentData) return [];
    
    const positions = optimisticPositions();
    const sizes = optimisticSizes();
    
    // Validate and convert agent data with type safety
    // Merge DB agents with optimistic creations and filter out optimistic deletions
    const optimisticRemoved = optimisticDeletedAgentIds();
    const optimisticAdds = optimisticNewAgents();

    const baseAgents = rawAgentData
      .filter((rawAgent): rawAgent is AgentData => isAgentData(rawAgent))
      .filter((a) => !optimisticRemoved.has(a._id));

    // Convert base agents with optimistic updates
    const processedBaseAgents = baseAgents.map((agentData: AgentData): Agent => {
      // Use optimistic position/size if available, otherwise use database values
      const optimisticPos = positions.get(agentData._id);
      const optimisticSize = sizes.get(agentData._id);
      
      // Convert to frontend Agent interface with optimistic updates
      const agent = agentDataToAgent(agentData);
      
      // Apply optimistic updates if they exist
      if (optimisticPos) {
        agent.position = optimisticPos;
      }
      if (optimisticSize) {
        agent.size = optimisticSize;
      }
      
      return agent;
    });

    // Convert optimistic agents directly (they're already in Agent format)
    const processedOptimisticAgents = optimisticAdds;

    return [...processedBaseAgents, ...processedOptimisticAgents];
  });

  // Memoized connection pairs calculation - only recalculates when agents change
  const connectedAgentPairs = createMemo(() => {
    const agentsList = agents();
    const result = [];
    
    // Create a map for faster lookups
    const agentMap = new Map(agentsList.map(agent => [agent.id, agent]));
    
    for (const agent of agentsList) {
      if (agent.type === 'image-edit' && agent.connectedAgentId) {
        const sourceAgent = agentMap.get(agent.connectedAgentId);
        if (sourceAgent) {
          result.push({
            source: sourceAgent,
            target: agent
          });
        }
      }
    }
    
    return result;
  });

  // Memoize available agents list to prevent recreation on every render
  const availableAgents = createMemo((): AvailableAgent[] => 
    agents().map((a: Agent): AvailableAgent => ({
      id: a.id,
      prompt: a.prompt,
      imageUrl: a.generatedImage,
      type: a.type
    }))
  );

  // Save transform (position and size) to database with debounce
  const saveAgentTransform = (
    agentId: string, 
    position: Position, 
    size: Size
  ) => {
    if (!props.canvas()?._id) return;
    
    // Clear existing timeout
    const existingTimeout = debouncedSaves.get(agentId);
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }
    
    // Set new timeout
    const timeout = window.setTimeout(async () => {
      try {
        await updateAgentTransformMutation.mutate(convexApi.agents.updateAgentTransform, {
          agentId: agentId as any,
          positionX: position.x,
          positionY: position.y,
          width: size.width,
          height: size.height,
        });
        
        // Clear optimistic updates once saved to Convex
        clearOptimisticTransform(agentId);
      } catch (error) {
        console.error('Failed to save agent transform:', error);
      }
      
      debouncedSaves.delete(agentId);
    }, 150);
    
    debouncedSaves.set(agentId, timeout);
  };

  // Update agent position with optimistic update
  const updateAgentPosition = (id: string, position: Position) => {
    updateOptimisticPosition(id, position);
    
    const agent = agents().find(a => a.id === id);
    if (agent) {
      saveAgentTransform(id, position, agent.size);
    }
  };

  // Update agent size with optimistic update
  const updateAgentSize = (id: string, size: Size) => {
    updateOptimisticSize(id, size);
    
    const agent = agents().find(a => a.id === id);
    if (agent) {
      saveAgentTransform(id, agent.position, size);
    }
  };

  // Debounced prompt update to minimise writes
  let promptDebounceHandle: any;
  const updateAgentPrompt = (id: string, prompt: string) => {
    if (promptDebounceHandle) clearTimeout(promptDebounceHandle);
    promptDebounceHandle = setTimeout(async () => {
      try {
        await updateAgentPromptMutation.mutate(convexApi.agents.updateAgentPrompt, {
          agentId: id as any,
          prompt,
        });
      } catch (error) {
        console.error('Failed to update agent prompt:', error);
      }
    }, 200);
  };

  // Create a new agent
  const addAgent = async (prompt?: string, type: 'image-generate' | 'image-edit' | 'voice-generate' = 'image-generate') => {
    if (!props.canvas()?._id || !props.userId()) return;
    
    // Set the active agent type for UI cues only
    setActiveAgentType(
      type === 'image-generate' ? 'generate' : 
      type === 'image-edit' ? 'edit' : 
      type === 'voice-generate' ? 'voice' : 'none'
    );
    
    // Smart positioning using shared utilities
    const canvasEl = getCanvasElement();
    const agentSize: Size = { width: 320, height: 384 };
    const padding = 20;

    let newPosition: Position = { x: padding, y: padding };

    if (canvasEl) {
      const vp = props.viewport();
      const safeLeft = (-vp.tx) / vp.zoom;
      const safeTop = (-vp.ty) / vp.zoom;
      const safeWidth = canvasEl.clientWidth / vp.zoom;
      const safeHeight = canvasEl.clientHeight / vp.zoom;

      const stepX = agentSize.width + padding;
      const stepY = agentSize.height + padding;

      const existing = agents();

      let placed = false;
      outer: for (let row = 0; row < 100; row++) {
        for (let col = 0; col < 100; col++) {
          const x = safeLeft + col * stepX;
          const y = safeTop + row * stepY;

          if (x + agentSize.width > safeLeft + safeWidth) break; // next row
          if (y + agentSize.height > safeTop + safeHeight) break; // out of visible bounds

          // collision check
          let collide = false;
          for (const ag of existing) {
            if (
              x + agentSize.width + padding <= ag.position.x ||
              x >= ag.position.x + ag.size.width + padding ||
              y + agentSize.height + padding <= ag.position.y ||
              y >= ag.position.y + ag.size.height + padding
            ) {
              continue; // no overlap with this agent
            }
            collide = true;
            break;
          }

          if (!collide) {
            newPosition = { x, y };
            placed = true;
            break outer;
          }
        }
      }

      if (!placed) {
        // fallback centre of viewport
        newPosition = {
          x: safeLeft + safeWidth / 2 - agentSize.width / 2,
          y: safeTop + safeHeight / 2 - agentSize.height / 2,
        };
      }
    }
    
    try {
      // Create in Convex
      const createParams: any = {
        canvasId: props.canvas()!._id,
        userId: props.userId()!,
        prompt: prompt || '',
        positionX: newPosition.x,
        positionY: newPosition.y,
        width: agentSize.width,
        height: agentSize.height,
        type,
      };

      // Add voice-specific fields for voice agents
      if (type === 'voice-generate') {
        createParams.voice = 'Aurora'; // Default voice
      }

      // Optimistic insert
      const tempId = crypto.randomUUID();
      const tempAgent: Agent = {
        id: tempId,
        prompt: createParams.prompt,
        type,
        position: newPosition,
        size: agentSize,
      } as any;

      addOptimisticAgent(tempAgent);

      try {
        await createAgentMutation.mutate(convexApi.agents.createAgent, createParams);
      } finally {
        // Remove temp once Convex snapshot arrives
        setTimeout(() => {
          removeOptimisticAgent(tempId);
        }, 250);
      }
      
    } catch (error) {
      console.error('Failed to create agent:', error);
      toast.error('Failed to create agent');
    } finally {
      // Reset active agent type
      setActiveAgentType('none');
    }
  };

  // Remove an agent with optimistic UI and exit animation
  const removeAgent = async (id: string) => {
    try {
      // Start exit animation first
      setExitingAgents(prev => new Set(prev).add(id));
      
      // Wait for exit animation to complete, then hide
      setTimeout(() => {
        batch(() => {
          markAsOptimisticallyDeleted(id);
          setExitingAgents(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
        });
      }, 200); // Exit animation duration

      try {
        await deleteAgentMutation.mutate(convexApi.agents.deleteAgent, {
          agentId: id as any,
        });
      } catch (error) {
        console.error('Failed to delete agent:', error);
        // Rollback - restore the agent and clear animation state
        batch(() => {
          restoreOptimisticallyDeleted(id);
          setExitingAgents(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
        });
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  // Connect two agents
  const connectAgents = async (sourceAgentId: string, targetAgentId: string) => {
    try {
      await connectAgentsMutation.mutate(convexApi.agents.connectAgents, {
        sourceAgentId: sourceAgentId as any,
        targetAgentId: targetAgentId as any,
      });
    } catch (error) {
      console.error('Failed to connect agents:', error);
    }
  };

  // Disconnect an agent
  const disconnectAgent = async (agentId: string) => {
    try {
      await disconnectAgentsMutation.mutate(convexApi.agents.disconnectAgents, {
        agentId: agentId as any,
      });
    } catch (error) {
      console.error('Failed to disconnect agent:', error);
    }
  };

  // Clear all agents from canvas with exit animations
  const clearCanvas = async () => {
    if (!props.canvas()?._id) return;
    
    const currentAgents = agents();
    if (currentAgents.length === 0) return;
    
    try {
      // Start exit animations for all agents
      const agentIds = currentAgents.map(a => a.id);
      setExitingAgents(new Set(agentIds));
      
      // Wait for exit animations to complete, then clear
      setTimeout(async () => {
        try {
          await clearCanvasAgentsMutation.mutate(convexApi.agents.clearCanvasAgents, {
            canvasId: props.canvas()!._id,
          });
        } catch (error) {
          console.error('Failed to clear canvas:', error);
          // Rollback animation state on error
          setExitingAgents(new Set<string>());
        }
      }, 200); // Match exit animation duration
      
    } catch (error) {
      console.error('Failed to clear canvas:', error);
    }
  };

  // Watch for new agents and clean up removed ones
  createEffect(() => {
    const currentAgents = props.dbAgents.data();
    if (!currentAgents) return;
    
    // Create a stable set of current agent IDs
    const currentAgentIds = new Set(currentAgents.map((a: any) => a._id));
    const prevIds = previousAgentIds();
    
    // Only proceed if agent IDs actually changed (not just agent data)
    const prevIdsArray = Array.from(prevIds).sort();
    const currentIdsArray = Array.from(currentAgentIds).sort();
    const idsChanged = prevIdsArray.length !== currentIdsArray.length || 
                       prevIdsArray.some((id, i) => id !== currentIdsArray[i]);
    
    if (!idsChanged) return;
    
    // Find removed agents (cleanup any lingering animation states)  
    const removedAgentIds = prevIdsArray.filter(id => !currentAgentIds.has(id));
    
    // Use batch to group all state updates and prevent intermediate renders
    batch(() => {
      // Handle removed agents - cleanup animation states
      if (removedAgentIds.length > 0) {
        setExitingAgents(prev => {
          const newSet = new Set(prev);
          removedAgentIds.forEach(id => newSet.delete(id));
          return newSet;
        });
      }
      
      // Update previous agent IDs last
      setPreviousAgentIds(currentAgentIds);
    });
  });

  // Cleanup timeouts on unmount
  onCleanup(() => {
    // Clear all debounced save timeouts
    debouncedSaves.forEach(timeout => clearTimeout(timeout));
    debouncedSaves.clear();
    
    if (promptDebounceHandle) {
      clearTimeout(promptDebounceHandle);
    }
  });

  return {
    agents,
    connectedAgentPairs,
    availableAgents,
    activeAgentType,
    exitingAgents,
    addAgent,
    removeAgent,
    connectAgents,
    disconnectAgent,
    clearCanvas,
    updateAgentPosition,
    updateAgentSize,
    updateAgentPrompt,
  };
}
