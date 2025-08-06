import { createSignal, onCleanup, createEffect, batch } from 'solid-js';
import { convexApi, useConvexMutation, useConvexQuery } from '~/lib/convex';
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
  // Viewport state management - initialize with proper default
  const [viewport, setViewport] = createSignal<ViewportState>({
    tx: 0,
    ty: 0,
    zoom: 0.25,
  });

  // Track if viewport has been initialized from storage
  const [isViewportInitialized, setIsViewportInitialized] = createSignal(false);
  // Track if this is the initial restoration (page load) vs ongoing updates
  const [hasCompletedInitialRestore, setHasCompletedInitialRestore] = createSignal(false);

  // Zoom constraints
  const MIN_ZOOM = 0.01; // 1%
  const MAX_ZOOM = 2.0; // 200%
  const ZOOM_STEP = 0.1; // 10% increments for button clicks

  // Signal to control when we need to query Convex
  const [needsConvexQuery, setNeedsConvexQuery] = createSignal(false);
  
  // Track the current canvas ID to detect changes
  let lastCanvasId: string | null = null;

  // Check if we need to query Convex on canvas/user change
  createEffect(() => {
    const canvasId = props.canvasId();
    const userId = props.userId();

    // Guard: Only proceed if we have both canvasId and userId
    if (!canvasId || !userId) {
      setNeedsConvexQuery(false);
      return;
    }

    const localViewport = getLocalViewport(canvasId, userId);
    
    // Only query Convex if no local viewport exists
    const shouldQuery = !localViewport;
    
    // Guard: Only update if the query need actually changed to prevent circular updates
    if (needsConvexQuery() !== shouldQuery) {
      // Use batch to prevent cascading effects
      batch(() => {
        setNeedsConvexQuery(shouldQuery);
      });
    }

    // Fallback initialization - if we have local data, mark as initialized immediately
    if (localViewport && !isViewportInitialized()) {
      setIsViewportInitialized(true);
    }
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
  const ZOOM_ANIMATION_DURATION = 100; // ms - reduced for more responsive feel
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

    // Debounce Convex save for 20 seconds
    if (convexSaveTimeout) {
      clearTimeout(convexSaveTimeout);
    }

    convexSaveTimeout = setTimeout(async () => {


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
    }, 5000); // 5 second debounce for Convex (reduced for better responsiveness)
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

    // Don't zoom during panning to prevent conflicts
    if (isPanning) return;

    // Cancel any ongoing animation and use the target viewport as current state
    // This prevents using stale viewport values during rapid zoom events
    let current = viewport();
    if (animationId && targetViewport) {
      // If animation is running, use the target as the current state
      current = targetViewport;
      cancelAnimationFrame(animationId);
      animationId = null;
      targetViewport = null;
      startViewport = null;
    }
    
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
      e.stopPropagation();

      // Don't zoom during panning to prevent conflicts
      if (isPanning) return;

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
  let panTimeoutId: number | null = null;

  // Smooth panning update using requestAnimationFrame
  const updatePanPosition = () => {
    if (!isPanning) {
      panAnimationId = null;
      return;
    }

    const dx = currentPanPosition.x - panStart.x;
    const dy = currentPanPosition.y - panStart.y;

    // Use batch to prevent cascading effects during panning
    batch(() => {
      setViewport((prev) => ({
        ...prev,
        tx: panViewportStart.tx + dx,
        ty: panViewportStart.ty + dy
      }));
    });

    if (isPanning) {
      panAnimationId = requestAnimationFrame(updatePanPosition);
    }
  };

  const panMove = (e: PointerEvent) => {
    if (!isPanning) return;
    e.preventDefault(); // Prevent default scrolling behavior
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

    // Clear the safety timeout
    if (panTimeoutId) {
      clearTimeout(panTimeoutId);
      panTimeoutId = null;
    }

    // Remove event listeners with capture flag
    window.removeEventListener('pointermove', panMove, { capture: true });
    window.removeEventListener('pointerup', panUp, { capture: true });
    window.removeEventListener('pointercancel', panUp, { capture: true });
    window.removeEventListener('pointerleave', panUp, { capture: true });

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
      // Use batch to prevent cascading effects
      batch(() => {
        setViewport(finalViewport);
      });
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
      e.stopPropagation(); // Prevent event bubbling
      startPanning(e);
    }
  };

  const startPanning = (e: PointerEvent) => {
    // Prevent default behavior and stop propagation
    e.preventDefault();
    e.stopPropagation();

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

    // Clear any existing pan timeout
    if (panTimeoutId) {
      clearTimeout(panTimeoutId);
      panTimeoutId = null;
    }

    // Ensure viewport is initialized when panning starts
    // This helps with the case where user pans before zoom is attempted
    if (!isViewportInitialized()) {
      setIsViewportInitialized(true);
    }

    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
    currentPanPosition = { x: e.clientX, y: e.clientY };
    // Capture the current viewport state after ensuring zoom animation is complete
    panViewportStart = { ...viewport() };

    // Use capture phase to ensure we get events even if other handlers stop propagation
    window.addEventListener('pointermove', panMove, { capture: true });
    window.addEventListener('pointerup', panUp, { capture: true });
    // Also listen for pointercancel and pointerleave to handle edge cases
    window.addEventListener('pointercancel', panUp, { capture: true });
    window.addEventListener('pointerleave', panUp, { capture: true });

    // Add a safety timeout to reset panning state if events are missed
    panTimeoutId = window.setTimeout(() => {
      if (isPanning) {
        console.warn('Panning timeout - forcing reset');
        panUp();
      }
    }, 5000); // 5 second timeout

    // Start the smooth panning animation loop
    panAnimationId = requestAnimationFrame(updatePanPosition);
  };

  // Auto-restore viewport state using local-first approach
  createEffect(() => {
    const canvasId = props.canvasId();
    const userId = props.userId();

    // Guard: Only proceed if we have both canvasId and userId
    if (!canvasId || !userId) {
      // Reset initialization flags if we don't have required data
      if (isViewportInitialized()) {
        setIsViewportInitialized(false);
      }
      if (hasCompletedInitialRestore()) {
        setHasCompletedInitialRestore(false);
      }
      lastCanvasId = null;
      return;
    }

    // Reset restoration flags if canvas changed (switching between canvases)
    if (lastCanvasId !== null && lastCanvasId !== canvasId) {
      setIsViewportInitialized(false);
      setHasCompletedInitialRestore(false);
    }
    lastCanvasId = canvasId;

    // Guard: Don't update viewport during active panning to prevent conflicts
    if (isPanning) {
      return;
    }

    // CRITICAL: Don't restore if we've completed initial restoration and canvas hasn't changed
    // This prevents overriding user zoom/pan actions while still allowing initial restore
    if (hasCompletedInitialRestore()) {
      return;
    }

    // Get local viewport first
    const localViewport = getLocalViewport(canvasId, userId);

    // Get convex viewport data (handle undefined case)
    const convexViewportData = viewportData.data;
    const convexViewport = convexViewportData ? {
      x: convexViewportData.x,
      y: convexViewportData.y,
      zoom: convexViewportData.zoom,
    } : null;

    // Use local-first resolution strategy - this will return default if no data
    const resolvedViewport = resolveInitialViewport(localViewport, convexViewport);

    // Guard: Only update viewport if it actually changed
    const currentViewport = viewport();
    const hasChanged = Math.abs(currentViewport.tx - resolvedViewport.tx) > 0.1 ||
                      Math.abs(currentViewport.ty - resolvedViewport.ty) > 0.1 ||
                      Math.abs(currentViewport.zoom - resolvedViewport.zoom) > 0.001;

    if (hasChanged) {
      // Use batch to prevent cascading effects
      batch(() => {
        setViewport({
          tx: resolvedViewport.tx,
          ty: resolvedViewport.ty,
          zoom: resolvedViewport.zoom,
        });
      });
    }

    // Mark viewport as initialized once we've processed the data
    // This happens whether we have stored data or use defaults
    if (!isViewportInitialized()) {
      setIsViewportInitialized(true);
    }

    // Mark initial restoration as complete to prevent future overrides
    if (!hasCompletedInitialRestore()) {
      setHasCompletedInitialRestore(true);
    }

    // Once we have viewport data (local or convex), disable further queries
    if ((localViewport || convexViewport) && needsConvexQuery()) {
      batch(() => {
        setNeedsConvexQuery(false);
      });
    }
  });

  // Legacy restore function for manual calls (kept for compatibility)
  const restoreViewport = () => {
    // This is now handled automatically by the effect above
    // but kept for any existing manual calls
  };

  // Cleanup
  onCleanup(() => {
    // Clean up panning state
    if (isPanning) {
      isPanning = false;
      window.removeEventListener('pointermove', panMove, { capture: true });
      window.removeEventListener('pointerup', panUp, { capture: true });
      window.removeEventListener('pointercancel', panUp, { capture: true });
      window.removeEventListener('pointerleave', panUp, { capture: true });
    }
    
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
    if (panTimeoutId) {
      clearTimeout(panTimeoutId);
      panTimeoutId = null;
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
    isViewportInitialized, // Expose initialization state

    MIN_ZOOM,
    MAX_ZOOM,
  };
}
