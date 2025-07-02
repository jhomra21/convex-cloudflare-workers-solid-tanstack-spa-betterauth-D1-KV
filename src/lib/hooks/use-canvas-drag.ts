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
  onDragEnd?: (agentId: string) => void;
  constrainToBounds?: boolean;
  agentSize?: Size;
  zoomLevel?: () => number;
}

export function useCanvasDrag(options: UseDragOptions = {}) {
  const {
    onDragStart,
    onDragMove,
    onDragEnd,
    constrainToBounds = true,
    agentSize = { width: 320, height: 384 },
    zoomLevel,
  } = options;

  const [draggedAgent, setDraggedAgent] = createSignal<string | null>(null);
  const [dragOffset, setDragOffset] = createSignal<Position>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = createSignal(false);
  
  // Track active event listeners for cleanup
  let isListening = false;

  const handleMouseDown = (
    e: MouseEvent,
    agentId: string,
    agentPosition: Position
  ) => {
    e.preventDefault();
    
    const canvasEl = getCanvasElement();
    if (!canvasEl) return;
    
    setDraggedAgent(agentId);
    setIsDragging(true);
    onDragStart?.(agentId);
    
    // Calculate offset using shared coordinate utilities
    const canvasRect = canvasEl.getBoundingClientRect();
    const currentZoom = zoomLevel?.() || 1.0;
    const containerSize = { width: canvasEl.clientWidth, height: canvasEl.clientHeight };
    
    const transformer = createCoordinateTransformer(canvasRect, containerSize, currentZoom);
    const agentScreenPos = transformer.toScreen(agentPosition);
    
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
    const currentZoom = zoomLevel?.() || 1.0;
    const canvasRect = canvasEl.getBoundingClientRect();
    const containerSize = { width: canvasEl.clientWidth, height: canvasEl.clientHeight };
    
    // Calculate mouse position adjusting for drag offset
    const mouseScreenPos = {
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    };
    
    const scrollOffset = {
      x: canvasEl.scrollLeft,
      y: canvasEl.scrollTop,
    };
    
    // Convert to content coordinates using shared utilities
    const transformer = createCoordinateTransformer(canvasRect, containerSize, currentZoom);
    let newPosition = transformer.toContent(mouseScreenPos, scrollOffset);

    // Constrain to canvas boundaries if enabled
    if (constrainToBounds) {
      newPosition = transformer.constrainBounds(newPosition, agentSize);
    }

    onDragMove?.(agentId, newPosition);
  };

  const handleMouseUp = () => {
    const draggedId = draggedAgent();
    
    setDraggedAgent(null);
    setIsDragging(false);
    
    removeEventListeners();
    
    if (draggedId) {
      onDragEnd?.(draggedId);
    }
  };

  const handleInterruption = () => {
    // Clean up if drag is interrupted (page visibility change, beforeunload, etc.)
    if (isDragging()) {
      const draggedId = draggedAgent();
      setDraggedAgent(null);
      setIsDragging(false);
      
      removeEventListeners();
      
      if (draggedId) {
        onDragEnd?.(draggedId);
      }
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
