import { createSignal, For, Show, createEffect, onCleanup, onMount, batch, Index } from 'solid-js';
import { MemoizedImageAgent } from './MemoizedImageAgent';
import { MemoizedVoiceAgent } from './MemoizedVoiceAgent';
import { MemoizedVideoAgent } from './MemoizedVideoAgent';
import { AgentConnection } from './AgentConnection';
import { FloatingCanvasToolbar } from './FloatingCanvasToolbar';
import { FloatingCanvasControls } from './FloatingCanvasControls';
import { FloatingChatInterface } from './FloatingChatInterface';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { cn } from '~/lib/utils';
import { convexApi, useConvexQuery, useConvexMutation } from '~/lib/convex';
import { useCurrentUserId, useCurrentUserName } from '~/lib/auth-actions';
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

  const userId = useCurrentUserId();
  const userName = useCurrentUserName();
  const [hasRedirected, setHasRedirected] = createSignal(false);

  // Canvas data - choose query based on activeCanvasId
  const defaultCanvas = useConvexQuery(
    convexApi.canvas.getCanvas,
    () => {
      const currentUserId = userId();
      const isSharedCanvas = !!props.activeCanvasId;
      return (!isSharedCanvas && currentUserId) ? { userId: currentUserId } : null;
    },
    () => ['canvas', 'default', userId()]
  );

  const specificCanvas = useConvexQuery(
    convexApi.canvas.getCanvasById,
    () => {
      const currentUserId = userId();
      const activeId = props.activeCanvasId;
      return (activeId && currentUserId) ? { canvasId: activeId as any, userId: currentUserId } : null;
    },
    () => ['canvas', 'specific', props.activeCanvasId, userId()]
  );

  // Current active canvas data
  const canvas = () => props.activeCanvasId ? specificCanvas.data : defaultCanvas.data;

  // Agent count derived from active agents (excluding deleting ones)
  const agentCount = () => {
    const allAgents = agentManagement.agents();
    const deletingAgentIds = new Set(agentManagement.deletingAgents().map(a => a.id));
    return allAgents.filter(a => !deletingAgentIds.has(a.id)).length || 0;
  };

  // User's agent count for any shared canvas activity
  const userAgentCount = () => {
    const isSharedActivity = !!props.activeCanvasId || !!canvas()?.isShareable;
    if (!isSharedActivity) return 0; // Not involved in sharing
    const allAgents = agentManagement.agents();
    const deletingAgentIds = new Set(agentManagement.deletingAgents().map(a => a.id));
    return allAgents.filter(a => a.userId === userId() && !deletingAgentIds.has(a.id)).length || 0;
  };

  // Viewport management - now uses separate viewport storage
  const viewport = useViewport({
    canvasId: () => canvas()?._id || null,
    userId
  });

  // Agent management
  const agentManagement = useAgentManagement({
    canvas,
    userId,
    userName,
    viewport: viewport.viewport,
    isSharedCanvas: () => !!props.activeCanvasId,
    isCanvasOwner: () => {
      const canvasData = canvas();
      return canvasData?.userId === userId();
    },
  });

  // Z-index management
  const zIndexManagement = useZIndexManagement();


  const createCanvasMutation = useConvexMutation(convexApi.canvas.createCanvas);

  // Canvas container reference
  let canvasContainerEl: HTMLDivElement | null = null;

  // Attach wheel listener once container ref is available
  onMount(() => {
    if (!canvasContainerEl) return;
    const handler = viewport.createWheelHandler(canvasContainerEl);
    canvasContainerEl.addEventListener('wheel', handler, { passive: false });
    onCleanup(() => canvasContainerEl?.removeEventListener('wheel', handler));
  });

  // Viewport is now automatically restored via the viewport hook

  // Create canvas if it doesn't exist (but not when shared canvas becomes inaccessible)
  // Add a flag to prevent duplicate creation attempts
  const [isCreatingCanvas, setIsCreatingCanvas] = createSignal(false);
  const [hasAttemptedCanvasCreation, setHasAttemptedCanvasCreation] = createSignal(false);

  createEffect(() => {
    const currentUserId = userId();
    const currentCanvas = canvas();
    const isSharedCanvas = !!props.activeCanvasId;
    const creatingCanvas = isCreatingCanvas();
    const hasAttempted = hasAttemptedCanvasCreation();

    // Guard: Only create canvas for authenticated users on their own canvas (not shared)
    if (!currentUserId || isSharedCanvas || creatingCanvas || hasAttempted) {
      return;
    }

    // Guard: Only proceed if canvas is explicitly null (not undefined/loading)
    // Also check if the default canvas query has actually completed
    if (currentCanvas !== null || defaultCanvas.isLoading || defaultCanvas.isFetching) {
      return;
    }

    // Additional guard: Only proceed if we're sure the query has completed and returned null
    if (defaultCanvas.data === undefined) {
      return;
    }

    // Mark that we've attempted creation to prevent re-runs
    batch(() => {
      setHasAttemptedCanvasCreation(true);
      setIsCreatingCanvas(true);
    });

    // Use async function to avoid effect returning promise
    (async () => {
      try {
        await createCanvasMutation.mutate({
          userId: currentUserId,
          userName: userName(),
        });
        // Success: canvas created, reset creating flag
        setIsCreatingCanvas(false);
      } catch (error) {
        console.error('Failed to create canvas:', error);
        // Reset both flags on error to allow retry
        batch(() => {
          setHasAttemptedCanvasCreation(false);
          setIsCreatingCanvas(false);
        });
      }
    })();
  });

  // Watch for when a shared canvas becomes inaccessible and fallback to user's own canvas
  createEffect(() => {
    const activeCanvasId = props.activeCanvasId;
    const currentUserId = userId();
    const hasAlreadyRedirected = hasRedirected();

    // Guard: Only handle this for shared canvases (when activeCanvasId is provided)
    if (!activeCanvasId || !currentUserId || hasAlreadyRedirected) {
      return;
    }

    const canvasData = specificCanvas.data;

    // Guard: Only act when we have a definitive null result (not loading/undefined)
    if (canvasData !== null) {
      return;
    }

    // Guard: Only redirect if the query has actually completed (not still loading)
    if (specificCanvas.isLoading || specificCanvas.isFetching) {
      return;
    }

    // If we were trying to access a specific canvas but it's now null,
    // it means sharing was disabled or access was revoked
    setHasRedirected(true); // Prevent multiple calls
    toast.error('Canvas sharing has been disabled by the owner. Switched to your canvas.');
    props.onCanvasDisabled?.();
  });

  // Use destructured values from agent management hook
  const {
    agents,
    connectedAgentPairs,
    availableAgents,
    activeAgentType,
    deletingAgents,
    addAgent,
    removeAgent,
    connectAgents,
    disconnectAgent,
    clearCanvas,
    updateAgentPosition,
    updateAgentSize,
    updateAgentSizeAndPosition,
    updateAgentPrompt,
    handleAnimationEnd,
  } = agentManagement;

  // Get Z-index functions from hook
  const { bringAgentToFront, getAgentZIndex } = zIndexManagement;

  // Track recently dragged agents to prevent hover flashing
  const [recentlyDraggedAgents, setRecentlyDraggedAgents] = createSignal<Set<string>>(new Set());

  // Use custom hooks for drag and resize
  const dragHook = useCanvasDrag({
    onDragStart: bringAgentToFront,
    onDragEnd: (agentId, finalPosition) => {
      updateAgentPosition(agentId, finalPosition);

      // Add to recently dragged set to prevent hover flashing
      setRecentlyDraggedAgents(prev => new Set(prev).add(agentId));

      // Remove from recently dragged after a brief delay
      setTimeout(() => {
        setRecentlyDraggedAgents(prev => {
          const newSet = new Set(prev);
          newSet.delete(agentId);
          return newSet;
        });
      }, 85); // 200ms cooldown
    },
    constrainToBounds: false,
    agentSize: { width: 320, height: 384 },
    viewportGetter: () => viewport.viewport(),
  });

  const resizeHook = useCanvasResize({
    onResizeEnd: (agentId, finalSize, finalPosition) => {
      if (finalPosition) {
        // Use combined update for resize handles that need position adjustment
        updateAgentSizeAndPosition(agentId, finalSize, finalPosition);
      } else {
        // Use size-only update for bottom-right handle
        updateAgentSize(agentId, finalSize);
      }
    },
    viewportGetter: () => viewport.viewport(),
  });

  // Mouse down handler for agent dragging
  const handleMouseDown = (e: MouseEvent, agentId: string) => {
    // Only handle left mouse button for agent dragging
    if (e.button !== 0) return;

    const currentAgents = agents();
    const agent = currentAgents.find(a => a.id === agentId);
    if (!agent) {
      console.warn('Agent not found:', agentId);
      return;
    }

    bringAgentToFront(agentId);
    dragHook.handleMouseDown(e, agentId, agent.position);
  };

  // Resize start handler for agent resizing
  const handleResizeStart = (e: MouseEvent, agentId: string, handle: string) => {
    // Only handle left mouse button for resizing
    if (e.button !== 0) return;

    const agent = agents().find(a => a.id === agentId);
    if (!agent) return;

    e.stopPropagation(); // Prevent canvas panning during resize
    bringAgentToFront(agentId);
    resizeHook.handleResizeStart(e, agentId, handle, agent.size);
  };

  // Helper methods for the toolbar
  const handleAddGenerateAgent = () => addAgent('', 'image-generate');
  const handleAddEditAgent = () => addAgent('', 'image-edit');
  const handleAddVoiceAgent = () => addAgent('', 'voice-generate');
  const handleAddVideoAgent = () => addAgent('', 'video-generate');

  // Helper methods for zoom controls that get the current canvas container ref
  const handleZoomIn = () => {
    if (!canvasContainerEl) {
      console.warn('Canvas container element not available for zoom in');
      return;
    }
    viewport.zoomIn(canvasContainerEl);
  };
  const handleZoomOut = () => {
    if (!canvasContainerEl) {
      console.warn('Canvas container element not available for zoom out');
      return;
    }
    viewport.zoomOut(canvasContainerEl);
  };

  // Load toolbar minimized state from localStorage synchronously
  const getToolbarState = () => typeof window !== 'undefined'
    ? localStorage.getItem('canvas-toolbar-minimized') === 'true'
    : false;
  const getControlsState = () => typeof window !== 'undefined'
    ? localStorage.getItem('canvas-controls-minimized') === 'true'
    : false;

  const [toolbarMinimized, setToolbarMinimized] = createSignal(getToolbarState());
  const [controlsMinimized, setControlsMinimized] = createSignal(getControlsState());

  // AI Chat management for floating interface
  const [isChatProcessing, setIsChatProcessing] = createSignal(false);

  // Query chat history from Convex
  const chatHistoryQuery = useConvexQuery(
    convexApi.agents.getChatHistory,
    () => (canvas()?._id && userId()) ? {
      canvasId: canvas()!._id,
      userId: userId()!
    } : null,
    () => ['chat-history', canvas()?._id, userId()]
  );

  // Get chat history from query or empty array
  const chatHistory = () => chatHistoryQuery.data || [];

  // Handle chat message sending
  const handleSendChatMessage = async (message: string, contextItems: any[] = [], uploadedFiles: File[] = []) => {
    if (!canvas()?._id || !userId()) return;

    setIsChatProcessing(true);

    try {
      // Extract actual agent IDs from context items
      // Context items for agents have IDs in format "agent:${actualAgentId}"
      const referencedAgentIds = contextItems
        .filter(item => item.id?.startsWith('agent:'))
        .map(item => item.id.replace('agent:', ''));

      // Process uploaded files to FormData if any
      let body: string | FormData;
      let headers: Record<string, string> = {};

      if (uploadedFiles.length > 0) {
        // Use FormData for file uploads
        const formData = new FormData();
        formData.append('message', message);
        formData.append('chatAgentId', `floating-chat-${userId()}`);
        formData.append('canvasId', canvas()!._id);
        formData.append('referencedAgents', JSON.stringify(referencedAgentIds));

        uploadedFiles.forEach((file, index) => {
          formData.append(`uploadedFiles`, file);
        });

        body = formData;
      } else {
        // Use JSON for text-only messages
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({
          message,
          chatAgentId: `floating-chat-${userId()}`,
          canvasId: canvas()!._id,
          referencedAgents: referencedAgentIds,
          uploadedFiles: []
        });
      }

      const response = await fetch('/api/ai-chat/process', {
        method: 'POST',
        headers,
        body
      });

      if (!response.ok) {
        throw new Error('Failed to process message');
      }

      const result = await response.json();

      if (result.success) {
        // Create enhanced response with agent status
        let enhancedResponse = result.response;

        if (result.createdAgents?.length > 0) {
          const agentStatusText = result.createdAgents.map((agentId: string, index: number) => {
            const operation = result.operations?.[index];
            if (operation) {
              return `🔄 ${operation.type.replace('-', ' ')} agent: "${operation.prompt.substring(0, 50)}${operation.prompt.length > 50 ? '...' : ''}"`;
            }
            return `🔄 Agent ${index + 1}: Processing...`;
          }).join('\n');

          enhancedResponse += `\n\n**Created Agents:**\n${agentStatusText}`;
          toast.success(`Created ${result.createdAgents.length} agent(s) - generating in parallel`);
        }

        // Chat history will be updated automatically via the Convex query
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');

      // Error handling - could add error message to database if needed
    } finally {
      setIsChatProcessing(false);
    }
  };

  return (
    <ErrorBoundary>
      <div class={cn("h-full overflow-hidden relative", props.class)}>
        {/* Canvas - now takes full height */}
        <div
          class="canvas-container h-full relative overflow-hidden bg-muted/30 border-2 border-dashed border-muted-foreground/20 min-h-0 rounded-xl cursor-grab active:cursor-grabbing"
          ref={(el) => (canvasContainerEl = el)}
          onPointerDown={(e) => {
            // Handle middle mouse button panning (always)
            if (e.button === 1) {
              viewport.handlePanPointerDown(e);
              return;
            }

            // Handle left mouse button panning only on canvas container itself
            if (e.button === 0 && e.target === e.currentTarget) {
              e.preventDefault();
              e.stopPropagation();
              viewport.startPanning(e);
            }
          }}
          style={{
            "background-image": "radial-gradient(circle, hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px)",
            "background-size": `20px 20px`
          }}
        >
          <div
            class="canvas-content absolute inset-0"
            style={{
              width: '200vw', // Make canvas content larger for infinite feel
              height: '200vh',
              transform: `translate(${viewport.viewport().tx}px, ${viewport.viewport().ty}px) scale(${viewport.viewport().zoom})`,
              'transform-origin': 'top left',
              'image-rendering': 'crisp-edges',
              'backface-visibility': 'hidden',
              'transform-style': 'preserve-3d'
            }}
            onPointerDown={(e) => {
              // Handle panning on canvas content (empty areas)
              if (e.button === 0 && e.target === e.currentTarget) {
                e.preventDefault();
                e.stopPropagation();
                viewport.startPanning(e);
              }
              // Handle middle mouse panning anywhere on canvas content
              else if (e.button === 1) {
                viewport.handlePanPointerDown(e);
              }
            }}
          >
            {/* Loading State */}
            <Show when={!canvas() || isCreatingCanvas() || (defaultCanvas.isLoading && !props.activeCanvasId) || (specificCanvas.isLoading && !!props.activeCanvasId)}>
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="text-center">
                  <Icon name="loader" class="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                  <p class="text-sm text-muted-foreground">
                    {isCreatingCanvas() ? 'Setting up your canvas...' : 'Loading canvas...'}
                  </p>
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

            {/* Agents - keyed For to maintain stable DOM nodes while still leveraging memoized children for performance */}
            <For each={agents()}>{(agent) => {
                // Calculate current interaction state
                const isDragged = () => dragHook.draggedAgent() === agent.id;
                const isResizing = () => resizeHook.resizingAgent() === agent.id;
                const zIndex = () => getAgentZIndex(agent.id, isDragged());

                // Calculate animation state
                const isExiting = () => deletingAgents().some(deletingAgent => deletingAgent.id === agent.id);



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
                      onSizeChange={updateAgentSize}
                      onPromptChange={updateAgentPrompt}
                      onAnimationEnd={handleAnimationEnd}
                    />
                  );
                } else if (agent.type === 'video-generate' || agent.type === 'video-image-to-video') {
                  return (
                    <MemoizedVideoAgent
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
                      onAnimationEnd={handleAnimationEnd}
                      class={cn(
                        "shadow-lg border-2 transition-all duration-200",
                        isDragged() ? "border-primary/50 shadow-xl" : "border-border/50"
                      )}
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
                    isRecentlyDragged={recentlyDraggedAgents().has(agent.id)}
                    availableAgents={availableAgents()}
                    onRemove={removeAgent}
                    onMouseDown={(e) => handleMouseDown(e, agent.id)}
                    onResizeStart={(e, handle) => handleResizeStart(e, agent.id, handle)}
                    onSizeChange={updateAgentSize}
                    onPromptChange={updateAgentPrompt}
                    onConnectAgent={connectAgents}
                    onDisconnectAgent={disconnectAgent}
                    onAnimationEnd={handleAnimationEnd}
                  />
                );
              }}
            </For>
          </div>
        </div>

        {/* Floating Toolbar - positioned at top center */}
        <FloatingCanvasToolbar
          activeAgentType={activeAgentType()}
          agentCount={agentCount()}
          userAgentCount={userAgentCount()}
          isSharedCanvas={!!props.activeCanvasId}
          isOwnerSharingCanvas={!props.activeCanvasId && !!canvas()?.isShareable}
          isCanvasOwner={canvas()?.userId === userId()}
          canvasId={canvas()?._id}
          currentUserId={userId()}
          canvasName={canvas()?.name}
          onAddGenerateAgent={handleAddGenerateAgent}
          onAddEditAgent={handleAddEditAgent}
          onAddVoiceAgent={handleAddVoiceAgent}
          onAddVideoAgent={handleAddVideoAgent}
          onClearCanvas={clearCanvas}
          isMinimized={toolbarMinimized()}
          onToggleMinimize={setToolbarMinimized}
        />

        {/* Floating Controls - positioned at bottom right */}
        <FloatingCanvasControls
          zoom={viewport.viewport().zoom}
          minZoom={viewport.MIN_ZOOM}
          maxZoom={viewport.MAX_ZOOM}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={viewport.resetZoom}
          onResetView={viewport.resetZoom} // Use resetZoom which resets position and zoom
          position="bottom-center"
          isMinimized={controlsMinimized()}
          onToggleMinimize={setControlsMinimized}
        />
      </div>

      {/* Empty State Overlay */}
      <Show when={canvas() && agentCount() === 0}>
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


      {/* Floating Chat Interface - positioned above canvas content */}
      <Show when={canvas()?._id && userId()}>
        <FloatingChatInterface
          canvasId={canvas()!._id}
          userId={userId()!}
          userName={userName()}
          chatHistory={chatHistory()}
          isProcessing={isChatProcessing()}
          availableAgents={availableAgents()}
          onSendMessage={handleSendChatMessage}
        />
      </Show>
    </ErrorBoundary>
  );
}
