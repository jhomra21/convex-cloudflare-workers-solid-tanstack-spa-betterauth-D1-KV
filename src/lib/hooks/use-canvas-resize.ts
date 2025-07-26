import { createSignal, onCleanup } from 'solid-js';
import { type Position, type Size } from '~/lib/utils/canvas-coordinates';

export interface UseResizeOptions {
  onResizeStart?: (agentId: string, handle: string) => void;
  onResizeMove?: (agentId: string, size: Size, position?: Position) => void;
  onResizeEnd?: (agentId: string) => void;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  zoomLevel?: () => number;
  viewportGetter?: () => { tx: number; ty: number; zoom: number };
}

export function useCanvasResize(options: UseResizeOptions = {}) {
  const {
    onResizeStart,
    onResizeMove,
    onResizeEnd,
    minWidth = 200,
    maxWidth = 600,
    minHeight = 250,
    maxHeight = 800,
    zoomLevel,
    viewportGetter,
  } = options;

  const [resizingAgent, setResizingAgent] = createSignal<string | null>(null);
  const [resizeHandle, setResizeHandle] = createSignal<string | null>(null);
  const [resizeStartSize, setResizeStartSize] = createSignal<Size>({ width: 0, height: 0 });
  const [resizeStartPos, setResizeStartPos] = createSignal<Position>({ x: 0, y: 0 });

  // Track active event listeners for cleanup
  let isListening = false;

  // Cache the element being resized (the agent card) and its wrapper (absolute positioned container)
  let resizedEl: HTMLElement | null = null;
  let wrapperEl: HTMLElement | null = null;

  // Cache the current scale suffix from transform (e.g., "scale(1)") so we can preserve it when updating position
  let transformSuffix = "";

  // Store original transform values to calculate relative adjustments
  let originalTransformX = 0;
  let originalTransformY = 0;

  // Store the latest calculated size/position to commit once on mouseup
  let scheduledSize: Size | null = null;
  let scheduledPositionAdjustment: Position | undefined = undefined;

  let originalResizeTransition = "";
  let originalWrapperTransition = "";

  const handleResizeStart = (
    e: MouseEvent,
    agentId: string,
    handle: string,
    currentSize: Size
  ) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent drag from starting

    setResizingAgent(agentId);
    setResizeHandle(handle);
    setResizeStartSize(currentSize);
    setResizeStartPos({ x: e.clientX, y: e.clientY });

    // Capture DOM elements for direct style updates
    resizedEl = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
    // The wrapper is the absolute positioned container one level up (Memoized*Agent wrapper)
    wrapperEl = resizedEl?.parentElement as HTMLElement | null;

    if (wrapperEl) {
      // Extract any existing transform suffix (e.g., scale) so we can preserve it
      const fullTransform = wrapperEl.style.transform || "";
      const match = fullTransform.match(/translate3d\([^)]*\)\s*(.*)/);
      transformSuffix = match ? ` ${match[1]}` : "";

      // Store original transform values for relative calculations
      const transformMatch = fullTransform.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/);
      if (transformMatch) {
        originalTransformX = parseFloat(transformMatch[1]);
        originalTransformY = parseFloat(transformMatch[2]);
      } else {
        originalTransformX = 0;
        originalTransformY = 0;
      }

      // Temporarily disable transitions for snappy resize
      originalWrapperTransition = wrapperEl.style.transition;
      wrapperEl.style.transition = "none";
    }

    if (resizedEl) {
      originalResizeTransition = resizedEl.style.transition;
      resizedEl.style.transition = "none";
    }

    onResizeStart?.(agentId, handle);

    // Add global mouse move listener for resize with tracking
    if (!isListening) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      // Add cleanup for interrupted operations
      document.addEventListener('visibilitychange', handleInterruption);
      window.addEventListener('beforeunload', handleInterruption);
      isListening = true;
    }
  };

  const handleResizeMove = (e: MouseEvent) => {
    const agentId = resizingAgent();
    const handle = resizeHandle();
    if (!agentId || !handle) return;

    const startSize = resizeStartSize();
    const startPos = resizeStartPos();

    const deltaXScreen = e.clientX - startPos.x;
    const deltaYScreen = e.clientY - startPos.y;

    const currentZoom = viewportGetter ? viewportGetter().zoom : (zoomLevel?.() || 1.0);

    // Convert screen delta to content-space delta by dividing by zoom
    const deltaX = deltaXScreen / currentZoom;
    const deltaY = deltaYScreen / currentZoom;

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
    newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
    newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));

    // Calculate position adjustment for left/top handles
    let positionAdjustment: Position | undefined;
    if (handle.includes('w') || handle.includes('n')) {
      positionAdjustment = { x: 0, y: 0 };

      if (handle.includes('w')) {
        // Left side – move container left by width delta so the visual "west" edge follows cursor
        positionAdjustment.x = startSize.width - newWidth;
      }
      if (handle.includes('n')) {
        // Top side – move container up by height delta
        positionAdjustment.y = startSize.height - newHeight;
      }
    }

    // ----------------------------------------------
    // DOM updates for buttery-smooth resizing (no Solid writes)
    // ----------------------------------------------
    if (resizedEl) {
      resizedEl.style.width = `${newWidth}px`;
      resizedEl.style.height = `${newHeight}px`;
    }

    if (wrapperEl && positionAdjustment) {
      // Calculate new position based on original position + total adjustment
      const newX = originalTransformX + positionAdjustment.x;
      const newY = originalTransformY + positionAdjustment.y;
      wrapperEl.style.transform = `translate3d(${newX}px, ${newY}px, 0)${transformSuffix}`;
    }

    // Stash latest calculated values for commit on mouseup
    scheduledSize = { width: newWidth, height: newHeight };
    scheduledPositionAdjustment = positionAdjustment;
  };

  const handleResizeEnd = () => {
    const resizingId = resizingAgent();
    const finalSize = scheduledSize;
    const finalPositionAdjustment = scheduledPositionAdjustment;

    // Clear DOM styles immediately to let reactive state take over (like drag hook)
    if (resizedEl) {
      resizedEl.style.width = '';
      resizedEl.style.height = '';
      resizedEl.style.transition = originalResizeTransition;
    }
    if (wrapperEl) {
      // Clear the transform immediately - optimistic update will handle position
      wrapperEl.style.transform = '';
      wrapperEl.style.transition = originalWrapperTransition;
    }

    setResizingAgent(null);
    setResizeHandle(null);
    removeEventListeners();

    // Call mutation AFTER clearing DOM styles (like drag hook)
    if (resizingId && finalSize) {
      onResizeMove?.(resizingId, finalSize, finalPositionAdjustment);
    }

    if (resizingId) {
      onResizeEnd?.(resizingId);
    }
  };

  const handleInterruption = () => {
    // Clean up if resize is interrupted (page visibility change, beforeunload, etc.)
    if (resizingAgent()) {
      const resizingId = resizingAgent();
      setResizingAgent(null);
      setResizeHandle(null);

      removeEventListeners();

      if (resizingId) {
        onResizeEnd?.(resizingId);
      }
    }
  };

  const removeEventListeners = () => {
    if (isListening) {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.removeEventListener('visibilitychange', handleInterruption);
      window.removeEventListener('beforeunload', handleInterruption);
      isListening = false;
    }
    resizedEl = null;
    wrapperEl = null;
    originalResizeTransition = "";
    originalWrapperTransition = "";
    originalTransformX = 0;
    originalTransformY = 0;
    scheduledSize = null;
    scheduledPositionAdjustment = undefined;
  };

  // Cleanup on component unmount
  onCleanup(() => {
    removeEventListeners();
  });

  return {
    resizingAgent,
    resizeHandle,
    handleResizeStart,
    handleResizeEnd, // Export for manual cleanup
    cleanup: removeEventListeners, // Export cleanup function
  };
}
