/**
 * Shared coordinate transformation utilities for canvas operations
 * Eliminates duplication between drag hooks and main canvas component
 */

export interface ViewportState {
    x: number;
    y: number;
    zoom: number;
}

export interface Position {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

export interface CanvasElement extends HTMLElement {
    clientWidth: number;
    clientHeight: number;
}

/**
 * Calculate center-based scaling offset for zoom transformations
 */
export function calculateScalingOffset(
    containerSize: Size,
    zoom: number
): Position {
    const scaledWidth = containerSize.width * zoom;
    const scaledHeight = containerSize.height * zoom;

    return {
        x: (containerSize.width - scaledWidth) / 2,
        y: (containerSize.height - scaledHeight) / 2,
    };
}

/**
 * Convert screen coordinates to content coordinates accounting for zoom and scaling
 */
export function screenToContent(
    screenPos: Position,
    canvasRect: DOMRect,
    containerSize: Size,
    zoom: number,
    scrollOffset: Position = { x: 0, y: 0 }
): Position {
    const scalingOffset = calculateScalingOffset(containerSize, zoom);

    // Adjust for canvas position and scroll
    const adjustedX = screenPos.x - canvasRect.left + scrollOffset.x;
    const adjustedY = screenPos.y - canvasRect.top + scrollOffset.y;

    // Convert to content coordinates
    return {
        x: (adjustedX - scalingOffset.x) / zoom,
        y: (adjustedY - scalingOffset.y) / zoom,
    };
}

/**
 * Convert content coordinates to screen coordinates accounting for zoom and scaling
 */
export function contentToScreen(
    contentPos: Position,
    canvasRect: DOMRect,
    containerSize: Size,
    zoom: number,
    scrollOffset: Position = { x: 0, y: 0 }
): Position {
    const scalingOffset = calculateScalingOffset(containerSize, zoom);

    // Convert content to screen coordinates
    const screenX = contentPos.x * zoom + scalingOffset.x;
    const screenY = contentPos.y * zoom + scalingOffset.y;

    return {
        x: screenX + canvasRect.left - scrollOffset.x,
        y: screenY + canvasRect.top - scrollOffset.y,
    };
}

/**
 * Calculate canvas boundaries for element positioning
 * Accounts for zoom level and center scaling
 */
export function calculateCanvasBounds(
    containerSize: Size,
    elementSize: Size,
    zoom: number
): { min: Position; max: Position } {
    const scalingOffset = calculateScalingOffset(containerSize, zoom);
    const scalingOffsetInContent = {
        x: scalingOffset.x / zoom,
        y: scalingOffset.y / zoom,
    };

    // Content space boundaries (can go negative when zoomed out)
    const contentSize = {
        width: containerSize.width / zoom,
        height: containerSize.height / zoom,
    };

    return {
        min: {
            x: -scalingOffsetInContent.x,
            y: -scalingOffsetInContent.y,
        },
        max: {
            x: -scalingOffsetInContent.x + contentSize.width - elementSize.width,
            y: -scalingOffsetInContent.y + contentSize.height - elementSize.height,
        },
    };
}

/**
 * Constrain position to canvas boundaries
 */
export function constrainToCanvasBounds(
    position: Position,
    containerSize: Size,
    elementSize: Size,
    zoom: number
): Position {
    const bounds = calculateCanvasBounds(containerSize, elementSize, zoom);

    return {
        x: Math.max(bounds.min.x, Math.min(position.x, bounds.max.x)),
        y: Math.max(bounds.min.y, Math.min(position.y, bounds.max.y)),
    };
}

/**
 * Calculate grid position for smart agent placement
 */
export function calculateGridPosition(
    containerSize: Size,
    elementSize: Size,
    existingCount: number,
    padding: number = 20
): Position {
    const agentsPerRow = Math.floor(
        (containerSize.width - padding * 2) / (elementSize.width + padding)
    );
    const agentsPerCol = Math.floor(
        (containerSize.height - padding * 2) / (elementSize.height + padding)
    );
    const totalSlotsAvailable = agentsPerRow * agentsPerCol;

    if (existingCount < totalSlotsAvailable) {
        // Normal grid positioning
        const gridCol = existingCount % agentsPerRow;
        const gridRow = Math.floor(existingCount / agentsPerRow);

        return {
            x: padding + (gridCol * (elementSize.width + padding)),
            y: padding + (gridRow * (elementSize.height + padding)),
        };
    } else {
        // Overflow with slight offset
        const overlapOffset = 30;
        const baseAgentIndex = existingCount % totalSlotsAvailable;
        const overlapLayer = Math.floor(existingCount / totalSlotsAvailable);

        const gridCol = baseAgentIndex % agentsPerRow;
        const gridRow = Math.floor(baseAgentIndex / agentsPerRow);

        const baseX = padding + (gridCol * (elementSize.width + padding));
        const baseY = padding + (gridRow * (elementSize.height + padding));

        return {
            x: Math.min(
                baseX + (overlapLayer * overlapOffset),
                containerSize.width - elementSize.width - padding
            ),
            y: Math.min(
                baseY + (overlapLayer * overlapOffset),
                containerSize.height - elementSize.height - padding
            ),
        };
    }
}

/**
 * Get canvas element with type safety
 */
export function getCanvasElement(): CanvasElement | null {
    const element = document.querySelector('.canvas-container') as CanvasElement;
    return element && element.clientWidth ? element : null;
}

/**
 * Create a memoized coordinate transformer for performance
 */
export function createCoordinateTransformer(
    canvasRect: DOMRect,
    containerSize: Size,
    zoom: number
) {
    const scalingOffset = calculateScalingOffset(containerSize, zoom);

    return {
        toContent: (screenPos: Position, scrollOffset: Position = { x: 0, y: 0 }) =>
            screenToContent(screenPos, canvasRect, containerSize, zoom, scrollOffset),

        toScreen: (contentPos: Position, scrollOffset: Position = { x: 0, y: 0 }) =>
            contentToScreen(contentPos, canvasRect, containerSize, zoom, scrollOffset),

        constrainBounds: (position: Position, elementSize: Size) =>
            constrainToCanvasBounds(position, containerSize, elementSize, zoom),
    };
}
