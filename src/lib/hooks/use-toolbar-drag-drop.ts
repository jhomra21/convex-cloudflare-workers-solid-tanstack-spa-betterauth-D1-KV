import { createSignal, onCleanup, type Accessor } from 'solid-js';
import type { ViewportState } from './use-viewport';
import type { Position } from '~/lib/utils/canvas-coordinates';

export type AgentDragType = 'image-generate' | 'image-edit' | 'voice-generate' | 'video-generate';

interface DragState {
  isDragging: boolean;
  dragType: AgentDragType | null;
  cursorPosition: Position;
  canvasPosition: Position | null;
  startPosition: Position; // Track where drag started
  hasMoved: boolean; // Track if mouse moved enough to be considered a drag
}

interface UseToolbarDragDropProps {
  viewport: Accessor<ViewportState>;
  onDrop: (type: AgentDragType, position: Position) => void;
}

export function useToolbarDragDrop(props: UseToolbarDragDropProps) {
  const [dragState, setDragState] = createSignal<DragState>({
    isDragging: false,
    dragType: null,
    cursorPosition: { x: 0, y: 0 },
    canvasPosition: null,
    startPosition: { x: 0, y: 0 },
    hasMoved: false,
  });

  let canvasElement: HTMLElement | null = null;

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = (screenX: number, screenY: number): Position | null => {
    if (!canvasElement) return null;
    
    const rect = canvasElement.getBoundingClientRect();
    const viewport = props.viewport();
    
    // Calculate position relative to canvas viewport
    const canvasX = (screenX - rect.left - viewport.tx) / viewport.zoom;
    const canvasY = (screenY - rect.top - viewport.ty) / viewport.zoom;
    
    return { x: canvasX, y: canvasY };
  };

  // Start dragging from toolbar
  const startDrag = (type: AgentDragType, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent click event from firing
    
    // Find the canvas element
    canvasElement = document.querySelector('.canvas-container') as HTMLElement;
    if (!canvasElement) {
      console.warn('Canvas container not found');
      return;
    }

    const startPos = { x: e.clientX, y: e.clientY };
    setDragState({
      isDragging: true,
      dragType: type,
      cursorPosition: startPos,
      canvasPosition: null,
      startPosition: startPos,
      hasMoved: false,
    });

    // Add global mouse event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
  };

  // Handle mouse movement during drag
  const handleMouseMove = (e: MouseEvent) => {
    const state = dragState();
    if (!state.isDragging || !canvasElement) return;

    // Check if mouse has moved enough to be considered a drag (5px threshold)
    const distance = Math.sqrt(
      Math.pow(e.clientX - state.startPosition.x, 2) + 
      Math.pow(e.clientY - state.startPosition.y, 2)
    );
    const hasMoved = distance > 5;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    
    setDragState({
      ...state,
      cursorPosition: { x: e.clientX, y: e.clientY },
      canvasPosition: canvasPos,
      hasMoved,
    });
  };

  // Handle drop
  const handleMouseUp = (e: MouseEvent) => {
    const state = dragState();
    if (!state.isDragging || !state.dragType) return;

    // Only perform drop if mouse actually moved (not just a click)
    if (state.hasMoved) {
      // Check if drop is over canvas
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      if (canvasPos && canvasElement) {
        const rect = canvasElement.getBoundingClientRect();
        const isOverCanvas = 
          e.clientX >= rect.left && 
          e.clientX <= rect.right && 
          e.clientY >= rect.top && 
          e.clientY <= rect.bottom;

        if (isOverCanvas) {
          // Adjust position to center the agent at drop point
          const agentSize = getAgentSize(state.dragType);
          const adjustedPosition = {
            x: canvasPos.x - agentSize.width / 2,
            y: canvasPos.y - agentSize.height / 2,
          };
          
          props.onDrop(state.dragType, adjustedPosition);
        }
      }
    }

    // Clean up
    endDrag();
  };

  // End dragging
  const endDrag = () => {
    setDragState({
      isDragging: false,
      dragType: null,
      cursorPosition: { x: 0, y: 0 },
      canvasPosition: null,
      startPosition: { x: 0, y: 0 },
      hasMoved: false,
    });

    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Restore cursor
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    canvasElement = null;
  };

  // Get agent size based on type
  const getAgentSize = (type: AgentDragType) => {
    switch (type) {
      case 'video-generate':
        return { width: 320, height: 450 };
      default:
        return { width: 320, height: 384 };
    }
  };

  // Clean up on unmount
  onCleanup(() => {
    if (dragState().isDragging) {
      endDrag();
    }
  });

  return {
    dragState,
    startDrag,
    getAgentSize,
  };
}
