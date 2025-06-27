# Drag & Canvas Improvements

## Issues Fixed

### 1. Flickering During Drag Operations
**Problem**: When dragging one agent, other agents (especially those with images) would flicker due to unnecessary re-renders.

**Solution**:
- **Memoized drag state**: Created local `isDragged()` and `isResizing()` functions in the render loop to prevent all agents from re-rendering when drag state changes
- **Stable status hook**: Created `useStableStatus()` to minimize status-based re-renders
- **Memoized agent properties**: Used `createMemo()` for agent size calculations
- **Isolated re-renders**: Only the dragged agent and agents that actually change state re-render

### 2. Z-Index Stacking Order
**Problem**: After dragging, the last created agent would always appear on top instead of maintaining proper stacking order.

**Solution**:
- **Dynamic z-index management**: Implemented a system that tracks the maximum z-index and assigns incremental values
- **Bring-to-front behavior**: Any interaction (drag, resize, click) brings the agent to the front
- **Persistent stacking**: Z-index values persist until another agent is interacted with
- **Drag priority**: Dragged agents get z-index 9999 to ensure they're always on top during drag

## Technical Implementation

### New Hooks & Components

1. **Z-Index Management**:
   ```typescript
   const [maxZIndex, setMaxZIndex] = createSignal(1);
   const [agentZIndices, setAgentZIndices] = createSignal<Map<string, number>>(new Map());
   
   const bringAgentToFront = (agentId: string) => {
     const newZIndex = maxZIndex() + 1;
     setMaxZIndex(newZIndex);
     setAgentZIndices(prev => new Map(prev).set(agentId, newZIndex));
   };
   ```

2. **Optimized Rendering**:
   ```typescript
   // Memoize drag state to prevent unnecessary re-renders
   const isDragged = () => dragHook.draggedAgent() === agent.id;
   const isResizing = () => resizeHook.resizingAgent() === agent.id;
   const zIndex = () => getAgentZIndex(agent.id, isDragged());
   ```

3. **Stable Status Hook**:
   ```typescript
   export function useStableStatus(status: () => string | undefined) {
     return createMemo(() => ({
       isProcessing: status() === 'processing',
       isFailed: status() === 'failed',
       isSuccess: status() === 'success',
       isIdle: status() === 'idle' || !status(),
     }));
   }
   ```

### Interaction Improvements

- **Click-to-front**: Any interaction with an agent brings it to the front
- **Stable transforms**: Transform and transition properties are now memoized per agent
- **Proper drag scaling**: Only the dragged agent scales up (1.05x) and has disabled transitions
- **Error boundaries**: Added error boundaries to prevent crashes during drag operations

## Performance Benefits

1. **Reduced re-renders**: Non-dragged agents no longer re-render during drag operations
2. **Smoother interactions**: Memoized state prevents cascade re-renders
3. **Better stacking**: Intuitive z-index behavior where recently interacted agents stay on top
4. **Memory efficiency**: WeakMap-based persistent state prevents memory leaks

## User Experience Improvements

- ✅ No more flickering when dragging empty agents
- ✅ Proper stacking order maintained after drag operations
- ✅ Visual feedback during drag (scaling, border highlights)
- ✅ Intuitive bring-to-front behavior on any interaction
- ✅ Smooth transitions and animations
