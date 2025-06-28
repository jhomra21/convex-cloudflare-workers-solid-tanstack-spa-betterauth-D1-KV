import { createSignal, For, Show, createEffect, createMemo } from 'solid-js';
import { ImageAgent } from './ImageAgent';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { cn } from '~/lib/utils';
import { useQuery } from '~/lib/convex';
import { convexApi, convexClient } from '~/lib/convex';
import { useRouteContext } from '@tanstack/solid-router';
import { useCanvasDrag } from '~/lib/hooks/use-canvas-drag';
import { useCanvasResize } from '~/lib/hooks/use-canvas-resize';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { ShareCanvasDialog } from '~/components/ShareCanvasDialog';

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
    public _version: number = 0 // Track changes to force reactivity
  ) {}
}

export interface ImageCanvasProps {
  class?: string;
  activeCanvasId?: string | null; // null = use default canvas, string = use specific canvas
}

export function ImageCanvas(props: ImageCanvasProps) {
  // Auth context
  const context = useRouteContext({ from: '/dashboard' });
  const userId = createMemo(() => context()?.session?.user?.id);
  
  // Convex queries - choose query based on activeCanvasId
  const defaultCanvas = useQuery(
    convexApi.canvas.getCanvas,
    () => (!props.activeCanvasId && userId()) ? { userId: userId()! } : undefined
  );
  
  const specificCanvas = useQuery(
    convexApi.canvas.getCanvasById,
    () => (props.activeCanvasId && userId()) ? { canvasId: props.activeCanvasId as any, userId: userId()! } : undefined
  );
  
  // Use the appropriate canvas
  const canvas = createMemo(() => props.activeCanvasId ? specificCanvas() : defaultCanvas());
  const dbAgents = useQuery(
    convexApi.agents.getCanvasAgents,
    () => canvas()?._id ? { canvasId: canvas()!._id } : undefined
  );
  
  // Optimistic position updates during drag (visual only)
  const [optimisticPositions, setOptimisticPositions] = createSignal<Map<string, { x: number; y: number }>>(new Map());
  const [optimisticSizes, setOptimisticSizes] = createSignal<Map<string, { width: number; height: number }>>(new Map());
  
  // Z-index management for proper stacking
  const [maxZIndex, setMaxZIndex] = createSignal(1);
  const [agentZIndices, setAgentZIndices] = createSignal<Map<string, number>>(new Map());
  
  // Create canvas if it doesn't exist
  createEffect(async () => {
    if (userId() && canvas() === null) {
      try {
        await convexClient.mutation(convexApi.canvas.createCanvas, {
          userId: userId()!,
        });
      } catch (error) {
        console.error('Failed to create canvas:', error);
      }
    }
  });

  // Convert Convex agents to Agent objects for rendering with optimistic updates
  const agents = () => {
    if (!dbAgents()) return [];
    const positions = optimisticPositions();
    const sizes = optimisticSizes();
    
    return dbAgents()!.map(agent => {
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
        0 // _version
      );
    });
  };

  // Debounced save for transforms
  const debouncedSaves = new Map<string, number>();
  
  const saveAgentTransform = (agentId: string, position: { x: number; y: number }, size: { width: number; height: number }) => {
    if (!canvas()?._id) return;
    
    // Clear existing timeout
    const existingTimeout = debouncedSaves.get(agentId);
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }
    
    // Set new timeout
    const timeout = window.setTimeout(async () => {
      try {
        await convexClient.mutation(convexApi.agents.updateAgentTransform, {
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
    }, 25);
    
    debouncedSaves.set(agentId, timeout);
  };

  const addAgent = async (prompt?: string, type: 'image-generate' | 'image-edit' = 'image-generate') => {
    if (!canvas()?._id || !userId()) return;
    
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
      // Create in Convex first
      await convexClient.mutation(convexApi.agents.createAgent, {
        canvasId: canvas()!._id,
        userId: userId()!,
        prompt: prompt || '',
        positionX: newX,
        positionY: newY,
        width: 320,
        height: 384,
        type,
      });
      
      // Convex will automatically update via real-time subscription
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
  };

  const removeAgent = async (id: string) => {
    try {
      // Remove from Convex
      await convexClient.mutation(convexApi.agents.deleteAgent, {
        agentId: id as any,
      });
      
      // Convex will automatically update via real-time subscription
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const connectAgents = async (sourceAgentId: string, targetAgentId: string) => {
    try {
      await convexClient.mutation(convexApi.agents.connectAgents, {
        sourceAgentId: sourceAgentId as any,
        targetAgentId: targetAgentId as any,
      });
    } catch (error) {
      console.error('Failed to connect agents:', error);
    }
  };

  const disconnectAgent = async (agentId: string) => {
    try {
      await convexClient.mutation(convexApi.agents.disconnectAgents, {
        agentId: agentId as any,
      });
    } catch (error) {
      console.error('Failed to disconnect agent:', error);
    }
  };

  const updateAgentPosition = (id: string, position: { x: number; y: number }) => {
    // Immediate optimistic update for smooth visuals
    setOptimisticPositions(prev => new Map(prev).set(id, position));
    
    // Find agent for size (from current state)
    const agent = agents().find(a => a.id === id);
    if (agent) {
      saveAgentTransform(id, position, agent.size);
    }
  };

  const updateAgentSize = (id: string, size: { width: number; height: number }) => {
    // Immediate optimistic update for smooth visuals
    setOptimisticSizes(prev => new Map(prev).set(id, size));
    
    // Find agent for position (from current state)
    const agent = agents().find(a => a.id === id);
    if (agent) {
      saveAgentTransform(id, agent.position, size);
    }
  };

  const updateAgentPrompt = async (id: string, prompt: string) => {
    // No local state update needed - Convex handles the update
    
    try {
      // Save to Convex (debounced)
      await convexClient.mutation(convexApi.agents.updateAgentPrompt, {
        agentId: id as any,
        prompt,
      });
    } catch (error) {
      console.error('Failed to update agent prompt:', error);
    }
  };

  // Z-index management functions
  const bringAgentToFront = (agentId: string) => {
    const currentMax = maxZIndex();
    const newZIndex = currentMax + 1;
    setMaxZIndex(newZIndex);
    setAgentZIndices(prev => new Map(prev).set(agentId, newZIndex));
  };

  const getAgentZIndex = (agentId: string, isDragged: boolean) => {
    if (isDragged) return 9999; // Always on top while dragging
    return agentZIndices().get(agentId) || 1;
  };

  // Use custom hooks for drag and resize (after function definitions)
  const dragHook = useCanvasDrag({
    onDragStart: bringAgentToFront, // Bring to front when drag starts
    onDragMove: updateAgentPosition,
    onDragEnd: (agentId) => {
      const agent = agents().find(a => a.id === agentId);
      if (agent) {
        saveAgentTransform(agentId, agent.position, agent.size);
      }
    },
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

  // Simple handlers that delegate to the hooks
  const handleMouseDown = (e: MouseEvent, agentId: string) => {
    const agent = agents().find(a => a.id === agentId);
    if (!agent) return;
    
    // Bring to front on any interaction (not just drag start)
    bringAgentToFront(agentId);
    dragHook.handleMouseDown(e, agentId, agent.position);
  };

  const handleResizeStart = (e: MouseEvent, agentId: string, handle: string) => {
    const agent = agents().find(a => a.id === agentId);
    if (!agent) return;
    
    // Bring to front on resize as well
    bringAgentToFront(agentId);
    resizeHook.handleResizeStart(e, agentId, handle, agent.size);
  };

  return (
    <ErrorBoundary>
      <div class={cn("flex flex-col h-full overflow-hidden", props.class)}>
      {/* Toolbar */}
      <div class="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">
            {agents().length} agent{agents().length !== 1 ? 's' : ''}
          </span>
          <Show when={props.activeCanvasId}>
            <div class="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs rounded-md">
              <Icon name="users" class="h-3 w-3" />
              <span>Shared Canvas</span>
            </div>
          </Show>
          <Show when={!props.activeCanvasId && canvas()?.isShareable}>
            <div class="flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-xs rounded-md">
              <Icon name="share" class="h-3 w-3" />
              <span>Sharing Enabled</span>
            </div>
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <Button
            onClick={() => addAgent('', 'image-generate')}
            size="sm"
            class="flex items-center gap-2"
          >
            <Icon name="image" class="h-4 w-4" />
            Generate Agent
          </Button>
          <Button
            onClick={() => addAgent('', 'image-edit')}
            size="sm"
            variant="outline"
            class="flex items-center gap-2"
          >
            <Icon name="edit" class="h-4 w-4" />
            Edit Agent
          </Button>
          
          <ShareCanvasDialog
            canvasId={canvas()?._id}
            canvasName={canvas()?.name}
            currentShareId={canvas()?.shareId}
            isShareable={canvas()?.isShareable}
          >
            <Button
              size="sm"
              variant={canvas()?.isShareable ? "default" : "outline"}
              class={cn(
                "flex items-center gap-2",
                canvas()?.isShareable && "bg-blue-600 hover:bg-blue-700 border-blue-600"
              )}
            >
              <Icon name={canvas()?.isShareable ? "users" : "share"} class="h-4 w-4" />
              {canvas()?.isShareable ? "Shared" : "Share"}
            </Button>
          </ShareCanvasDialog>
          <Button
            onClick={async () => {
              if (!canvas()?._id) return;
              try {
                await convexClient.mutation(convexApi.agents.clearCanvasAgents, {
                  canvasId: canvas()!._id,
                });
                // Convex will automatically update via real-time subscription
              } catch (error) {
                console.error('Failed to clear canvas:', error);
              }
            }}
            variant="outline"
            size="sm"
            disabled={agents().length === 0}
          >
            <Icon name="trash-2" class="h-4 w-4" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div 
        class="canvas-container flex-1 relative overflow-auto bg-muted/30 border-2 border-dashed border-muted-foreground/20 min-h-0"
        style={{ 
          "background-image": "radial-gradient(circle, hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px)",
          "background-size": "20px 20px"
        }}
      >
        <Show when={!canvas() || !dbAgents()}>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center">
              <Icon name="loader" class="h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p class="text-sm text-muted-foreground">Loading canvas...</p>
            </div>
          </div>
        </Show>

        <Show when={canvas() && dbAgents() && agents().length === 0}>
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
              <Button onClick={() => addAgent()} size="sm">
                <Icon name="plus" class="h-4 w-4 mr-2" />
                Add Agent
              </Button>
            </div>
          </div>
        </Show>

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
                  availableAgents={agents().map(a => ({
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

      {/* Status Bar */}
      <div class="flex items-center justify-between px-4 py-2 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 text-xs text-muted-foreground">
        <span>Drag agents around the canvas to organize your workspace</span>
        <div class="flex items-center gap-4">
          <span>Canvas: {agents().length} / ∞</span>
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
