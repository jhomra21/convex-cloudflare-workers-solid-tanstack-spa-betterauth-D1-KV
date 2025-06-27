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
}

export function useCanvasDrag(options: UseDragOptions = {}) {
  const {
    onDragStart,
    onDragMove,
    onDragEnd,
    constrainToBounds = true,
    agentWidth = 320,
    agentHeight = 384,
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
      const offsetX = e.clientX - (canvasRect.left + agentPosition.x);
      const offsetY = e.clientY - (canvasRect.top + agentPosition.y);
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
    
    // Calculate new position relative to canvas
    let newX = e.clientX - canvasRect.left - offset.x + canvasEl.scrollLeft;
    let newY = e.clientY - canvasRect.top - offset.y + canvasEl.scrollTop;

    // Constrain to canvas boundaries if enabled
    if (constrainToBounds) {
      const maxX = Math.max(0, canvasEl.clientWidth - agentWidth);
      const maxY = Math.max(0, canvasEl.clientHeight - agentHeight);
      
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
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
