import { createSignal } from 'solid-js';

// Global canvas state that can be shared between components
const [activeCanvasId, setActiveCanvasId] = createSignal<string | null>(null);
const [currentCanvas, setCurrentCanvas] = createSignal<any>(null);

export {
    activeCanvasId,
    setActiveCanvasId,
    currentCanvas,
    setCurrentCanvas
};