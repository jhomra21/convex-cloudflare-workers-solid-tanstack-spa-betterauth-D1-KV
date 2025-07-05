import { createSignal, For, Show, createEffect, onCleanup, onMount } from 'solid-js';
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
import { useViewport } from '~/lib/hooks/use-viewport';
import { useAgentManagement } from '~/lib/hooks/use-agent-management';
import { useZIndexManagement } from '~/lib/hooks/use-z-index-management';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { toast } from 'solid-sonner';

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
  const canvas = () => props.activeCanvasId ? specificCanvas.data() : defaultCanvas.data();
  
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
  // Hooks
  // =============================================
  
  // Viewport management
  const viewport = useViewport({ 
    userCanvas: userOwnCanvas.data, 
    userId 
  });
  
  // Agent management
  const agentManagement = useAgentManagement({
    canvas,
    userId,
    dbAgents,
    viewport: viewport.viewport,
  });
  
  // Z-index management
  const zIndexManagement = useZIndexManagement();
  
  // =============================================
  // Mutations
  // =============================================
  const createCanvasMutation = useMutation();
  
  // Canvas container reference
  let canvasContainerEl: HTMLDivElement | null = null;
  
  // =============================================
  // Effects and Derived State
  // =============================================
  
  // Attach wheel listener once container ref is available
  onMount(() => {
    if (!canvasContainerEl) return;
    const handler = viewport.createWheelHandler(canvasContainerEl);
    canvasContainerEl.addEventListener('wheel', handler, { passive: false });
    onCleanup(() => canvasContainerEl?.removeEventListener('wheel', handler));
  });
  
  // Restore viewport state when canvas loads
  createEffect(() => {
    viewport.restoreViewport();
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

  // Use destructured values from agent management hook
  const {
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
  } = agentManagement;

  // =============================================
  // Drag and Resize Hooks
  // =============================================

  // =============================================
  // Event Handlers
  // =============================================

  // Get Z-index functions from hook
  const { bringAgentToFront, getAgentZIndex } = zIndexManagement;

  // Use custom hooks for drag and resize
  const dragHook = useCanvasDrag({
    onDragStart: bringAgentToFront,
    onDragEnd: (agentId, finalPosition) => {
      updateAgentPosition(agentId, finalPosition);
    },
    constrainToBounds: false,
    agentSize: { width: 320, height: 384 },
    viewportGetter: () => viewport.viewport(),
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
    onResizeEnd: () => {
      // Agent management hook handles saving
    },
    viewportGetter: () => viewport.viewport(),
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
          class="canvas-container flex-1 relative overflow-hidden bg-muted/30 border-2 border-dashed border-muted-foreground/20 min-h-0 rounded-xl"
          ref={(el) => (canvasContainerEl = el)}
          onPointerDown={viewport.handlePanPointerDown}
          style={{
            "background-image": "radial-gradient(circle, hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px)",
            "background-size": `20px 20px`
          }}
        >
          <div 
            class="canvas-content"
            style={{
              'min-width': '100%',
              'min-height': '100%',
              transform: `translate(${Math.round(viewport.viewport().tx)}px, ${Math.round(viewport.viewport().ty)}px) scale(${viewport.viewport().zoom})`,
              'transform-origin': 'top left',
              'image-rendering': 'crisp-edges',
              'backface-visibility': 'hidden',
              'transform-style': 'preserve-3d',
              transition: 'transform 0.1s ease-out'
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
                onClick={() => viewport.zoomOut(canvasContainerEl)}
                size="sm"
                variant="ghost"
                disabled={viewport.viewport().zoom <= viewport.MIN_ZOOM}
                class="h-6 w-6 p-0"
                title="Zoom Out"
              >
                <span class="text-xs font-bold">−</span>
              </Button>
              <span class="text-xs text-muted-foreground min-w-12 text-center font-mono">
                {Math.round(viewport.viewport().zoom * 100)}%
              </span>
              <Button
                onClick={() => viewport.zoomIn(canvasContainerEl)}
                size="sm"
                variant="ghost"
                disabled={viewport.viewport().zoom >= viewport.MAX_ZOOM}
                class="h-6 w-6 p-0"
                title="Zoom In"
              >
                <span class="text-xs font-bold">+</span>
              </Button>
              <Button
                onClick={viewport.resetZoom}
                size="sm"
                variant="ghost"
                disabled={viewport.viewport().zoom === 1.0}
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

      {/* Empty State Overlay */}
      <Show when={canvas() && dbAgents.data() && agents().length === 0}>
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="text-center pointer-events-auto">
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
    </ErrorBoundary>
  );
}
