import { createSignal, onCleanup } from 'solid-js';
import { type Position, type Size } from '~/lib/utils/canvas-coordinates';

export interface ResizeState {
  resizingAgent: string | null;
  resizeHandle: string | null;
  resizeStartSize: Size;
  resizeStartPos: Position;
}

export interface UseResizeOptions {
  onResizeStart?: (agentId: string, handle: string) => void;
  onResizeMove?: (agentId: string, size: Size, position?: Position) => void;
  onResizeEnd?: (agentId: string) => void;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
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
  } = options;

  const [resizingAgent, setResizingAgent] = createSignal<string | null>(null);
  const [resizeHandle, setResizeHandle] = createSignal<string | null>(null);
  const [resizeStartSize, setResizeStartSize] = createSignal<Size>({ width: 0, height: 0 });
  const [resizeStartPos, setResizeStartPos] = createSignal<Position>({ x: 0, y: 0 });
  
  // Track active event listeners for cleanup
  let isListening = false;

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
    
    const deltaX = e.clientX - startPos.x;
    const deltaY = e.clientY - startPos.y;

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
      
      if (handle.includes('w')) { // Left side
        positionAdjustment.x = startSize.width - newWidth;
      }
      if (handle.includes('n')) { // Top side
        positionAdjustment.y = startSize.height - newHeight;
      }
    }

    onResizeMove?.(agentId, { width: newWidth, height: newHeight }, positionAdjustment);
  };

  const handleResizeEnd = () => {
    const resizingId = resizingAgent();
    
    setResizingAgent(null);
    setResizeHandle(null);
    
    removeEventListeners();
    
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
