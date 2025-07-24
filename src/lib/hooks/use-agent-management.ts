import { createSignal, createMemo, createEffect, batch, onCleanup } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
import { convexApi, useConvexQuery, useConvexMutation } from '~/lib/convex';
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

export interface UseAgentManagementProps {
  canvas: () => any;
  userId: () => string | null;
  userName: () => string;
  viewport: () => ViewportState;
}

export function useAgentManagement(props: UseAgentManagementProps) {
  const queryClient = useQueryClient();

  // Query for canvas agents using TanStack Query + Convex
  const dbAgents = useConvexQuery(
    convexApi.agents.getCanvasAgents,
    () => props.canvas()?._id ? { canvasId: props.canvas()!._id } : null,
    () => ['agents', props.canvas()?._id]
  );

  // UI state
  const [activeAgentType, setActiveAgentType] = createSignal<'none' | 'generate' | 'edit' | 'voice' | 'video'>('none');

  // Animation state management
  const [exitingAgents, setExitingAgents] = createSignal<Set<string>>(new Set());

  // Agent tracking for new agent z-index management
  const [previousAgentIds, setPreviousAgentIds] = createSignal<Set<string>>(new Set());

  // Mutations with optimistic updates
  const createAgentMutation = useConvexMutation(convexApi.agents.createAgent, {
    onMutate: async (variables) => {
      const canvasId = props.canvas()?._id;
      if (!canvasId) return;

      await queryClient.cancelQueries({ queryKey: ['convex', 'agents', canvasId] });
      const previousAgents = queryClient.getQueryData(['convex', 'agents', canvasId]);

      // Create optimistic agent with processing status for image generation
      const optimisticAgent: AgentData = {
        _id: crypto.randomUUID() as any, // Temporary ID
        _creationTime: Date.now(),
        canvasId: canvasId as any,
        userId: variables.userId,
        userName: variables.userName,
        prompt: variables.prompt,
        positionX: variables.positionX,
        positionY: variables.positionY,
        width: variables.width,
        height: variables.height,
        type: variables.type || 'image-generate',
        status: variables.type?.includes('image') ? 'processing' : 'idle', // Set processing for image agents
        model: 'normal', // Default model
        imageUrl: undefined,
        audioUrl: undefined,
        videoUrl: undefined,
        uploadedImageUrl: variables.uploadedImageUrl || undefined,
        connectedAgentId: variables.connectedAgentId || undefined,
        voice: variables.voice || undefined,
        audioSampleUrl: undefined,
        requestId: undefined,
        activeImageUrl: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      queryClient.setQueryData(['convex', 'agents', canvasId], (old: AgentData[] | undefined) =>
        old ? [...old, optimisticAgent] : [optimisticAgent]
      );

      return { previousAgents, canvasId };
    },
    onError: (error, variables, context) => {
      if (context?.previousAgents && context?.canvasId) {
        queryClient.setQueryData(['convex', 'agents', context.canvasId], context.previousAgents);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['convex', 'agents'] });
    }
  });

  const deleteAgentMutation = useConvexMutation(convexApi.agents.deleteAgent, {
    onMutate: async (variables) => {
      const canvasId = props.canvas()?._id;
      if (!canvasId) return;

      await queryClient.cancelQueries({ queryKey: ['convex', 'agents', canvasId] });
      const previousAgents = queryClient.getQueryData(['convex', 'agents', canvasId]);

      queryClient.setQueryData(['convex', 'agents', canvasId], (old: AgentData[] | undefined) =>
        old?.filter(agent => agent._id !== variables.agentId) || []
      );

      return { previousAgents, canvasId };
    },
    onError: (error, variables, context) => {
      if (context?.previousAgents && context?.canvasId) {
        queryClient.setQueryData(['convex', 'agents', context.canvasId], context.previousAgents);
      }
    }
  });

  const updateAgentTransformMutation = useConvexMutation(convexApi.agents.updateAgentTransform, {
    onMutate: async (variables) => {
      const canvasId = props.canvas()?._id;
      if (!canvasId) return;

      await queryClient.cancelQueries({ queryKey: ['convex', 'agents', canvasId] });
      const previousAgents = queryClient.getQueryData(['convex', 'agents', canvasId]);

      queryClient.setQueryData(['convex', 'agents', canvasId], (old: AgentData[] | undefined) =>
        old?.map(agent =>
          agent._id === variables.agentId
            ? { ...agent, positionX: variables.positionX, positionY: variables.positionY, width: variables.width, height: variables.height }
            : agent
        ) || []
      );

      return { previousAgents, canvasId };
    },
    onError: (error, variables, context) => {
      if (context?.previousAgents && context?.canvasId) {
        queryClient.setQueryData(['convex', 'agents', context.canvasId], context.previousAgents);
      }
    }
  });

  const updateAgentPromptMutation = useConvexMutation(convexApi.agents.updateAgentPrompt);
  const connectAgentsMutation = useConvexMutation(convexApi.agents.connectAgents);
  const disconnectAgentsMutation = useConvexMutation(convexApi.agents.disconnectAgents);
  const clearCanvasAgentsMutation = useConvexMutation(convexApi.agents.clearCanvasAgents);

  // Debounced saves for transforms to reduce API calls
  const debouncedSaves = new Map<string, number>();

  // Memoized agent processing with proper typing and validation
  const agents = createMemo((): Agent[] => {
    const rawAgentData = dbAgents.data;
    if (!rawAgentData) return [];

    // Convert and validate agent data
    return rawAgentData
      .filter((rawAgent: AgentData): rawAgent is AgentData => isAgentData(rawAgent))
      .map((agentData: AgentData): Agent => agentDataToAgent(agentData));
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

  // Update agent position (immediate save for drag end)
  const updateAgentPosition = (id: string, position: Position) => {
    const agent = agents().find(a => a.id === id);
    if (!agent) return;

    updateAgentTransformMutation.mutate({
      agentId: id as any,
      positionX: position.x,
      positionY: position.y,
      width: agent.size.width,
      height: agent.size.height,
    });
  };

  // Update agent size (debounced save for resize operations)
  const updateAgentSize = (id: string, size: Size) => {
    const agent = agents().find(a => a.id === id);
    if (!agent) return;

    // Clear existing timeout
    const existingTimeout = debouncedSaves.get(id);
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = window.setTimeout(() => {
      updateAgentTransformMutation.mutate({
        agentId: id as any,
        positionX: agent.position.x,
        positionY: agent.position.y,
        width: size.width,
        height: size.height,
      });
      debouncedSaves.delete(id);
    }, 180);

    debouncedSaves.set(id, timeout);
  };

  // Debounced prompt update to minimise writes
  let promptDebounceHandle: any;
  const updateAgentPrompt = (id: string, prompt: string) => {
    if (promptDebounceHandle) clearTimeout(promptDebounceHandle);
    promptDebounceHandle = setTimeout(() => {
      updateAgentPromptMutation.mutate({
        agentId: id as any,
        prompt,
      });
    }, 200);
  };

  // Create a new agent
  const addAgent = async (prompt?: string, type: 'image-generate' | 'image-edit' | 'voice-generate' | 'video-generate' = 'image-generate') => {
    if (!props.canvas()?._id || !props.userId()) return;

    // Set the active agent type for UI cues only
    setActiveAgentType(
      type === 'image-generate' ? 'generate' :
        type === 'image-edit' ? 'edit' :
          type === 'voice-generate' ? 'voice' :
            type === 'video-generate' ? 'video' : 'none'
    );

    // Smart positioning using shared utilities
    const canvasEl = getCanvasElement();
    const agentSize: Size = type === 'video-generate'
      ? { width: 320, height: 450 } // Video agents need more height for controls
      : { width: 320, height: 384 }; // Default size for other agents
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
        userName: props.userName(),
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

      await createAgentMutation.mutate(createParams);

    } catch (error) {
      console.error('Failed to create agent:', error);
      toast.error('Failed to create agent');
    } finally {
      // Reset active agent type
      setActiveAgentType('none');
    }
  };

  // Remove an agent with exit animation
  const removeAgent = async (id: string) => {
    try {
      // Start exit animation first
      setExitingAgents(prev => new Set(prev).add(id));

      // Wait for exit animation to complete, then delete
      setTimeout(async () => {
        try {
          await deleteAgentMutation.mutate({
            agentId: id as any,
          });
        } catch (error) {
          console.error('Failed to delete agent:', error);
        } finally {
          // Clear animation state
          setExitingAgents(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
        }
      }, 200); // Exit animation duration
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  // Connect two agents
  const connectAgents = async (sourceAgentId: string, targetAgentId: string) => {
    try {
      await connectAgentsMutation.mutate({
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
      await disconnectAgentsMutation.mutate({
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
          await clearCanvasAgentsMutation.mutate({
            canvasId: props.canvas()!._id,
          });
        } catch (error) {
          console.error('Failed to clear canvas:', error);
        } finally {
          // Clear animation state
          setExitingAgents(new Set<string>());
        }
      }, 200); // Match exit animation duration

    } catch (error) {
      console.error('Failed to clear canvas:', error);
    }
  };

  // Watch for new agents and clean up removed ones
  createEffect(() => {
    const currentAgents = dbAgents.data;
    if (!currentAgents) return;

    // Create a stable set of current agent IDs
    const currentAgentIds = new Set(currentAgents.map((a: AgentData) => a._id));
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
      setPreviousAgentIds(currentAgentIds as Set<string>);
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
