import { createSignal, For, Show, createEffect, createMemo } from 'solid-js';
import { ImageAgent } from './ImageAgent';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { cn } from '~/lib/utils';
import { useQuery } from '~/lib/convex';
import { convexApi, convexClient } from '~/lib/convex';
import { useRouteContext } from '@tanstack/solid-router';

class Agent {
  constructor(
    public id: string,
    public prompt: string = '',
    public position: { x: number; y: number } = { x: 0, y: 0 },
    public size: { width: number; height: number } = { width: 320, height: 384 },
    public generatedImage: string = '',
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
  
  // Local state
  const [agents, setAgents] = createSignal<Agent[]>([]);
  const [isLoaded, setIsLoaded] = createSignal(false);
  const [draggedAgent, setDraggedAgent] = createSignal<string | null>(null);
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = createSignal(false);
  const [resizingAgent, setResizingAgent] = createSignal<string | null>(null);
  const [resizeHandle, setResizeHandle] = createSignal<string | null>(null); // 'nw', 'ne', 'sw', 'se'
  const [resizeStartSize, setResizeStartSize] = createSignal({ width: 0, height: 0 });
  const [resizeStartPos, setResizeStartPos] = createSignal({ x: 0, y: 0 });
  
  // Create canvas if it doesn't exist
  createEffect(async () => {
    if (userId() && canvas() === null && !isLoaded()) {
      try {
        await convexClient.mutation(convexApi.canvas.createCanvas, {
          userId: userId()!,
        });
      } catch (error) {
        console.error('Failed to create canvas:', error);
      }
    }
  });

  // Load agents from Convex when data is available
  createEffect(() => {
    if (dbAgents() && !isLoaded()) {
      const loadedAgents = dbAgents()!.map(agent => 
        new Agent(
          agent._id,
          agent.prompt,
          { x: agent.positionX, y: agent.positionY },
          { width: agent.width, height: agent.height },
          agent.imageUrl || '',
          0
        )
      );
      setAgents(loadedAgents);
      setIsLoaded(true);
    }
  });

  // Debounced save for transforms
  const debouncedSaves = new Map<string, NodeJS.Timeout>();
  
  const saveAgentTransform = (agentId: string, position: { x: number; y: number }, size: { width: number; height: number }) => {
    if (!canvas()?._id) return;
    
    // Clear existing timeout
    const existingTimeout = debouncedSaves.get(agentId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Set new timeout
    const timeout = setTimeout(() => {
      convexClient.mutation(convexApi.agents.updateAgentTransform, {
        agentId: agentId as any,
        positionX: position.x,
        positionY: position.y,
        width: size.width,
        height: size.height,
      });
      debouncedSaves.delete(agentId);
    }, 500);
    
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
      const agentId = await convexClient.mutation(convexApi.agents.createAgent, {
        canvasId: canvas()!._id,
        userId: userId()!,
        prompt: prompt || '',
        positionX: newX,
        positionY: newY,
        width: 320,
        height: 384,
      });
      
      // Then update local state
      const newAgent = new Agent(
        agentId,
        prompt || '',
        { x: newX, y: newY },
        { width: 320, height: 384 },
        '',
        0
      );
      setAgents(prev => [...prev, newAgent]);
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
      
      // Update local state
      setAgents(prev => prev.filter(agent => agent.id !== id));
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const updateAgentPosition = (id: string, position: { x: number; y: number }) => {
    // Update local state immediately
    setAgents(prev => prev.map(agent => 
      agent.id === id ? { ...agent, position } : agent
    ));
    
    // Find agent for size
    const agent = agents().find(a => a.id === id);
    if (agent) {
      saveAgentTransform(id, position, agent.size);
    }
  };

  const updateAgentSize = (id: string, size: { width: number; height: number }) => {
    // Update local state immediately
    setAgents(prev => prev.map(agent => 
      agent.id === id ? { ...agent, size } : agent
    ));
    
    // Find agent for position
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
    
    // Update local state immediately
    setAgents(prev => prev.map(agent => 
      agent.id === id ? { ...agent, generatedImage } : agent
    ));
    
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
    
    // Update local state immediately
    setAgents(prev => prev.map(agent => 
      agent.id === id ? { ...agent, prompt } : agent
    ));
    
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

  const handleMouseDown = (e: MouseEvent, agentId: string) => {
    e.preventDefault();
    const agent = agents().find(a => a.id === agentId);
    if (!agent) return;

    setDraggedAgent(agentId);
    setIsDragging(true);
    
    // Calculate offset from mouse to agent's top-left corner
    const canvasEl = document.querySelector('.canvas-container') as HTMLElement;
    if (canvasEl) {
      const canvasRect = canvasEl.getBoundingClientRect();
      const offsetX = e.clientX - (canvasRect.left + (agent.position?.x || 0));
      const offsetY = e.clientY - (canvasRect.top + (agent.position?.y || 0));
      setDragOffset({ x: offsetX, y: offsetY });
    }

    // Add global mouse move and up listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    const agentId = draggedAgent();
    if (!agentId || !isDragging()) return;

    const canvasEl = document.querySelector('.canvas-container') as HTMLElement;
    if (!canvasEl) return;

    const canvasRect = canvasEl.getBoundingClientRect();
    const offset = dragOffset();
    
    // Calculate new position relative to canvas
    let newX = e.clientX - canvasRect.left - offset.x + canvasEl.scrollLeft;
    let newY = e.clientY - canvasRect.top - offset.y + canvasEl.scrollTop;

    // Constrain to canvas boundaries (with some padding)
    const agentWidth = 320; // 80 * 4 (w-80 = 20rem = 320px)
    const agentHeight = 384; // 96 * 4 (h-96 = 24rem = 384px)
    
    const maxX = Math.max(0, canvasEl.clientWidth - agentWidth);
    const maxY = Math.max(0, canvasEl.clientHeight - agentHeight);
    
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    updateAgentPosition(agentId, { x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setDraggedAgent(null);
    setIsDragging(false);
    setResizingAgent(null);
    setResizeHandle(null);
    
    // Remove global listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('mousemove', handleResizeMove);
  };

  const handleResizeStart = (e: MouseEvent, agentId: string, handle: string) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent drag from starting
    
    const agent = agents().find(a => a.id === agentId);
    if (!agent) return;

    setResizingAgent(agentId);
    setResizeHandle(handle);
    setResizeStartSize(agent.size || { width: 320, height: 384 });
    setResizeStartPos({ x: e.clientX, y: e.clientY });

    // Add global mouse move listener for resize
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeMove = (e: MouseEvent) => {
    const agentId = resizingAgent();
    const handle = resizeHandle();
    if (!agentId || !handle) return;

    const startSize = resizeStartSize();
    const startPos = resizeStartPos();
    
    const deltaX = e.clientX - startPos.x;
    const deltaY = e.clientY - startPos.y;

    let newWidth = startSize.width;
    let newHeight = startSize.height;

    // Calculate new size based on resize handle
    switch (handle) {
      case 'se': // Bottom-right
        newWidth = startSize.width + deltaX;
        newHeight = startSize.height + deltaY;
        break;
      case 'sw': // Bottom-left  
        newWidth = startSize.width - deltaX;
        newHeight = startSize.height + deltaY;
        break;
      case 'ne': // Top-right
        newWidth = startSize.width + deltaX;
        newHeight = startSize.height - deltaY;
        break;
      case 'nw': // Top-left
        newWidth = startSize.width - deltaX;
        newHeight = startSize.height - deltaY;
        break;
    }

    // Apply constraints
    const minWidth = 200;
    const maxWidth = 600;
    const minHeight = 250;
    const maxHeight = 800;

    newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
    newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));

    updateAgentSize(agentId, { width: newWidth, height: newHeight });

    // For left/top handles, also update position to keep the opposite corner fixed
    if (handle.includes('w') || handle.includes('n')) {
      const agent = agents().find(a => a.id === agentId);
      if (agent && agent.position) {
        let newX = agent.position.x;
        let newY = agent.position.y;
        
        if (handle.includes('w')) { // Left side
          newX = agent.position.x + (startSize.width - newWidth);
        }
        if (handle.includes('n')) { // Top side
          newY = agent.position.y + (startSize.height - newHeight);
        }
        
        updateAgentPosition(agentId, { x: newX, y: newY });
      }
    }
  };

  return (
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
                setAgents([]);
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
        <Show when={!isLoaded() && !dbAgents()}>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center">
              <Icon name="loader" class="h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p class="text-sm text-muted-foreground">Loading canvas...</p>
            </div>
          </div>
        </Show>

        <Show when={isLoaded() && agents().length === 0}>
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
          {(agent) => (
            <div
              class="absolute select-none"
              style={{
                left: `${agent.position.x}px`,
                top: `${agent.position.y}px`,
                transform: draggedAgent() === agent.id ? 'scale(1.05)' : 'scale(1)',
                transition: draggedAgent() === agent.id ? 'none' : 'transform 0.2s ease',
                'z-index': draggedAgent() === agent.id ? 50 : 1
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
                class={cn(
                  "shadow-lg border-2 transition-all duration-200",
                  draggedAgent() === agent.id 
                    ? "border-primary shadow-xl" 
                    : resizingAgent() === agent.id
                    ? "border-secondary shadow-lg"
                    : "border-transparent hover:border-muted-foreground/20"
                )}
              />
            </div>
          )}
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
  );
}
