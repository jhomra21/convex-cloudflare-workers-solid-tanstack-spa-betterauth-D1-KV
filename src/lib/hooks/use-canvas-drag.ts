import { createSignal, onCleanup } from 'solid-js';
import {
  screenToContent,
  constrainToCanvasBounds,
  getCanvasElement,
  createCoordinateTransformer,
  type Position,
  type Size,
} from '~/lib/utils/canvas-coordinates';

export interface DragState {
  draggedAgent: string | null;
  dragOffset: Position;
  isDragging: boolean;
}

export interface UseDragOptions {
  onDragStart?: (agentId: string) => void;
  onDragMove?: (agentId: string, position: Position) => void;
  onDragEnd?: (agentId: string, finalPosition: Position) => void;
  constrainToBounds?: boolean;
  agentSize?: Size;
  zoomLevel?: () => number;
  viewportGetter?: () => { tx: number; ty: number; zoom: number };
}

export function useCanvasDrag(options: UseDragOptions = {}) {
  const {
    onDragStart,
    onDragMove,
    onDragEnd,
    constrainToBounds = true,
    agentSize = { width: 320, height: 384 },
    zoomLevel,
    viewportGetter,
  } = options;

  const [draggedAgent, setDraggedAgent] = createSignal<string | null>(null);
  const [dragOffset, setDragOffset] = createSignal<Position>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = createSignal(false);
  
  // Track active event listeners for cleanup
  let isListening = false;

  // Cached geometry during a drag session
  let cachedCanvasRect: DOMRect | null = null;
  let cachedContainerSize: Size | null = null;
  let cachedTransformer: ReturnType<typeof createCoordinateTransformer> | null = null;

  // Track latest drag position; commit once on mouseup
  let scheduledPosition: Position | null = null;

  // Element being dragged (for direct DOM updates)
  let draggedEl: HTMLElement | null = null;

  const handleMouseDown = (
    e: MouseEvent,
    agentId: string,
    agentPosition: Position,
    el: HTMLElement | null = null
  ) => {
    // Only handle left mouse button for dragging
    if (e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation(); // Prevent canvas panning when dragging agents
    
    const canvasEl = getCanvasElement();
    if (!canvasEl) return;
    
    setDraggedAgent(agentId);
    setIsDragging(true);
    onDragStart?.(agentId);

    // cache element reference - use the target that initiated the drag
    draggedEl = el ?? (e.currentTarget as HTMLElement | null);
    
    // If we don't have a direct element reference, try to find the agent container
    if (!draggedEl) {
      const target = e.target as HTMLElement;
      draggedEl = target.closest('[data-agent-id]') || target.closest('.absolute.select-none') as HTMLElement;
    }
    
    // Calculate offset using shared coordinate utilities
    const vp = viewportGetter?.();
    const currentZoom = vp ? vp.zoom : (zoomLevel?.() || 1.0);

    cachedCanvasRect = canvasEl.getBoundingClientRect();
    cachedContainerSize = { width: canvasEl.clientWidth, height: canvasEl.clientHeight };
    cachedTransformer = createCoordinateTransformer(cachedCanvasRect, cachedContainerSize, currentZoom);

    let agentScreenPos;
    if (vp) {
      agentScreenPos = {
        x: cachedCanvasRect.left + vp.tx + agentPosition.x * vp.zoom,
        y: cachedCanvasRect.top + vp.ty + agentPosition.y * vp.zoom,
      };
    } else {
      agentScreenPos = cachedTransformer.toScreen(agentPosition);
    }
    
    const offsetX = e.clientX - agentScreenPos.x;
    const offsetY = e.clientY - agentScreenPos.y;
    setDragOffset({ x: offsetX, y: offsetY });

    // Add global mouse move and up listeners with tracking
    if (!isListening) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Add cleanup for interrupted operations
      document.addEventListener('visibilitychange', handleInterruption);
      window.addEventListener('beforeunload', handleInterruption);
      isListening = true;
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    const agentId = draggedAgent();
    if (!agentId || !isDragging()) return;

    const canvasEl = getCanvasElement();
    if (!canvasEl) return;

    const offset = dragOffset();
    const vp = viewportGetter?.();
    const currentZoom = vp ? vp.zoom : zoomLevel?.() || 1.0;
    // Calculate mouse position adjusting for drag offset
    const mouseScreenPos = {
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    };
    
    let newPosition;
    if (vp) {
      newPosition = {
        x: (e.clientX - (cachedCanvasRect?.left ?? 0) - vp.tx - offset.x) / vp.zoom,
        y: (e.clientY - (cachedCanvasRect?.top ?? 0) - vp.ty - offset.y) / vp.zoom,
      };
    } else {
      const scrollOffset = {
        x: canvasEl.scrollLeft,
        y: canvasEl.scrollTop,
      };
      if (!cachedTransformer) {
        cachedCanvasRect = canvasEl.getBoundingClientRect();
        cachedContainerSize = { width: canvasEl.clientWidth, height: canvasEl.clientHeight };
        cachedTransformer = createCoordinateTransformer(cachedCanvasRect, cachedContainerSize, currentZoom);
      }
      if (cachedTransformer) {
        newPosition = cachedTransformer.toContent(mouseScreenPos, scrollOffset);
      } else {
        newPosition = { x: 0, y: 0 };
      }
    }

    // Constrain to canvas boundaries if enabled
    if (constrainToBounds) {
      if (cachedTransformer) {
        newPosition = cachedTransformer.constrainBounds(newPosition, agentSize);
      }
    }

    // Apply transform directly for smooth 60 fps, avoiding Solid reactive writes
    if (draggedEl) {
      draggedEl.style.transform = `translate3d(${newPosition.x}px, ${newPosition.y}px, 0)`;
    }

    // Stash latest position for commit on mouseup
    scheduledPosition = newPosition;
  };

  const handleMouseUp = () => {
    const draggedId = draggedAgent();

    // Preserve the last calculated position before cleanup
    const finalPos = scheduledPosition;

    // Clear the direct DOM transform to let reactive state take over
    if (draggedEl) {
      draggedEl.style.transform = '';
      draggedEl = null;
    }

    setDraggedAgent(null);
    setIsDragging(false);

    if (draggedId && finalPos) {
      onDragEnd?.(draggedId, finalPos);
    }

    removeEventListeners();
  };

  const handleInterruption = () => {
    // Clean up if drag is interrupted (page visibility change, beforeunload, etc.)
    if (isDragging()) {
      const draggedId = draggedAgent();
      const finalPos = scheduledPosition;

      // Clear the direct DOM transform to let reactive state take over
      if (draggedEl) {
        draggedEl.style.transform = '';
        draggedEl = null;
      }

      setDraggedAgent(null);
      setIsDragging(false);

      if (draggedId && finalPos) {
        onDragEnd?.(draggedId, finalPos);
      }

      removeEventListeners();
    }
  };

  const removeEventListeners = () => {
    if (isListening) {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('visibilitychange', handleInterruption);
      window.removeEventListener('beforeunload', handleInterruption);
      isListening = false;
    }
    scheduledPosition = null;
    cachedCanvasRect = null;
    cachedContainerSize = null;
    cachedTransformer = null;
    if (draggedEl) {
      draggedEl = null;
    }
  };

  // Cleanup on component unmount
  onCleanup(() => {
    removeEventListeners();
  });

  return {
    draggedAgent,
    isDragging,
    handleMouseDown,
    handleMouseUp, // Export for manual cleanup
    cleanup: removeEventListeners, // Export cleanup function
  };
}
