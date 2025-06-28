import { createSignal } from 'solid-js';

export interface DragState {
  draggedAgent: string | null;
  dragOffset: { x: number; y: number };
  isDragging: boolean;
}

export interface UseDragOptions {
  onDragStart?: (agentId: string) => void;
  onDragMove?: (agentId: string, position: { x: number; y: number }) => void;
  onDragEnd?: (agentId: string) => void;
  constrainToBounds?: boolean;
  agentWidth?: number;
  agentHeight?: number;
  zoomLevel?: () => number; // Function to get current zoom level
}

export function useCanvasDrag(options: UseDragOptions = {}) {
  const {
    onDragStart,
    onDragMove,
    onDragEnd,
    constrainToBounds = true,
    agentWidth = 320,
    agentHeight = 384,
    zoomLevel,
  } = options;

  const [draggedAgent, setDraggedAgent] = createSignal<string | null>(null);
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = createSignal(false);

  const handleMouseDown = (
    e: MouseEvent,
    agentId: string,
    agentPosition: { x: number; y: number }
  ) => {
    e.preventDefault();
    
    setDraggedAgent(agentId);
    setIsDragging(true);
    onDragStart?.(agentId);
    
    // Calculate offset from mouse to agent's top-left corner
    const canvasEl = document.querySelector('.canvas-container') as HTMLElement;
    if (canvasEl) {
      const canvasRect = canvasEl.getBoundingClientRect();
      const currentZoom = zoomLevel?.() || 1.0;
      
      // Calculate center-based scaling offset
      const containerWidth = canvasEl.clientWidth;
      const containerHeight = canvasEl.clientHeight;
      const scaledWidth = containerWidth * currentZoom;
      const scaledHeight = containerHeight * currentZoom;
      const centerOffsetX = (containerWidth - scaledWidth) / 2;
      const centerOffsetY = (containerHeight - scaledHeight) / 2;
      
      // Convert agent position to screen coordinates accounting for center scaling
      const agentScreenX = centerOffsetX + (agentPosition.x * currentZoom);
      const agentScreenY = centerOffsetY + (agentPosition.y * currentZoom);
      
      const offsetX = e.clientX - (canvasRect.left + agentScreenX);
      const offsetY = e.clientY - (canvasRect.top + agentScreenY);
      setDragOffset({ x: offsetX, y: offsetY });
    }

    // Add global mouse move and up listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    const agentId = draggedAgent();
    if (!agentId || !isDragging()) return;

    const canvasEl = document.querySelector('.canvas-container') as HTMLElement;
    if (!canvasEl) return;

    const canvasRect = canvasEl.getBoundingClientRect();
    const offset = dragOffset();
    const currentZoom = zoomLevel?.() || 1.0;
    
    // Calculate mouse position in screen coordinates
    const screenX = e.clientX - canvasRect.left - offset.x + canvasEl.scrollLeft;
    const screenY = e.clientY - canvasRect.top - offset.y + canvasEl.scrollTop;
    
    // Calculate center-based scaling offset
    const containerWidth = canvasEl.clientWidth;
    const containerHeight = canvasEl.clientHeight;
    const scaledWidth = containerWidth * currentZoom;
    const scaledHeight = containerHeight * currentZoom;
    const centerOffsetX = (containerWidth - scaledWidth) / 2;
    const centerOffsetY = (containerHeight - scaledHeight) / 2;
    
    // Convert screen coordinates to content coordinates accounting for center scaling
    let newX = (screenX - centerOffsetX) / currentZoom;
    let newY = (screenY - centerOffsetY) / currentZoom;

    // Constrain to canvas boundaries if enabled (in content space)
    if (constrainToBounds) {
      // Calculate available content space accounting for center scaling
      const contentWidth = canvasEl.clientWidth / currentZoom;
      const contentHeight = canvasEl.clientHeight / currentZoom;
      
      // When zoomed out, center scaling creates negative coordinate space
      // We need to account for the offset in our boundaries
      const centerOffsetInContentSpace = centerOffsetX / currentZoom;
      const centerOffsetYInContentSpace = centerOffsetY / currentZoom;
      
      // Boundaries in content space (can go negative when zoomed out)
      const minX = -centerOffsetInContentSpace;
      const minY = -centerOffsetYInContentSpace;
      const maxX = minX + contentWidth - agentWidth;
      const maxY = minY + contentHeight - agentHeight;
      
      newX = Math.max(minX, Math.min(newX, maxX));
      newY = Math.max(minY, Math.min(newY, maxY));
    }

    onDragMove?.(agentId, { x: newX, y: newY });
  };

  const handleMouseUp = () => {
    const draggedId = draggedAgent();
    
    setDraggedAgent(null);
    setIsDragging(false);
    
    // Remove global listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    if (draggedId) {
      onDragEnd?.(draggedId);
    }
  };

  return {
    draggedAgent,
    isDragging,
    handleMouseDown,
    handleMouseUp, // Export for manual cleanup
  };
}
