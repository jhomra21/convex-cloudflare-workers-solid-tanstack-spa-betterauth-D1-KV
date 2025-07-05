import { createSignal, onMount, onCleanup } from 'solid-js';
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
    zoom: 1.0,
  });

  // Zoom constraints
  const MIN_ZOOM = 0.5; // 50%
  const MAX_ZOOM = 2.0; // 200%
  const ZOOM_STEP = 0.1; // 10% increments for button clicks
  const ZOOM_WHEEL_FACTOR = 1.1; // ~10% per wheel notch

  // Mutations
  const updateCanvasViewportMutation = useMutation();

  // Constrain zoom level to safe bounds
  const constrainZoom = (zoom: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));

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
    const factor = direction === 'in' ? (1 + ZOOM_STEP) : (1 / (1 + ZOOM_STEP));
    const container = canvasContainerEl;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    // Pivot at centre of viewport
    const pivot = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    zoomBy(factor, pivot, canvasContainerEl);
  };

  const zoomIn = (canvasContainerEl: HTMLDivElement | null) => zoomButton('in', canvasContainerEl);
  const zoomOut = (canvasContainerEl: HTMLDivElement | null) => zoomButton('out', canvasContainerEl);
  
  const resetZoom = () => {
    const newViewport = { tx: 0, ty: 0, zoom: 1.0 };
    setViewport(newViewport);
    saveViewportState(newViewport);
  };

  // Zoom by factor at specific pivot point
  const zoomBy = (factor: number, pivotScreen: { x: number; y: number }, canvasContainerEl: HTMLDivElement | null) => {
    // Clamp new zoom first
    const current = viewport();
    const newZoom = constrainZoom(current.zoom * factor);
    if (newZoom === current.zoom || !canvasContainerEl) return;

    const container = canvasContainerEl;
    const canvasRect = container.getBoundingClientRect();

    // Calculate pivot in content coords using viewport translation
    const vp = current;
    const pivotContent = {
      x: (pivotScreen.x - canvasRect.left - vp.tx) / vp.zoom,
      y: (pivotScreen.y - canvasRect.top - vp.ty) / vp.zoom,
    };

    // New translation so pivot remains under cursor after zoom
    const newTx = pivotScreen.x - canvasRect.left - pivotContent.x * newZoom;
    const newTy = pivotScreen.y - canvasRect.top - pivotContent.y * newZoom;

    const newViewport = { tx: newTx, ty: newTy, zoom: newZoom };
    setViewport(newViewport);
    saveViewportState(newViewport);
  };

  // Create wheel event handler
  const createWheelHandler = (canvasContainerEl: HTMLDivElement | null) => {
    return (e: WheelEvent) => {
      if (!e.ctrlKey) return; // Require ctrl to avoid hijacking scroll
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / ZOOM_WHEEL_FACTOR : ZOOM_WHEEL_FACTOR;
      zoomBy(factor, { x: e.clientX, y: e.clientY }, canvasContainerEl);
    };
  };

  // Panning state
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let panViewportStart = { tx: 0, ty: 0, zoom: 1 };

  const panMove = (e: PointerEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    setViewport((prev) => ({ ...prev, tx: panViewportStart.tx + dx, ty: panViewportStart.ty + dy }));
  };

  const panUp = (e: PointerEvent) => {
    if (!isPanning) return;
    isPanning = false;
    window.removeEventListener('pointermove', panMove);
    window.removeEventListener('pointerup', panUp);
    saveViewportState(viewport());
  };

  const handlePanPointerDown = (e: PointerEvent) => {
    if (e.button !== 1) return; // middle mouse only
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
    panViewportStart = { ...viewport() };
    window.addEventListener('pointermove', panMove);
    window.addEventListener('pointerup', panUp);
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
  });

  return {
    viewport,
    setViewport,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomBy,
    handlePanPointerDown,
    createWheelHandler,
    restoreViewport,
    saveViewportState,
    MIN_ZOOM,
    MAX_ZOOM,
  };
}
