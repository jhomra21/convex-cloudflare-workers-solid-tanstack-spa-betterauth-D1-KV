/**
 * Local-first viewport storage utilities
 * Manages viewport state in localStorage with Convex as backup
 */

export interface ViewportState {
  tx: number;
  ty: number;
  zoom: number;
}

export interface StoredViewport extends ViewportState {
  lastUpdated: number;
  canvasId: string;
  userId: string;
}

const VIEWPORT_STORAGE_PREFIX = 'viewport_';
const DEFAULT_VIEWPORT: ViewportState = {
  tx: 0,
  ty: 0,
  zoom: 0.25,
};

function getStorageKey(canvasId: string, userId: string): string {
  return `${VIEWPORT_STORAGE_PREFIX}${userId}_${canvasId}`;
}

function isDifferentFromDefault(viewport: ViewportState): boolean {
  const threshold = 0.001; // Small threshold for floating point comparison
  return (
    Math.abs(viewport.tx - DEFAULT_VIEWPORT.tx) > threshold ||
    Math.abs(viewport.ty - DEFAULT_VIEWPORT.ty) > threshold ||
    Math.abs(viewport.zoom - DEFAULT_VIEWPORT.zoom) > threshold
  );
}

export function getLocalViewport(canvasId: string, userId: string): ViewportState | null {
  try {
    const key = getStorageKey(canvasId, userId);
    const stored = localStorage.getItem(key);
    
    if (!stored) return null;
    
    const parsed: StoredViewport = JSON.parse(stored);
    
    // Validate the stored data
    if (
      typeof parsed.tx !== 'number' ||
      typeof parsed.ty !== 'number' ||
      typeof parsed.zoom !== 'number' ||
      parsed.canvasId !== canvasId ||
      parsed.userId !== userId
    ) {
      // Invalid data, remove it
      localStorage.removeItem(key);
      return null;
    }
    
    return {
      tx: parsed.tx,
      ty: parsed.ty,
      zoom: parsed.zoom,
    };
  } catch (error) {
    console.warn('Failed to get local viewport:', error);
    return null;
  }
}

export function saveLocalViewport(
  viewport: ViewportState,
  canvasId: string,
  userId: string
): void {
  try {
    const key = getStorageKey(canvasId, userId);
    const toStore: StoredViewport = {
      ...viewport,
      lastUpdated: Date.now(),
      canvasId,
      userId,
    };
    
    localStorage.setItem(key, JSON.stringify(toStore));
  } catch (error) {
    console.warn('Failed to save local viewport:', error);
  }
}

export function removeLocalViewport(canvasId: string, userId: string): void {
  try {
    const key = getStorageKey(canvasId, userId);
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to remove local viewport:', error);
  }
}

/**
 * Determine which viewport to use based on local-first strategy
 * Returns local viewport if it exists and differs from default,
 * otherwise returns convex viewport or default
 */
export function resolveInitialViewport(
  localViewport: ViewportState | null,
  convexViewport: { x: number; y: number; zoom: number } | null
): ViewportState {
  // If we have a local viewport and it's different from default, use it
  if (localViewport && isDifferentFromDefault(localViewport)) {
    return localViewport;
  }
  
  // Otherwise, use convex viewport if available
  if (convexViewport) {
    return {
      tx: convexViewport.x,
      ty: convexViewport.y,
      zoom: convexViewport.zoom,
    };
  }
  
  // Fall back to default
  return DEFAULT_VIEWPORT;
}

export function cleanupOldViewports(olderThanDays: number = 30): void {
  try {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(VIEWPORT_STORAGE_PREFIX)) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed: StoredViewport = JSON.parse(stored);
            if (parsed.lastUpdated < cutoffTime) {
              keysToRemove.push(key);
            }
          }
        } catch {
          // Invalid entry, mark for removal
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    if (keysToRemove.length > 0) {
      console.log(`Cleaned up ${keysToRemove.length} old viewport entries`);
    }
  } catch (error) {
    console.warn('Failed to cleanup old viewports:', error);
  }
}