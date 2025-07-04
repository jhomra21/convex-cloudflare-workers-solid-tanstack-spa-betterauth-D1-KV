import { createSignal, For, Show, createEffect, createMemo, onCleanup, batch } from 'solid-js';
import { MemoizedImageAgent } from './MemoizedImageAgent';
import { MemoizedVoiceAgent } from './MemoizedVoiceAgent';
import { AgentConnection } from './AgentConnection';
import { AgentToolbar } from './AgentToolbar';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { cn } from '~/lib/utils';
import { convexApi, useQuery, useMutation } from '~/lib/convex';
import { useCurrentUserId } from '~/lib/auth-actions';
import { useCanvasDrag } from '~/lib/hooks/use-canvas-drag';
import { useCanvasResize } from '~/lib/hooks/use-canvas-resize';
import { ErrorBoundary } from '~/components/ErrorBoundary';
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

// Agent class is now replaced by the Agent interface from ~/types/agents

export interface ImageCanvasProps {
  class?: string;
  activeCanvasId?: string | null; // null = use default canvas, string = use specific canvas
  onCanvasDisabled?: () => void; // Callback when shared canvas becomes unavailable
}

export function ImageCanvas(props: ImageCanvasProps) {
  // =============================================
  // State Management
  // =============================================
  
  // Authentication state
  const userId = useCurrentUserId();
  const [hasRedirected, setHasRedirected] = createSignal(false);
  
  // Viewport state management
  const [viewport, setViewport] = createSignal({
    x: 0,    // Pan X position (pixels)
    y: 0,    // Pan Y position (pixels)
    zoom: 1.0 // Zoom level (0.5 to 2.0)
  });
  
  // UI state
  const [activeAgentType, setActiveAgentType] = createSignal<'none' | 'generate' | 'edit' | 'voice'>('none');
  
  // Agent transform state (position and size during drag/resize operations)
  // Optimistic transforms (drag/resize)
const [optimisticPositions, setOptimisticPositions] = createSignal<Map<string, Position>>(new Map());
const [optimisticSizes, setOptimisticSizes] = createSignal<Map<string, Size>>(new Map());
// Optimistic create / delete
const [optimisticNewAgents, setOptimisticNewAgents] = createSignal<Agent[]>([]);
const [optimisticDeletedAgentIds, setOptimisticDeletedAgentIds] = createSignal<Set<string>>(new Set());
  
  
  // Z-index management for proper agent stacking
  const [maxZIndex, setMaxZIndex] = createSignal(1);
  const [agentZIndices, setAgentZIndices] = createSignal<Map<string, number>>(new Map());
  const [previousAgentIds, setPreviousAgentIds] = createSignal<Set<string>>(new Set());
  
  // Animation state management
  const [exitingAgents, setExitingAgents] = createSignal<Set<string>>(new Set());
  
  // =============================================
  // Data Fetching
  // =============================================
  
  // Canvas data - choose query based on activeCanvasId
  const defaultCanvas = useQuery(
    convexApi.canvas.getCanvas,
    () => (!props.activeCanvasId && userId()) ? { userId: userId()! } : null
  );
  
  const specificCanvas = useQuery(
    convexApi.canvas.getCanvasById,
    () => (props.activeCanvasId && userId()) ? { canvasId: props.activeCanvasId as any, userId: userId()! } : null
  );
  
  // Current active canvas data
  const canvas = createMemo(() => props.activeCanvasId ? specificCanvas.data() : defaultCanvas.data());
  
  // Canvas agents data
  const dbAgents = useQuery(
    convexApi.agents.getCanvasAgents,
    () => canvas()?._id ? { canvasId: canvas()!._id } : null
  );

  // User's own canvas for viewport preferences (works for both own and shared canvases)
  const userOwnCanvas = useQuery(
    convexApi.canvas.getCanvas,
    () => userId() ? { userId: userId()! } : null
  );
  
  // =============================================
  // Mutations
  // =============================================
  const createCanvasMutation = useMutation();
  const updateAgentTransformMutation = useMutation();
  const createAgentMutation = useMutation();
  const deleteAgentMutation = useMutation();
  const connectAgentsMutation = useMutation();
  const disconnectAgentsMutation = useMutation();
  const updateAgentPromptMutation = useMutation();
  const clearCanvasAgentsMutation = useMutation();
  const updateCanvasViewportMutation = useMutation();
  
  // =============================================
  // Zoom Utilities
  // =============================================
  
  // Zoom constraints
  const MIN_ZOOM = 0.5; // 50%
  const MAX_ZOOM = 2.0; // 200%
  const ZOOM_STEP = 0.25; // 25% increments
  
  // Constrain zoom level to safe bounds
  const constrainZoom = (zoom: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  
  // Debounced viewport save to prevent excessive API calls
  let viewportSaveTimeout: any;
  const saveViewportState = (newViewport: { x: number; y: number; zoom: number }) => {
    const userCanvas = userOwnCanvas.data();
    if (!userCanvas?._id || !userId()) return;
    
    if (viewportSaveTimeout) {
      clearTimeout(viewportSaveTimeout);
    }
    
    viewportSaveTimeout = setTimeout(async () => {
      try {
        await updateCanvasViewportMutation.mutate(convexApi.canvas.updateCanvasViewport, {
          canvasId: userCanvas._id,
          viewport: newViewport,
        });
      } catch (error) {
        console.error('Failed to save viewport state:', error);
      }
    }, 500); // 500ms debounce
  };
  
  // Zoom functions
  const zoomIn = () => {
    const currentViewport = viewport();
    const newViewport = {
      ...currentViewport,
      zoom: constrainZoom(currentViewport.zoom + ZOOM_STEP)
    };
    setViewport(newViewport);
    saveViewportState(newViewport);
  };
  
  const zoomOut = () => {
    const currentViewport = viewport();
    const newViewport = {
      ...currentViewport,
      zoom: constrainZoom(currentViewport.zoom - ZOOM_STEP)
    };
    setViewport(newViewport);
    saveViewportState(newViewport);
  };
  
  const resetZoom = () => {
    const newViewport = { x: 0, y: 0, zoom: 1.0 };
    setViewport(newViewport);
    saveViewportState(newViewport);
  };
  
  // =============================================
  // Effects and Derived State
  // =============================================
  
  // Restore viewport state when canvas loads (using user's own canvas viewport)
  createEffect(() => {
    const userCanvasData = userOwnCanvas.data();
    if (userCanvasData) {
      setViewport(userCanvasData.viewport || { x: 0, y: 0, zoom: 1.0 });
    }
  });
  
  // Create canvas if it doesn't exist (but not when shared canvas becomes inaccessible)
  createEffect(async () => {
    if (userId() && canvas() === null && !props.activeCanvasId) {
      try {
        await createCanvasMutation.mutate(convexApi.canvas.createCanvas, {
          userId: userId()!,
        });
      } catch (error) {
        console.error('Failed to create canvas:', error);
      }
    }
  });
  
  // Watch for when a shared canvas becomes inaccessible and fallback to user's own canvas
  createEffect(() => {
    // Only handle this for shared canvases (when activeCanvasId is provided)
    if (props.activeCanvasId && userId() && !hasRedirected()) {
      const canvasData = specificCanvas.data();
      // If we were trying to access a specific canvas but it's now null,
      // it means sharing was disabled or access was revoked
      if (canvasData === null) {
        setHasRedirected(true); // Prevent multiple calls
        toast.error('Canvas sharing has been disabled by the owner. Switched to your canvas.');
        props.onCanvasDisabled?.();
      }
    }
  });

  // Bring newly created agents to front - rewritten to avoid circular dependency
  createEffect(() => {
    const currentAgents = dbAgents.data();
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
    
    // Find new agents (ids that are in current but not in previous)
    const newAgentIds = currentIdsArray.filter((id: string) => !prevIds.has(id));
    
    // Find removed agents (cleanup any lingering animation states)  
    const removedAgentIds = prevIdsArray.filter(id => !currentAgentIds.has(id));
    
    // Use batch to group all state updates and prevent intermediate renders
    batch(() => {
      // Handle new agents - bring to front
      newAgentIds.forEach((id: string) => {
        bringAgentToFront(id);
      });
      
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

  // Memoized agent processing with proper typing and validation
  // Pre-compute once per render – keeps reference stable for child memoisation
  const agents = createMemo((): Agent[] => {
    const rawAgentData = dbAgents.data();
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

  // =============================================
  // Agent Interaction Handlers
  // =============================================
  
  // Create a new agent
  const addAgent = async (prompt?: string, type: 'image-generate' | 'image-edit' | 'voice-generate' = 'image-generate') => {
    if (!canvas()?._id || !userId()) return;
    
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

    // Utility to find first free grid slot
    function findNextAvailableGridPosition(container: Size, elemSize: Size, occupied: Set<string>, pad: number, startingIndex: number): Position {
      const agentsPerRow = Math.floor((container.width - pad * 2) / (elemSize.width + pad));
      const agentsPerCol = Math.floor((container.height - pad * 2) / (elemSize.height + pad));
      const totalSlots = agentsPerRow * agentsPerCol;

      for (let idx = startingIndex; idx < startingIndex + totalSlots * 5; idx++) { // arbitrary safety cap
        const col = idx % agentsPerRow;
        const row = Math.floor(idx / agentsPerRow);
        const pos: Position = {
          x: pad + col * (elemSize.width + pad),
          y: pad + row * (elemSize.height + pad),
        };
        const key = `${pos.x},${pos.y}`;
        if (!occupied.has(key)) {
          return pos;
        }
      }
      // fallback top-left
      return { x: pad, y: pad };
    }
    
    let newPosition: Position = { x: padding, y: padding };
    
    if (canvasEl) {
      const containerSize: Size = { 
        width: canvasEl.clientWidth, 
        height: canvasEl.clientHeight 
      };
      
      const existingProcessed = agents();
      const occupied = new Set(existingProcessed.map(a => `${Math.round(a.position.x)},${Math.round(a.position.y)}`));
      const existingAgents = existingProcessed.length;
      // Use helper to find the first vacant slot considering occupied set
      newPosition = findNextAvailableGridPosition(containerSize, agentSize, occupied, padding, existingAgents);

    }
    
    try {
      // Create in Convex
      const createParams: any = {
        canvasId: canvas()!._id,
        userId: userId()!,
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

      // ---------------------------------------------
      // Optimistic insert
      // ---------------------------------------------
      const tempId = crypto.randomUUID();
      const tempAgent: Agent = {
        id: tempId,
        prompt: createParams.prompt,
        type,
        position: newPosition,
        size: agentSize,
      } as any;

      batch(() => {
        setOptimisticNewAgents(prev => [...prev, tempAgent]);
      });

      try {
        await createAgentMutation.mutate(convexApi.agents.createAgent, createParams);
      } finally {
        // Remove temp once Convex snapshot arrives (~after mutation). Delay slightly to avoid flicker.
        setTimeout(() => {
          batch(() => {
            setOptimisticNewAgents(prev => prev.filter(a => a.id !== tempId));
          });
        }, 250);
      }
      
      // Note: Convex queries update automatically via real-time subscriptions
      // Small delay helps ensure the agent is available for dragging
      // console.log('Agent created successfully:', result);
      
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
          setOptimisticDeletedAgentIds(prev => new Set(prev).add(id));
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
          setOptimisticDeletedAgentIds(prev => {
            const copy = new Set(prev);
            copy.delete(id);
            return copy;
          });
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
    if (!canvas()?._id) return;
    
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
            canvasId: canvas()!._id,
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

  // =============================================
  // Position and Size Management
  // =============================================
  
  // Debounced saves for transforms to reduce API calls
  const debouncedSaves = new Map<string, number>();
  
  // Save transform (position and size) to database with debounce
  const saveAgentTransform = (
    agentId: string, 
    position: Position, 
    size: Size
  ) => {
    if (!canvas()?._id) return;
    
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
        setOptimisticPositions(prev => {
          const newMap = new Map(prev);
          newMap.delete(agentId);
          return newMap;
        });
        setOptimisticSizes(prev => {
          const newMap = new Map(prev);
          newMap.delete(agentId);
          return newMap;
        });
      } catch (error) {
        console.error('Failed to save agent transform:', error);
      }
      
      debouncedSaves.delete(agentId);
    }, 150);
    
    debouncedSaves.set(agentId, timeout);
  };
  
  // Update agent position with optimistic update
  const updateAgentPosition = (id: string, position: Position) => {
    setOptimisticPositions(prev => new Map(prev).set(id, position));
    
    const agent = agents().find(a => a.id === id);
    if (agent) {
      saveAgentTransform(id, position, agent.size);
    }
  };
  
  // Update agent size with optimistic update
  const updateAgentSize = (id: string, size: Size) => {
    setOptimisticSizes(prev => new Map(prev).set(id, size));
    
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

  // =============================================
  // Z-index and Stacking Management
  // =============================================
  
  // Bring an agent to the front of the stack
  const bringAgentToFront = (agentId: string) => {
    const currentMax = maxZIndex();
    const newZIndex = currentMax + 1;
    setMaxZIndex(newZIndex);
    setAgentZIndices(prev => new Map(prev).set(agentId, newZIndex));
  };
  
  // Get z-index for an agent
  const getAgentZIndex = (agentId: string, isDragged: boolean) => {
    if (isDragged) return 9999; // Always on top while dragging
    return agentZIndices().get(agentId) || 1;
  };

  // =============================================
  // Drag and Resize Hooks
  // =============================================
  
  // Use custom hooks for drag and resize
  const dragHook = useCanvasDrag({
    onDragStart: bringAgentToFront,
    onDragEnd: (agentId, finalPosition) => {
      updateAgentPosition(agentId, finalPosition);
    },
    constrainToBounds: true,
    agentSize: { width: 320, height: 384 },
    zoomLevel: () => viewport().zoom,
  });

  const resizeHook = useCanvasResize({
    onResizeMove: (agentId, size, positionAdjustment) => {
      updateAgentSize(agentId, size);
      if (positionAdjustment) {
        const agent = agents().find(a => a.id === agentId);
        if (agent) {
          const newPos: Position = {
            x: agent.position.x + positionAdjustment.x,
            y: agent.position.y + positionAdjustment.y,
          };
          updateAgentPosition(agentId, newPos);
        }
      }
    },
    onResizeEnd: (agentId) => {
      const agent = agents().find(a => a.id === agentId);
      if (agent) {
        saveAgentTransform(agentId, agent.position, agent.size);
      }
    },
    zoomLevel: () => viewport().zoom,
  });

  // Cleanup timeouts on unmount
  onCleanup(() => {
    if (viewportSaveTimeout) {
      clearTimeout(viewportSaveTimeout);
    }
    
    // Clear all debounced save timeouts
    debouncedSaves.forEach(timeout => clearTimeout(timeout));
    debouncedSaves.clear();
    

  });

  // =============================================
  // Event Handlers
  // =============================================
  
  // Mouse down handler for agent dragging
  const handleMouseDown = (e: MouseEvent, agentId: string) => {
    // First check if agent exists in raw database data
    const rawAgent = dbAgents.data()?.find((a: any) => a._id === agentId);
    if (!rawAgent) {
      console.warn('Agent not found in database yet:', agentId);
      return;
    }
    
    // Then get the processed agent with optimistic updates
    const currentAgents = agents();
    const agent = currentAgents.find(a => a.id === agentId);
    if (!agent) {
      console.error('Agent found in DB but not in processed agents array!', {
        agentId,
        rawAgent: !!rawAgent,
        totalAgents: currentAgents.length,
        agentIds: currentAgents.map(a => a.id)
      });
      return;
    }
    
    bringAgentToFront(agentId);
    dragHook.handleMouseDown(e, agentId, agent.position);
  };
  
  // Resize start handler for agent resizing
  const handleResizeStart = (e: MouseEvent, agentId: string, handle: string) => {
    const agent = agents().find(a => a.id === agentId);
    if (!agent) return;
    
    bringAgentToFront(agentId);
    resizeHook.handleResizeStart(e, agentId, handle, agent.size);
  };
  
  // Helper methods for the toolbar
  const handleAddGenerateAgent = () => addAgent('', 'image-generate');
  const handleAddEditAgent = () => addAgent('', 'image-edit');
  const handleAddVoiceAgent = () => addAgent('', 'voice-generate');

  // =============================================
  // Render
  // =============================================
  
  return (
    <ErrorBoundary>
      <div class={cn("flex flex-col h-full overflow-hidden", props.class)}>
        {/* Toolbar */}
        <AgentToolbar
          activeAgentType={activeAgentType()}
          agentCount={agents().length}
          isSharedCanvas={!!props.activeCanvasId}
          isOwnerSharingCanvas={!props.activeCanvasId && !!canvas()?.isShareable}
          canvasId={canvas()?._id}
          canvasName={canvas()?.name}
          currentShareId={canvas()?.shareId}
          canvasOwnerId={canvas()?.userId}
          currentUserId={userId()}
          onAddGenerateAgent={handleAddGenerateAgent}
          onAddEditAgent={handleAddEditAgent}
          onAddVoiceAgent={handleAddVoiceAgent}
          onClearCanvas={clearCanvas}
        />

        {/* Canvas */}
        <div 
          class="canvas-container flex-1 relative overflow-auto bg-muted/30 border-2 border-dashed border-muted-foreground/20 min-h-0 rounded-xl"
          style={{ 
            "background-image": "radial-gradient(circle, hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px)",
            "background-size": `${20 * viewport().zoom}px ${20 * viewport().zoom}px`
          }}
        >
          <div 
            class="canvas-content w-full h-full"
            style={{
              transform: `scale(${viewport().zoom})`,
              "transform-origin": "center center", // Center scaling for better UX
              transition: "transform 0.2s ease-out"
            }}
          >
          {/* Loading State */}
          <Show when={!canvas() || !dbAgents.data()}>
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="text-center">
                <Icon name="loader" class="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p class="text-sm text-muted-foreground">Loading canvas...</p>
              </div>
            </div>
          </Show>

          {/* Empty State */}
          <Show when={canvas() && dbAgents.data() && agents().length === 0}>
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="text-center">
                <div class="w-16 h-16 mx-auto mb-4 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center">
                  <Icon name="image" class="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 class="text-lg font-medium text-muted-foreground mb-2">
                  Empty Canvas
                </h3>
                <p class="text-sm text-muted-foreground/80 mb-4">
                  Add your first image agent to get started
                </p>
                <Button onClick={handleAddGenerateAgent} size="sm">
                  <Icon name="plus" class="h-4 w-4 mr-2" />
                  Add Agent
                </Button>
              </div>
            </div>
          </Show>

          {/* Agent Connection Lines */}
          <For each={connectedAgentPairs()}>
            {(pair) => (
              <AgentConnection
                sourcePosition={pair.source.position}
                targetPosition={pair.target.position}
                sourceWidth={pair.source.size.width}
                sourceHeight={pair.source.size.height}
                targetWidth={pair.target.size.width}
                targetHeight={pair.target.size.height}
                sourceId={pair.source.id}
                targetId={pair.target.id}
              />
            )}
          </For>

          {/* Agents with individual memoization for better performance */}
          <For each={agents()}>
            {(agent) => {
              // Calculate current interaction state
              const isDragged = () => dragHook.draggedAgent() === agent.id;
              const isResizing = () => resizeHook.resizingAgent() === agent.id;
              const zIndex = () => getAgentZIndex(agent.id, isDragged());
              
              // Calculate animation state
              const isExiting = () => exitingAgents().has(agent.id);
              

              
              // Render different agent types
              if (agent.type === 'voice-generate') {
              return (
              <MemoizedVoiceAgent
              agent={agent}
              isDragged={isDragged()}
              isResizing={isResizing()}
              zIndex={zIndex()}
              isExiting={isExiting()}
              onRemove={removeAgent}
              onMouseDown={(e) => handleMouseDown(e, agent.id)}
                onResizeStart={(e, handle) => handleResizeStart(e, agent.id, handle)}
              onPromptChange={updateAgentPrompt}
              />
              );
              }
              
              return (
                <MemoizedImageAgent
                  agent={agent}
                  isDragged={isDragged()}
                  isResizing={isResizing()}
                  zIndex={zIndex()}
                  isExiting={isExiting()}
                  availableAgents={availableAgents()}
                  onRemove={removeAgent}
                  onMouseDown={(e) => handleMouseDown(e, agent.id)}
                  onResizeStart={(e, handle) => handleResizeStart(e, agent.id, handle)}
                  onPromptChange={updateAgentPrompt}
                  onConnectAgent={connectAgents}
                  onDisconnectAgent={disconnectAgent}
                />
              );
            }}
          </For>
          </div>
        </div>

        {/* Status Bar */}
        <div class="flex items-center justify-between px-1 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 text-xs text-muted-foreground">
          <span>Drag agents around the canvas to organize your workspace</span>
          <div class="flex items-center gap-4">
            {/* Zoom Controls */}
            <div class="flex items-center gap-1">
              <Button
                onClick={zoomOut}
                size="sm"
                variant="ghost"
                disabled={viewport().zoom <= MIN_ZOOM}
                class="h-6 w-6 p-0"
                title="Zoom Out"
              >
                <span class="text-xs font-bold">−</span>
              </Button>
              <span class="text-xs text-muted-foreground min-w-12 text-center font-mono">
                {Math.round(viewport().zoom * 100)}%
              </span>
              <Button
                onClick={zoomIn}
                size="sm"
                variant="ghost"
                disabled={viewport().zoom >= MAX_ZOOM}
                class="h-6 w-6 p-0"
                title="Zoom In"
              >
                <span class="text-xs font-bold">+</span>
              </Button>
              <Button
                onClick={resetZoom}
                size="sm"
                variant="ghost"
                disabled={viewport().zoom === 1.0}
                class="h-6 w-6 p-0 ml-1"
                title="Reset Zoom (100%)"
              >
                <Icon name="refresh-cw" class="h-2 w-2" />
              </Button>
            </div>
            <span>•</span>
            <span class="flex items-center gap-1">
              <Icon name="mouse-pointer" class="h-3 w-3" />
              Drag to move
            </span>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
