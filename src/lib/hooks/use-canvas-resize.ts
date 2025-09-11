import { createSignal, onCleanup } from 'solid-js';
import { type Position, type Size } from '~/lib/utils/canvas-coordinates';

export interface UseResizeOptions {
  onResizeStart?: (agentId: string, handle: string) => void;
  onResizeEnd?: (agentId: string, finalSize: Size, finalPosition?: Position) => void;
  minScale?: number;
  maxScale?: number;
  viewportGetter?: () => { tx: number; ty: number; zoom: number };
}

export function useCanvasResize(options: UseResizeOptions = {}) {
  const {
    onResizeStart,
    onResizeEnd,
    // Allow free resizing: very permissive defaults to avoid clamp-y feel
    minScale = 0.1,
    maxScale = 8.0,
    viewportGetter,
  } = options;

  const [resizingAgent, setResizingAgent] = createSignal<string | null>(null);
  const [resizeHandle, setResizeHandle] = createSignal<string | null>(null);
  const [resizeStartSize, setResizeStartSize] = createSignal<Size>({ width: 0, height: 0 });
  const [resizeStartPos, setResizeStartPos] = createSignal<Position>({ x: 0, y: 0 });

  // Track active event listeners for cleanup
  let isListening = false;

  // Cache the wrapper element for direct transform manipulation
  let wrapperEl: HTMLElement | null = null;

  // Store original transform values and scale factors
  let originalTransformX = 0;
  let originalTransformY = 0;
  let originalDragScale = 1;

  // Store the latest calculated values for final commit
  let scheduledSize: Size | null = null;
  let scheduledPositionAdjustment: Position | undefined = undefined;

  const handleResizeStart = (
    e: MouseEvent,
    agentId: string,
    handle: string,
    currentSize: Size
  ) => {
    // Only handle left mouse button for resizing
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation(); // Prevent drag from starting



    setResizingAgent(agentId);
    setResizeHandle(handle);
    setResizeStartSize(currentSize);
    setResizeStartPos({ x: e.clientX, y: e.clientY });

    // Find the wrapper element by agent ID (more reliable than DOM traversal)
    wrapperEl = document.querySelector(`[data-agent-id="${agentId}"]`) as HTMLElement;


    if (wrapperEl) {
      // Parse existing transform to preserve position and drag scale
      const fullTransform = wrapperEl.style.transform || "";

      // Extract translate3d values
      const translateMatch = fullTransform.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*[-\d.]+px\)/);
      if (translateMatch) {
        originalTransformX = parseFloat(translateMatch[1]);
        originalTransformY = parseFloat(translateMatch[2]);
      } else {
        originalTransformX = 0;
        originalTransformY = 0;
      }

      // Extract existing scale (from drag operations)
      const scaleMatch = fullTransform.match(/scale\(([-\d.]+)\)/);
      originalDragScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;

      // Disable transitions for smooth resize
      wrapperEl.style.transition = "none";
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
    if (!agentId || !handle || !wrapperEl) return;

    const startSize = resizeStartSize();
    const startPos = resizeStartPos();

    const deltaXScreen = e.clientX - startPos.x;
    const deltaYScreen = e.clientY - startPos.y;

    const currentZoom = viewportGetter ? viewportGetter().zoom : 1.0;

    // Convert screen delta to content-space delta by dividing by zoom
    const deltaX = deltaXScreen / currentZoom;
    const deltaY = deltaYScreen / currentZoom;

    // Calculate new dimensions based on resize handle
    let newWidth = startSize.width;
    let newHeight = startSize.height;
    let positionAdjustmentX = 0;
    let positionAdjustmentY = 0;

    // Apply minimum and maximum size constraints
    const minWidth = minScale * startSize.width;
    const maxWidth = maxScale * startSize.width;
    const minHeight = minScale * startSize.height;
    const maxHeight = maxScale * startSize.height;

    switch (handle) {
      case 'se': // Bottom-right - resize both dimensions, no position change
        newWidth = Math.max(minWidth, Math.min(maxWidth, startSize.width + deltaX));
        newHeight = Math.max(minHeight, Math.min(maxHeight, startSize.height + deltaY));
        break;
      case 'sw': // Bottom-left - resize both dimensions, adjust X position
        newWidth = Math.max(minWidth, Math.min(maxWidth, startSize.width - deltaX));
        newHeight = Math.max(minHeight, Math.min(maxHeight, startSize.height + deltaY));
        positionAdjustmentX = startSize.width - newWidth;
        break;
      case 'ne': // Top-right - resize both dimensions, adjust Y position
        newWidth = Math.max(minWidth, Math.min(maxWidth, startSize.width + deltaX));
        newHeight = Math.max(minHeight, Math.min(maxHeight, startSize.height - deltaY));
        positionAdjustmentY = startSize.height - newHeight;
        break;
      case 'nw': // Top-left - resize both dimensions, adjust both positions
        newWidth = Math.max(minWidth, Math.min(maxWidth, startSize.width - deltaX));
        newHeight = Math.max(minHeight, Math.min(maxHeight, startSize.height - deltaY));
        positionAdjustmentX = startSize.width - newWidth;
        positionAdjustmentY = startSize.height - newHeight;
        break;
      case 'n': // Top edge - resize height only, adjust Y position
        newHeight = Math.max(minHeight, Math.min(maxHeight, startSize.height - deltaY));
        positionAdjustmentY = startSize.height - newHeight;
        break;
      case 's': // Bottom edge - resize height only, no position change
        newHeight = Math.max(minHeight, Math.min(maxHeight, startSize.height + deltaY));
        break;
      case 'w': // Left edge - resize width only, adjust X position
        newWidth = Math.max(minWidth, Math.min(maxWidth, startSize.width - deltaX));
        positionAdjustmentX = startSize.width - newWidth;
        break;
      case 'e': // Right edge - resize width only, no position change
        newWidth = Math.max(minWidth, Math.min(maxWidth, startSize.width + deltaX));
        break;
    }

    // Apply position adjustment to maintain the correct anchor point
    const adjustedTransformX = originalTransformX + positionAdjustmentX;
    const adjustedTransformY = originalTransformY + positionAdjustmentY;

    // Update wrapper position with adjustment
    wrapperEl.style.transform = `translate3d(${adjustedTransformX}px, ${adjustedTransformY}px, 0) scale(${originalDragScale})`;

    // Find the card element and apply size changes
    const cardEl = wrapperEl.querySelector('.rounded-lg') as HTMLElement;
    if (cardEl) {
      cardEl.style.width = `${newWidth}px`;
      cardEl.style.height = `${newHeight}px`;
      cardEl.style.transition = 'none';
    }

    // Store values for final commit
    scheduledSize = { width: Math.round(newWidth), height: Math.round(newHeight) };
    
    // Only include position adjustment if there was actually an adjustment
    if (positionAdjustmentX !== 0 || positionAdjustmentY !== 0) {
      scheduledPositionAdjustment = {
        x: originalTransformX + positionAdjustmentX,
        y: originalTransformY + positionAdjustmentY
      };
    } else {
      scheduledPositionAdjustment = undefined;
    }
  };

  const handleResizeEnd = () => {
    const resizingId = resizingAgent();
    const finalSize = scheduledSize;
    const finalPositionAdjustment = scheduledPositionAdjustment;

    // Store the current transform before clearing
    let shouldRestoreTransform = false;
    let restoreTransform = '';
    
    if (wrapperEl && !finalPositionAdjustment) {
      // For bottom-right resize (no position change), preserve the current position
      // by restoring the original transform after clearing styles
      shouldRestoreTransform = true;
      restoreTransform = `translate3d(${originalTransformX}px, ${originalTransformY}px, 0) scale(${originalDragScale})`;
    }

    // Clear the transform and card styles to let reactive state take over
    if (wrapperEl) {
      wrapperEl.style.transform = shouldRestoreTransform ? restoreTransform : '';
      wrapperEl.style.transition = '';

      // Clear card element styles
      const cardEl = wrapperEl.querySelector('.rounded-lg') as HTMLElement;
      if (cardEl) {
        cardEl.style.width = '';
        cardEl.style.height = '';
        cardEl.style.transition = '';
      }
    }

    setResizingAgent(null);
    setResizeHandle(null);
    removeEventListeners();

    // Call mutation AFTER clearing DOM styles
    if (resizingId && finalSize) {
      onResizeEnd?.(resizingId, finalSize, finalPositionAdjustment);
    }
  };

  const handleInterruption = () => {
    // Clean up if resize is interrupted (page visibility change, beforeunload, etc.)
    if (resizingAgent()) {
      const resizingId = resizingAgent();

      // Clear transform on interruption
      if (wrapperEl) {
        wrapperEl.style.transform = '';
        wrapperEl.style.transition = '';

        // Clear card element styles
        const cardEl = wrapperEl.querySelector('.rounded-lg') as HTMLElement;
        if (cardEl) {
          cardEl.style.width = '';
          cardEl.style.height = '';
          cardEl.style.transition = '';
        }
      }

      setResizingAgent(null);
      setResizeHandle(null);

      removeEventListeners();

      // Don't call onResizeEnd on interruption to avoid partial updates
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
    wrapperEl = null;
    originalTransformX = 0;
    originalTransformY = 0;
    originalDragScale = 1;
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
