import { createSignal, onCleanup } from 'solid-js';
import { convexApi, useMutation } from '~/lib/convex';

export interface ViewportState {
  tx: number;
  ty: number;
  zoom: number;
}

export interface UseViewportProps {
  userCanvas: () => any;
  userId: () => string | null;
}

export function useViewport(props: UseViewportProps) {
  // Viewport state management
  const [viewport, setViewport] = createSignal<ViewportState>({
    tx: 0,
    ty: 0,
    zoom: 0.8,
  });

  // Zoom constraints
  const MIN_ZOOM = 0.01; // 1%
  const MAX_ZOOM = 2.0; // 200%
  const ZOOM_STEP = 0.1; // 10% increments for button clicks


  // Mutations
  const updateCanvasViewportMutation = useMutation();

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

  // Debounced viewport save to prevent excessive API calls
  let viewportSaveTimeout: any;
  const saveViewportState = (newViewport: ViewportState) => {
    const userCanvas = props.userCanvas();
    if (!userCanvas?._id || !props.userId()) return;

    if (viewportSaveTimeout) {
      clearTimeout(viewportSaveTimeout);
    }

    viewportSaveTimeout = setTimeout(async () => {
      try {
        await updateCanvasViewportMutation.mutate(convexApi.canvas.updateCanvasViewport, {
          canvasId: userCanvas._id,
          viewport: { x: newViewport.tx, y: newViewport.ty, zoom: newViewport.zoom },
        });
      } catch (error) {
        console.error('Failed to save viewport state:', error);
      }
    }, 500); // 500ms debounce
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

    // Final position update and save
    const dx = currentPanPosition.x - panStart.x;
    const dy = currentPanPosition.y - panStart.y;
    const finalViewport = {
      ...viewport(),
      tx: panViewportStart.tx + dx,
      ty: panViewportStart.ty + dy
    };

    setViewport(finalViewport);
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
      // Reset animation state completely
      targetViewport = null;
      startViewport = null;
    }

    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
    currentPanPosition = { x: e.clientX, y: e.clientY };
    // Capture the current viewport state, not any intermediate animation state
    panViewportStart = { ...viewport() };

    window.addEventListener('pointermove', panMove);
    window.addEventListener('pointerup', panUp);

    // Start the smooth panning animation loop
    panAnimationId = requestAnimationFrame(updatePanPosition);
  };

  // Restore viewport state when canvas loads
  const restoreViewport = () => {
    const userCanvasData = props.userCanvas();
    if (userCanvasData) {
      const storedAny = (userCanvasData.viewport ?? {}) as any;
      const converted = 'tx' in storedAny ? storedAny : { tx: storedAny.x ?? 0, ty: storedAny.y ?? 0, zoom: storedAny.zoom ?? 1 };
      setViewport(converted);
    }
  };

  // Cleanup
  onCleanup(() => {
    if (viewportSaveTimeout) {
      clearTimeout(viewportSaveTimeout);
    }
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    if (panAnimationId) {
      cancelAnimationFrame(panAnimationId);
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
    MIN_ZOOM,
    MAX_ZOOM,
  };
}
