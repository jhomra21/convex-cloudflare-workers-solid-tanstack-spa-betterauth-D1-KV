import { createSignal, onCleanup, createEffect } from 'solid-js';
import { convexApi, useConvexMutation, useConvexQuery, useConvexConnectionStatus } from '~/lib/convex';
import {
  getLocalViewport,
  saveLocalViewport,
  resolveInitialViewport,
} from '~/lib/utils/viewport-storage';

export interface ViewportState {
  tx: number;
  ty: number;
  zoom: number;
}

export interface UseViewportProps {
  canvasId: () => string | null;
  userId: () => string | null;
}

export function useViewport(props: UseViewportProps) {
  // Viewport state management
  const [viewport, setViewport] = createSignal<ViewportState>({
    tx: 0,
    ty: 0,
    zoom: 0.25,
  });

  // Monitor connection status for better UX
  const connectionState = useConvexConnectionStatus();

  // Zoom constraints
  const MIN_ZOOM = 0.01; // 1%
  const MAX_ZOOM = 2.0; // 200%
  const ZOOM_STEP = 0.1; // 10% increments for button clicks

  // Signal to control when we need to query Convex
  const [needsConvexQuery, setNeedsConvexQuery] = createSignal(false);

  // Check if we need to query Convex on canvas/user change
  createEffect(() => {
    const canvasId = props.canvasId();
    const userId = props.userId();

    if (!canvasId || !userId) {
      setNeedsConvexQuery(false);
      return;
    }

    const localViewport = getLocalViewport(canvasId, userId);
    // Only query Convex if no local viewport exists
    setNeedsConvexQuery(!localViewport);
  });

  const viewportData = useConvexQuery(
    convexApi.viewports.getUserViewport,
    () => {
      if (!needsConvexQuery()) return null;
      return (props.userId() && props.canvasId()) ? {
        userId: props.userId()!,
        canvasId: props.canvasId()! as any
      } : null;
    },
    () => ['viewport', props.userId(), props.canvasId()]
  );

  // Mutations
  const updateViewportMutation = useConvexMutation(convexApi.viewports.updateUserViewport);

  // Smooth zoom animation state
  let animationId: number | null = null;
  let targetViewport: ViewportState | null = null;
  const ZOOM_ANIMATION_DURATION = 150; // ms
  let animationStartTime = 0;
  let startViewport: ViewportState | null = null;

  // Constrain zoom level to safe bounds
  const constrainZoom = (zoom: number) => {
    const constrained = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    // Add small epsilon to prevent floating point precision issues
    return Math.round(constrained * 10000) / 10000;
  };

  // Smooth animation function
  const animateToViewport = (target: ViewportState) => {
    // Cancel any ongoing zoom animation
    if (animationId) {
      cancelAnimationFrame(animationId);
    }

    // Don't start zoom animation if panning is active
    if (isPanning) {
      setViewport(target);
      saveViewportState(target);
      return;
    }

    startViewport = { ...viewport() };
    targetViewport = target;
    animationStartTime = performance.now();

    const animate = (currentTime: number) => {
      // Check if panning started during animation
      if (isPanning) {
        animationId = null;
        targetViewport = null;
        startViewport = null;
        return;
      }

      const elapsed = currentTime - animationStartTime;
      const progress = Math.min(elapsed / ZOOM_ANIMATION_DURATION, 1);

      // Use easeOutCubic for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      if (startViewport && targetViewport) {
        const current = {
          tx: startViewport.tx + (targetViewport.tx - startViewport.tx) * easeProgress,
          ty: startViewport.ty + (targetViewport.ty - startViewport.ty) * easeProgress,
          zoom: startViewport.zoom + (targetViewport.zoom - startViewport.zoom) * easeProgress,
        };

        setViewport(current);

        if (progress < 1) {
          animationId = requestAnimationFrame(animate);
        } else {
          // Animation complete
          setViewport(targetViewport);
          saveViewportState(targetViewport);
          animationId = null;
          targetViewport = null;
          startViewport = null;
        }
      }
    };

    animationId = requestAnimationFrame(animate);
  };

  // Track last synced viewport to prevent duplicate saves
  let lastSyncedViewport: ViewportState | null = null;
  let isSyncing = false;

  // Force immediate Convex save (for special cases like page unload)
  const forceConvexSync = async (newViewport: ViewportState) => {
    const canvasId = props.canvasId();
    const userId = props.userId();
    if (!canvasId || !userId) return;

    // Always save to localStorage first (local-first)
    saveLocalViewport(newViewport, canvasId, userId);

    // Cancel any pending debounced save since we're saving immediately
    if (convexSaveTimeout) {
      clearTimeout(convexSaveTimeout);
      convexSaveTimeout = null;
    }

    // Prevent duplicate syncs if already syncing or viewport hasn't changed
    if (isSyncing) return;

    if (lastSyncedViewport &&
      Math.abs(lastSyncedViewport.tx - newViewport.tx) < 0.1 &&
      Math.abs(lastSyncedViewport.ty - newViewport.ty) < 0.1 &&
      Math.abs(lastSyncedViewport.zoom - newViewport.zoom) < 0.001) {
      return; // No significant change since last sync
    }

    // Check if viewport actually changed from Convex data to avoid unnecessary saves
    const currentData = viewportData.data;
    if (currentData &&
      Math.abs(currentData.x - newViewport.tx) < 0.1 &&
      Math.abs(currentData.y - newViewport.ty) < 0.1 &&
      Math.abs(currentData.zoom - newViewport.zoom) < 0.001) {
      lastSyncedViewport = { ...newViewport };
      return; // No significant change
    }

    isSyncing = true;
    try {
      updateViewportMutation.mutate({
        userId,
        canvasId: canvasId as any,
        x: newViewport.tx,
        y: newViewport.ty,
        zoom: newViewport.zoom,
      });
      lastSyncedViewport = { ...newViewport };
    } catch (error) {
      console.error('Failed to force sync viewport state to Convex:', error);
    } finally {
      isSyncing = false;
    }
  };

  // Local-first viewport save with 20-second debounced Convex backup
  let convexSaveTimeout: any;

  const saveViewportState = (newViewport: ViewportState) => {
    const canvasId = props.canvasId();
    const userId = props.userId();
    if (!canvasId || !userId) return;

    // Always save to localStorage immediately (local-first)
    saveLocalViewport(newViewport, canvasId, userId);

    // Only attempt Convex save if connected
    if (!connectionState().isWebSocketConnected) {
      return; // Skip Convex save when disconnected
    }

    // Debounce Convex save for 20 seconds
    if (convexSaveTimeout) {
      clearTimeout(convexSaveTimeout);
    }

    convexSaveTimeout = setTimeout(async () => {
      // Double-check connection before saving
      if (!connectionState().isWebSocketConnected) {
        return; // Skip if disconnected
      }

      // Check if viewport actually changed to avoid unnecessary saves
      const currentData = viewportData.data;
      if (currentData &&
        Math.abs(currentData.x - newViewport.tx) < 0.1 &&
        Math.abs(currentData.y - newViewport.ty) < 0.1 &&
        Math.abs(currentData.zoom - newViewport.zoom) < 0.001) {
        return; // No significant change
      }

      // Check if we already synced this viewport
      if (lastSyncedViewport &&
        Math.abs(lastSyncedViewport.tx - newViewport.tx) < 0.1 &&
        Math.abs(lastSyncedViewport.ty - newViewport.ty) < 0.1 &&
        Math.abs(lastSyncedViewport.zoom - newViewport.zoom) < 0.001) {
        return; // Already synced this viewport
      }

      try {
        updateViewportMutation.mutate({
          userId,
          canvasId: canvasId as any,
          x: newViewport.tx,
          y: newViewport.ty,
          zoom: newViewport.zoom,
        });
        lastSyncedViewport = { ...newViewport };
      } catch (error) {
        console.error('Failed to save viewport state to Convex:', error);
      }
    }, 20000); // 20 second debounce for Convex
  };

  // Zoom functions
  const zoomButton = (direction: 'in' | 'out', canvasContainerEl: HTMLDivElement | null) => {
    if (!canvasContainerEl) return;

    const factor = direction === 'in' ? (1 + ZOOM_STEP) : (1 / (1 + ZOOM_STEP));
    const rect = canvasContainerEl.getBoundingClientRect();

    // Pivot at center of the visible canvas area
    const pivot = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };

    zoomBy(factor, pivot, canvasContainerEl);
  };

  const zoomIn = (canvasContainerEl: HTMLDivElement | null) => zoomButton('in', canvasContainerEl);
  const zoomOut = (canvasContainerEl: HTMLDivElement | null) => zoomButton('out', canvasContainerEl);

  const resetZoom = () => {
    const newViewport = { tx: 0, ty: 0, zoom: 1.0 };
    animateToViewport(newViewport);
  };

  // Zoom by factor at specific pivot point
  const zoomBy = (factor: number, pivotScreen: { x: number; y: number }, canvasContainerEl: HTMLDivElement | null) => {
    if (!canvasContainerEl) return;

    const current = viewport();
    const newZoom = constrainZoom(current.zoom * factor);

    // If zoom didn't actually change, don't update anything
    if (Math.abs(newZoom - current.zoom) < 0.001) return;

    const container = canvasContainerEl;
    const canvasRect = container.getBoundingClientRect();

    // Convert screen coordinates to canvas-relative coordinates
    const canvasX = pivotScreen.x - canvasRect.left;
    const canvasY = pivotScreen.y - canvasRect.top;

    // Calculate the point in world coordinates (before zoom)
    const worldX = (canvasX - current.tx) / current.zoom;
    const worldY = (canvasY - current.ty) / current.zoom;

    // Calculate new translation to keep the world point under the cursor
    const newTx = canvasX - worldX * newZoom;
    const newTy = canvasY - worldY * newZoom;

    const newViewport = { tx: newTx, ty: newTy, zoom: newZoom };

    // Use smooth animation for wheel zoom
    animateToViewport(newViewport);
  };

  // Create wheel event handler
  const createWheelHandler = (canvasContainerEl: HTMLDivElement | null) => {
    return (e: WheelEvent) => {
      if (!e.ctrlKey) return; // Require ctrl to avoid hijacking scroll
      e.preventDefault();

      // Use a more granular zoom factor based on wheel delta
      // This makes zooming feel more natural and responsive
      const normalizedDelta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 100);
      const zoomIntensity = 0.002; // Adjust this to control zoom sensitivity
      const factor = Math.pow(1 + zoomIntensity, -normalizedDelta);

      zoomBy(factor, { x: e.clientX, y: e.clientY }, canvasContainerEl);
    };
  };

  // Panning state
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let panViewportStart = { tx: 0, ty: 0, zoom: 1 };
  let currentPanPosition = { x: 0, y: 0 };
  let panAnimationId: number | null = null;

  // Smooth panning update using requestAnimationFrame
  const updatePanPosition = () => {
    if (!isPanning) return;

    const dx = currentPanPosition.x - panStart.x;
    const dy = currentPanPosition.y - panStart.y;

    setViewport((prev) => ({
      ...prev,
      tx: panViewportStart.tx + dx,
      ty: panViewportStart.ty + dy
    }));

    if (isPanning) {
      panAnimationId = requestAnimationFrame(updatePanPosition);
    }
  };

  const panMove = (e: PointerEvent) => {
    if (!isPanning) return;
    // Just update the current position, let RAF handle the viewport update
    currentPanPosition = { x: e.clientX, y: e.clientY };
  };

  const panUp = () => {
    if (!isPanning) return;
    isPanning = false;

    if (panAnimationId) {
      cancelAnimationFrame(panAnimationId);
      panAnimationId = null;
    }

    window.removeEventListener('pointermove', panMove);
    window.removeEventListener('pointerup', panUp);

    // Calculate final position but don't double-update viewport
    const dx = currentPanPosition.x - panStart.x;
    const dy = currentPanPosition.y - panStart.y;
    const finalViewport = {
      ...panViewportStart, // Use the original viewport state as base
      tx: panViewportStart.tx + dx,
      ty: panViewportStart.ty + dy
    };

    // Only update if the position actually changed
    const currentVp = viewport();
    if (Math.abs(finalViewport.tx - currentVp.tx) > 0.1 || Math.abs(finalViewport.ty - currentVp.ty) > 0.1) {
      setViewport(finalViewport);
    }

    // Save with debounce after panning ends (local-first approach)
    saveViewportState(finalViewport);
  };

  const handlePanPointerDown = (e: PointerEvent) => {
    // Allow both left mouse (0) and middle mouse (1) for panning
    // Left mouse will be used when clicking on empty canvas space
    if (e.button !== 0 && e.button !== 1) return;

    // For middle mouse, always start panning
    // For left mouse, we'll let the canvas component decide based on target
    if (e.button === 1) {
      e.preventDefault();
      startPanning(e);
    }
  };

  const startPanning = (e: PointerEvent) => {
    // Cancel any ongoing zoom animation to prevent conflicts
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
      // If zoom animation was running, ensure we use the target zoom value
      if (targetViewport) {
        setViewport(targetViewport);
        targetViewport = null;
        startViewport = null;
      }
    }

    // Cancel any pending Convex saves to prevent conflicts
    if (convexSaveTimeout) {
      clearTimeout(convexSaveTimeout);
      convexSaveTimeout = null;
    }

    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
    currentPanPosition = { x: e.clientX, y: e.clientY };
    // Capture the current viewport state after ensuring zoom animation is complete
    panViewportStart = { ...viewport() };

    window.addEventListener('pointermove', panMove);
    window.addEventListener('pointerup', panUp);

    // Start the smooth panning animation loop
    panAnimationId = requestAnimationFrame(updatePanPosition);
  };

  // Auto-restore viewport state using local-first approach
  createEffect(() => {
    const canvasId = props.canvasId();
    const userId = props.userId();

    if (!canvasId || !userId) return;

    // Get local viewport first
    const localViewport = getLocalViewport(canvasId, userId);

    // Get convex viewport data (handle undefined case)
    const convexViewportData = viewportData.data;
    const convexViewport = convexViewportData ? {
      x: convexViewportData.x,
      y: convexViewportData.y,
      zoom: convexViewportData.zoom,
    } : null;

    // Use local-first resolution strategy
    const resolvedViewport = resolveInitialViewport(localViewport, convexViewport);

    setViewport({
      tx: resolvedViewport.tx,
      ty: resolvedViewport.ty,
      zoom: resolvedViewport.zoom,
    });

    // Once we have viewport data (local or convex), disable further queries
    if (localViewport || convexViewport) {
      setNeedsConvexQuery(false);
    }
  });

  // Legacy restore function for manual calls (kept for compatibility)
  const restoreViewport = () => {
    // This is now handled automatically by the effect above
    // but kept for any existing manual calls
  };

  // Cleanup
  onCleanup(() => {
    if (convexSaveTimeout) {
      clearTimeout(convexSaveTimeout);
      convexSaveTimeout = null;
    }
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (panAnimationId) {
      cancelAnimationFrame(panAnimationId);
      panAnimationId = null;
    }
  });

  return {
    viewport,
    setViewport,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomBy,
    handlePanPointerDown,
    startPanning,
    createWheelHandler,
    restoreViewport,
    saveViewportState,
    forceConvexSync, // For cases where immediate Convex sync is needed
    connectionState, // Expose connection status for UI feedback
    MIN_ZOOM,
    MAX_ZOOM,
  };
}
