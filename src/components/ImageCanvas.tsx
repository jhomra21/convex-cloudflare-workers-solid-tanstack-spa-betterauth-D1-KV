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
import { ErrorBoundary, MutationErrorBoundary } from '~/components/ErrorBoundary';

class Agent {
  constructor(
    public id: string,
    public prompt: string = '',
    public position: { x: number; y: number } = { x: 0, y: 0 },
    public size: { width: number; height: number } = { width: 320, height: 384 },
    public generatedImage: string = '',
    public status: 'idle' | 'processing' | 'success' | 'failed' = 'idle',
    public model: 'normal' | 'pro' = 'normal',
    public _version: number = 0 // Track changes to force reactivity
  ) {}
}

export interface ImageCanvasProps {
  class?: string;
}

export function ImageCanvas(props: ImageCanvasProps) {
  // Auth context
  const context = useRouteContext({ from: '/dashboard' });
  const userId = createMemo(() => context()?.session?.user?.id);
  
  // Convex queries
  const canvas = useQuery(
    convexApi.canvas.getCanvas,
    () => userId() ? { userId: userId()! } : undefined
  );
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

  const addAgent = async (prompt?: string) => {
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

  const updateAgentImage = async (id: string, generatedImage: string) => {
    console.log(`📸 ImageCanvas: Updating image for agent ${id}`, {
      hasImage: !!generatedImage,
      imageLength: generatedImage?.length || 0
    });
    
    // No local state update needed - Convex handles the update
    
    try {
      // Save to Convex
      if (generatedImage) {
        await convexClient.mutation(convexApi.agents.updateAgentImage, {
          agentId: id as any,
          imageUrl: generatedImage,
        });
      }
    } catch (error) {
      console.error('Failed to update agent image:', error);
    }
  };

  const updateAgentPrompt = async (id: string, prompt: string) => {
    console.log(`📝 ImageCanvas: Updating prompt for agent ${id}:`, prompt);
    
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
        </div>
        <div class="flex items-center gap-2">
          <Button
            onClick={() => addAgent()}
            size="sm"
            class="flex items-center gap-2"
          >
            <Icon name="plus" class="h-4 w-4" />
            Add Agent
          </Button>
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
                  onImageGenerated={updateAgentImage}
                  onPromptChange={updateAgentPrompt}
                  status={agent.status}
                  model={agent.model}
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
