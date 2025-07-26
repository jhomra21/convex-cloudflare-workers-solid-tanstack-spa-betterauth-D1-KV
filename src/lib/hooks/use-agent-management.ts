import { createSignal, createMemo, createEffect, batch, onCleanup } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
import { convexApi, useConvexQuery, useConvexMutation, useBatchConvexMutations } from '~/lib/convex';
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
  isSharedCanvas?: () => boolean;
  isCanvasOwner?: () => boolean;
}

export function useAgentManagement(props: UseAgentManagementProps) {
  const queryClient = useQueryClient();
  const { batch: batchMutations } = useBatchConvexMutations();

  // Query for canvas agents using TanStack Query + Convex
  const dbAgents = useConvexQuery(
    convexApi.agents.getCanvasAgents,
    () => props.canvas()?._id ? { canvasId: props.canvas()!._id } : null,
    () => ['agents', props.canvas()?._id]
  );

  // UI state
  const [activeAgentType, setActiveAgentType] = createSignal<'none' | 'generate' | 'edit' | 'voice' | 'video'>('none');

  // Agent tracking for new agent z-index management
  const [previousAgentIds, setPreviousAgentIds] = createSignal<Set<string>>(new Set());

  // Track agents pending deletion (waiting for animation to complete)
  const [pendingDeletions, setPendingDeletions] = createSignal<Set<string>>(new Set());
  const [pendingBatchDeletion, setPendingBatchDeletion] = createSignal<{
    shouldClearAll: boolean;
    agentsToRemove: string[];
    canvasId: string;
    userId?: string;
  } | null>(null);

  // Mutations with optimistic updates using new cleaner API
  const createAgentMutation = useConvexMutation(convexApi.agents.createAgent, {
    optimisticUpdate: (queryClient, variables) => {
      const canvasId = props.canvas()?._id;
      if (!canvasId) return;

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
        status: 'idle', // All agents start as idle
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
    },
    invalidateQueries: [['convex', 'agents']], // Auto-invalidation
    onSuccess: () => {
      // Additional success handling if needed
    }
  });

  const markAgentDeletingMutation = useConvexMutation(convexApi.agents.markAgentDeleting);
  const markAgentsDeletingMutation = useConvexMutation(convexApi.agents.markAgentsDeleting);
  const deleteAgentMutation = useConvexMutation(convexApi.agents.deleteAgent);

  const updateAgentTransformMutation = useConvexMutation(convexApi.agents.updateAgentTransform, {
    optimisticUpdate: (queryClient, variables) => {
      const canvasId = props.canvas()?._id;
      if (!canvasId) return;

      queryClient.setQueryData(['convex', 'agents', canvasId], (old: AgentData[] | undefined) =>
        old?.map(agent =>
          agent._id === variables.agentId
            ? { ...agent, positionX: variables.positionX, positionY: variables.positionY, width: variables.width, height: variables.height }
            : agent
        ) || []
      );
    },
    invalidateQueries: [['convex', 'agents']] // Auto-revert on error
  });

  const updateAgentPromptMutation = useConvexMutation(convexApi.agents.updateAgentPrompt);
  const connectAgentsMutation = useConvexMutation(convexApi.agents.connectAgents);
  const disconnectAgentsMutation = useConvexMutation(convexApi.agents.disconnectAgents);
  const clearCanvasAgentsMutation = useConvexMutation(convexApi.agents.clearCanvasAgents);

  const clearUserAgentsMutation = useConvexMutation(convexApi.agents.clearUserAgents);

  // Debounced saves for transforms to reduce API calls
  const debouncedSaves = new Map<string, number>();

  // Memoized agent processing with proper typing and validation
  const agents = createMemo((): Agent[] => {
    const rawAgentData = dbAgents.data;
    if (!rawAgentData) return [];

    // Convert and validate agent data, filtering out agents marked for deletion
    return rawAgentData
      .filter((rawAgent: AgentData): rawAgent is AgentData => isAgentData(rawAgent) && rawAgent.status !== 'deleting')
      .map((agentData: AgentData): Agent => agentDataToAgent(agentData));
  });

  // Separate memo for agents that are being deleted (for animation)
  const deletingAgents = createMemo((): Agent[] => {
    const rawAgentData = dbAgents.data;
    if (!rawAgentData) return [];

    // Only include agents marked for deletion
    return rawAgentData
      .filter((rawAgent: AgentData): rawAgent is AgentData => isAgentData(rawAgent) && rawAgent.status === 'deleting')
      .map((agentData: AgentData): Agent => agentDataToAgent(agentData));
  });

  // Combined agents list for rendering (includes deleting agents for animation)
  const allAgentsForRendering = createMemo((): Agent[] => {
    return [...agents(), ...deletingAgents()];
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

  // Update agent size (use optimistic mutation like drag operations)
  const updateAgentSize = (id: string, size: Size) => {
    const agent = agents().find(a => a.id === id);
    if (!agent) return;

    // Clear any existing debounced save for this agent
    const existingTimeout = debouncedSaves.get(id);
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
      debouncedSaves.delete(id);
    }

    // Use optimistic mutation for immediate feedback (like drag operations)
    updateAgentTransformMutation.mutate({
      agentId: id as any,
      positionX: agent.position.x,
      positionY: agent.position.y,
      width: size.width,
      height: size.height,
    });
  };

  // Update agent size and position in a single mutation (for resize operations)
  const updateAgentSizeAndPosition = (id: string, size: Size, position: Position) => {
    const agent = agents().find(a => a.id === id);
    if (!agent) return;

    // Clear any existing debounced save for this agent
    const existingTimeout = debouncedSaves.get(id);
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
      debouncedSaves.delete(id);
    }

    // Single mutation to avoid conflicts between size and position updates
    updateAgentTransformMutation.mutate({
      agentId: id as any,
      positionX: position.x,
      positionY: position.y,
      width: size.width,
      height: size.height,
    });
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

  // Remove an agent with cross-client exit animation
  const removeAgent = async (id: string) => {
    try {
      // Step 1: Mark agent as deleting (triggers animation across all clients)
      await markAgentDeletingMutation.mutate({
        agentId: id as any,
      });

      // Step 2: Track this agent as pending deletion
      setPendingDeletions(prev => new Set([...prev, id]));
    } catch (error) {
      console.error('Failed to mark agent for deletion:', error);
    }
  };

  // Handle animation completion for single agent deletion
  const handleAgentAnimationEnd = async (id: string) => {
    // Only proceed if this agent is actually pending deletion
    if (!pendingDeletions().has(id)) return;

    try {
      await deleteAgentMutation.mutate({
        agentId: id as any,
      });

      // Remove from pending deletions
      setPendingDeletions(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      console.error('Failed to delete agent:', error);
      // Remove from pending even on error to prevent stuck state
      setPendingDeletions(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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

  // Clear agents from canvas with cross-client exit animations
  const clearCanvas = async () => {
    if (!props.canvas()?._id || !props.userId()) return;

    const currentAgents = agents();
    const isShared = props.isSharedCanvas?.() || false;
    const isOwner = props.isCanvasOwner?.() || false;

    // Determine what to clear based on user role
    const shouldClearAll = !isShared || isOwner;

    // Filter agents based on permissions
    const agentsToRemove = shouldClearAll
      ? currentAgents
      : currentAgents.filter(a => a.userId === props.userId());

    if (agentsToRemove.length === 0) return;

    try {
      // Step 1: Mark all agents for deletion atomically (smooth simultaneous animation)
      await markAgentsDeletingMutation.mutate({
        canvasId: props.canvas()!._id,
        agentIds: shouldClearAll ? undefined : agentsToRemove.map(a => a.id as any),
        userId: shouldClearAll ? undefined : props.userId()!,
      });

      // Step 2: Set up batch deletion state to handle when all animations complete
      setPendingBatchDeletion({
        shouldClearAll,
        agentsToRemove: agentsToRemove.map(a => a.id),
        canvasId: props.canvas()!._id,
        userId: props.userId()!,
      });

      // Track all agents as pending deletion
      setPendingDeletions(prev => new Set([...prev, ...agentsToRemove.map(a => a.id)]));

    } catch (error) {
      console.error('Failed to mark agents for deletion:', error);
    }
  };

  // Handle batch deletion when all animations complete
  const handleBatchAnimationEnd = async (completedAgentId: string) => {
    const batchInfo = pendingBatchDeletion();
    if (!batchInfo) return;

    // Remove this agent from pending deletions
    setPendingDeletions(prev => {
      const next = new Set(prev);
      next.delete(completedAgentId);
      return next;
    });

    // Check if all agents in this batch have completed their animations
    const remainingPendingInBatch = batchInfo.agentsToRemove.filter(id =>
      pendingDeletions().has(id) && id !== completedAgentId
    );

    // If this was the last agent in the batch, perform the batch deletion
    if (remainingPendingInBatch.length === 0) {
      try {
        if (batchInfo.shouldClearAll) {
          // Clear all agents (owner or own canvas) - single operation
          await clearCanvasAgentsMutation.mutate({
            canvasId: batchInfo.canvasId as any,
          });
        } else {
          // For individual agent deletion, use batch operations for better performance
          if (batchInfo.agentsToRemove.length > 5) {
            // Use batch for many agents
            const deleteOperations = batchInfo.agentsToRemove.map(agentId =>
              () => deleteAgentMutation.mutateAsync({ agentId: agentId as any })
            );
            await batchMutations(deleteOperations);
          } else {
            // Use single operation for few agents
            await clearUserAgentsMutation.mutate({
              canvasId: batchInfo.canvasId as any,
              userId: batchInfo.userId!,
            });
          }
        }

        // Clear batch deletion state
        setPendingBatchDeletion(null);
      } catch (error) {
        console.error('Failed to clear canvas:', error);
        // Clear batch state even on error to prevent stuck state
        setPendingBatchDeletion(null);
      }
    }
  };

  // Watch for new agents to manage z-index
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

    // Update previous agent IDs
    setPreviousAgentIds(currentAgentIds as Set<string>);
  });

  // Unified animation end handler
  const handleAnimationEnd = async (agentId: string) => {
    // Handle batch deletion first (it also removes from pending)
    await handleBatchAnimationEnd(agentId);

    // Handle single agent deletion if not part of batch
    if (pendingDeletions().has(agentId) && !pendingBatchDeletion()) {
      await handleAgentAnimationEnd(agentId);
    }
  };

  // Cleanup timeouts on unmount
  onCleanup(() => {
    // Clear all debounced save timeouts
    debouncedSaves.forEach(timeout => clearTimeout(timeout));
    debouncedSaves.clear();

    if (promptDebounceHandle) {
      clearTimeout(promptDebounceHandle);
    }

    // Clear pending deletion state
    setPendingDeletions(new Set<string>());
    setPendingBatchDeletion(null);
  });

  return {
    agents: allAgentsForRendering, // Use combined list for rendering
    connectedAgentPairs,
    availableAgents,
    activeAgentType,
    deletingAgents, // Expose deleting agents for animation checks
    addAgent,
    removeAgent,
    connectAgents,
    disconnectAgent,
    clearCanvas,
    updateAgentPosition,
    updateAgentSize,
    updateAgentSizeAndPosition,
    updateAgentPrompt,
    handleAnimationEnd, // Expose animation end handler
  };
}
