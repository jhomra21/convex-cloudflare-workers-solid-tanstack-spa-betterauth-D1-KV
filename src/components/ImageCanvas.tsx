import { createSignal, For, Show, createEffect, createMemo } from 'solid-js';
import { ImageAgent } from './ImageAgent';
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

/**
 * Agent data model used for rendering on canvas
 */
class Agent {
  constructor(
    public id: string,
    public prompt: string = '',
    public position: { x: number; y: number } = { x: 0, y: 0 },
    public size: { width: number; height: number } = { width: 320, height: 384 },
    public generatedImage: string = '',
    public status: 'idle' | 'processing' | 'success' | 'failed' = 'idle',
    public model: 'normal' | 'pro' = 'normal',
    public type: 'image-generate' | 'image-edit' = 'image-generate',
    public connectedAgentId?: string,
    public uploadedImageUrl?: string,
    public activeImageUrl?: string,
    public _version: number = 0 // Track changes for reactivity
  ) {}
}

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
  const [activeAgentType, setActiveAgentType] = createSignal<'none' | 'generate' | 'edit'>('none');
  
  // Agent transform state (position and size during drag/resize operations)
  const [optimisticPositions, setOptimisticPositions] = createSignal<Map<string, { x: number; y: number }>>(new Map());
  const [optimisticSizes, setOptimisticSizes] = createSignal<Map<string, { width: number; height: number }>>(new Map());
  
  // Z-index management for proper agent stacking
  const [maxZIndex, setMaxZIndex] = createSignal(1);
  const [agentZIndices, setAgentZIndices] = createSignal<Map<string, number>>(new Map());
  
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

  // Convert Convex agents to Agent objects for rendering with optimistic updates
  const agents = () => {
    if (!dbAgents.data()) return [];
    const positions = optimisticPositions();
    const sizes = optimisticSizes();
    
    return dbAgents.data()!.map((agent: any) => {
      // Use optimistic position/size if available, otherwise use database values
      const optimisticPos = positions.get(agent._id);
      const optimisticSize = sizes.get(agent._id);
      
      return new Agent(
        agent._id,
        agent.prompt,
        optimisticPos || { x: agent.positionX, y: agent.positionY },
        optimisticSize || { width: agent.width, height: agent.height },
        agent.imageUrl || '',
        agent.status,
        agent.model,
        agent.type || 'image-generate',
        agent.connectedAgentId,
        agent.uploadedImageUrl,
        agent.activeImageUrl,
        0 // _version
      );
    });
  };
  
  // Find pairs of connected agents
  const connectedAgentPairs = createMemo(() => {
    const result = [];
    const agentsList = agents();
    
    for (const agent of agentsList) {
      if (agent.type === 'image-edit' && agent.connectedAgentId) {
        const sourceAgent = agentsList.find(a => a.id === agent.connectedAgentId);
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

  // =============================================
  // Agent Interaction Handlers
  // =============================================
  
  // Create a new agent
  const addAgent = async (prompt?: string, type: 'image-generate' | 'image-edit' = 'image-generate') => {
    if (!canvas()?._id || !userId()) return;
    
    // Set the active agent type for UI cues only
    setActiveAgentType(type === 'image-generate' ? 'generate' : 'edit');
    
    // Smart positioning based on available canvas space
    const canvasEl = document.querySelector('.canvas-container') as HTMLElement;
    const agentWidth = 320; // w-80 = 320px
    const agentHeight = 384; // h-96 = 384px
    const padding = 20; // Minimum padding from edges
    
    let newX = padding;
    let newY = padding;
    
    if (canvasEl) {
      const canvasWidth = canvasEl.clientWidth;
      const canvasHeight = canvasEl.clientHeight;
      
      // Calculate how many agents can fit in each direction
      const agentsPerRow = Math.floor((canvasWidth - padding * 2) / (agentWidth + padding));
      const agentsPerCol = Math.floor((canvasHeight - padding * 2) / (agentHeight + padding));
      const totalSlotsAvailable = agentsPerRow * agentsPerCol;
      
      const existingAgents = agents().length;
      
      if (existingAgents < totalSlotsAvailable) {
        // We have space - use normal grid positioning
        const gridCol = existingAgents % agentsPerRow;
        const gridRow = Math.floor(existingAgents / agentsPerRow);
        
        newX = padding + (gridCol * (agentWidth + padding));
        newY = padding + (gridRow * (agentHeight + padding));
      } else {
        // No space - place with slight overlap over existing agents
        const overlapOffset = 30; // Small offset for overlapping
        const baseAgentIndex = existingAgents % totalSlotsAvailable;
        const overlapLayer = Math.floor(existingAgents / totalSlotsAvailable);
        
        const gridCol = baseAgentIndex % agentsPerRow;
        const gridRow = Math.floor(baseAgentIndex / agentsPerRow);
        
        newX = padding + (gridCol * (agentWidth + padding)) + (overlapLayer * overlapOffset);
        newY = padding + (gridRow * (agentHeight + padding)) + (overlapLayer * overlapOffset);
        
        // Ensure we don't go outside canvas bounds even with overlap
        newX = Math.min(newX, canvasWidth - agentWidth - padding);
        newY = Math.min(newY, canvasHeight - agentHeight - padding);
      }
    }
    
    try {
      // Create in Convex
      await createAgentMutation.mutate(convexApi.agents.createAgent, {
        canvasId: canvas()!._id,
        userId: userId()!,
        prompt: prompt || '',
        positionX: newX,
        positionY: newY,
        width: 320,
        height: 384,
        type,
      });
      
    } catch (error) {
      console.error('Failed to create agent:', error);
      toast.error('Failed to create agent');
    } finally {
      // Reset active agent type
      setActiveAgentType('none');
    }
  };
  
  // Remove an agent
  const removeAgent = async (id: string) => {
    try {
      await deleteAgentMutation.mutate(convexApi.agents.deleteAgent, {
        agentId: id as any,
      });
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
  
  // Clear all agents from canvas
  const clearCanvas = async () => {
    if (!canvas()?._id) return;
    try {
      await clearCanvasAgentsMutation.mutate(convexApi.agents.clearCanvasAgents, {
        canvasId: canvas()!._id,
      });
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
    position: { x: number; y: number }, 
    size: { width: number; height: number }
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
  const updateAgentPosition = (id: string, position: { x: number; y: number }) => {
    setOptimisticPositions(prev => new Map(prev).set(id, position));
    
    const agent = agents().find(a => a.id === id);
    if (agent) {
      saveAgentTransform(id, position, agent.size);
    }
  };
  
  // Update agent size with optimistic update
  const updateAgentSize = (id: string, size: { width: number; height: number }) => {
    setOptimisticSizes(prev => new Map(prev).set(id, size));
    
    const agent = agents().find(a => a.id === id);
    if (agent) {
      saveAgentTransform(id, agent.position, size);
    }
  };
  
  // Update agent prompt text
  const updateAgentPrompt = async (id: string, prompt: string) => {
    try {
      await updateAgentPromptMutation.mutate(convexApi.agents.updateAgentPrompt, {
        agentId: id as any,
        prompt,
      });
    } catch (error) {
      console.error('Failed to update agent prompt:', error);
    }
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
    onDragMove: updateAgentPosition,
    onDragEnd: (agentId) => {
      const agent = agents().find(a => a.id === agentId);
      if (agent) {
        saveAgentTransform(agentId, agent.position, agent.size);
      }
    },
    constrainToBounds: true, // Using stable parent container for boundaries
    zoomLevel: () => viewport().zoom,
  });

  const resizeHook = useCanvasResize({
    onResizeMove: (agentId, size, positionAdjustment) => {
      updateAgentSize(agentId, size);
      if (positionAdjustment) {
        const agent = agents().find(a => a.id === agentId);
        if (agent) {
          const newPos = {
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
  });

  // =============================================
  // Event Handlers
  // =============================================
  
  // Mouse down handler for agent dragging
  const handleMouseDown = (e: MouseEvent, agentId: string) => {
    const agent = agents().find(a => a.id === agentId);
    if (!agent) return;
    
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
          onClearCanvas={clearCanvas}
        />

        {/* Canvas */}
        <div 
          class="canvas-container flex-1 relative overflow-auto bg-muted/30 border-2 border-dashed border-muted-foreground/20 min-h-0"
          style={{ 
            "background-image": "radial-gradient(circle, hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px)",
            "background-size": `${20 * viewport().zoom}px ${20 * viewport().zoom}px`
          }}
        >
          <div 
            class="canvas-content w-full h-full"
            style={{
              transform: `scale(${viewport().zoom})`,
              "transform-origin": "top left", // Use top-left to avoid coordinate offset issues
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

          {/* Agents */}
          <For each={agents()}>
            {(agent) => {
              // Memoize drag state to prevent unnecessary re-renders of other agents
              const isDragged = () => dragHook.draggedAgent() === agent.id;
              const isResizing = () => resizeHook.resizingAgent() === agent.id;
              const zIndex = () => getAgentZIndex(agent.id, isDragged());
              
              return (
                <div
                  class="absolute select-none"
                  style={{
                    left: `${agent.position.x}px`,
                    top: `${agent.position.y}px`,
                    transform: isDragged() ? 'scale(1.05)' : 'scale(1)',
                    transition: isDragged() ? 'none' : 'transform 0.2s ease',
                    'z-index': zIndex()
                  }}
                >
                  <ImageAgent
                    id={agent.id}
                    prompt={agent.prompt}
                    onRemove={removeAgent}
                    onMouseDown={(e) => handleMouseDown(e, agent.id)}
                    size={agent.size}
                    onResizeStart={(e, handle) => handleResizeStart(e, agent.id, handle)}
                    generatedImage={agent.generatedImage}
                    onPromptChange={updateAgentPrompt}
                    status={agent.status}
                    model={agent.model}
                    type={agent.type}
                    connectedAgentId={agent.connectedAgentId}
                    uploadedImageUrl={agent.uploadedImageUrl}
                    activeImageUrl={agent.activeImageUrl}
                    availableAgents={agents().map((a: any) => ({
                      id: a.id,
                      prompt: a.prompt,
                      imageUrl: a.generatedImage
                    }))}
                    onConnectAgent={connectAgents}
                    onDisconnectAgent={disconnectAgent}
                    class={cn(
                      "shadow-lg border-2 transition-all duration-200",
                      isDragged() 
                        ? "border-primary shadow-xl" 
                        : isResizing()
                        ? "border-secondary shadow-lg"
                        : "border-transparent hover:border-muted-foreground/20"
                    )}
                  />
                </div>
              );
            }}
          </For>
          </div>
        </div>

        {/* Status Bar */}
        <div class="flex items-center justify-between px-4 py-2 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 text-xs text-muted-foreground">
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
