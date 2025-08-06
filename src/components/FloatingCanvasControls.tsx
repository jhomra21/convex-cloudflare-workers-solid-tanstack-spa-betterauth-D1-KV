import { type Component, Show, createSignal } from 'solid-js';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { cn } from '~/lib/utils';

export interface FloatingCanvasControlsProps {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onResetView?: () => void;
  position?: 'bottom-left' | 'bottom-right' | 'bottom-center';
  showHelp?: boolean;
  isMinimized?: boolean;
  onToggleMinimize?: (value: boolean) => void;
}

export const FloatingCanvasControls: Component<FloatingCanvasControlsProps> = (props) => {
  const [isMinimized, setIsMinimized] = createSignal(props.isMinimized ?? false);
  const [showHelp, setShowHelp] = createSignal(props.showHelp ?? false);

  const handleToggleMinimize = () => {
    const newState = !isMinimized();
    setIsMinimized(newState);
    props.onToggleMinimize?.(newState);
    // Store preference
    localStorage.setItem('canvas-controls-minimized', String(newState));
  };

  const handleToggleHelp = () => {
    setShowHelp(!showHelp());
  };

  const position = props.position ?? 'bottom-center';
  // Center controls at bottom to match top toolbar, or position left/right
  const positionClasses =
    position === 'bottom-left' ? 'bottom-4 left-4' :
      position === 'bottom-right' ? 'bottom-4 right-4' :
        'bottom-4 left-1/2 -translate-x-1/2'; // Center by default

  return (
    <>
      {/* Main controls */}
      <div
        class={cn(
          "absolute z-40",
          positionClasses,
          "bg-background/95 supports-[backdrop-filter]:bg-background/95",
          "border rounded-lg shadow-lg",
          "transition-all ease-[cubic-bezier(0.4,0,0.2,1)]",
          isMinimized() ? "p-0" : "p-1"
        )}
      >
        <div
          class="relative overflow-hidden"
          style={{
            "max-height": isMinimized() ? "40px" : "300px",
            "transition": "max-height 150ms cubic-bezier(0.4, 0, 0.2, 1) ease-in"
          }}
        >
          {/* Minimized view - zoom controls with percentage */}
          <div
            class="flex items-center gap-2 px-2 py-1.5"
            style={{
              "display": isMinimized() ? "flex" : "none"
            }}
          >
            <Button
              onClick={props.onZoomOut}
              size="sm"
              variant="ghost"
              disabled={props.zoom <= props.minZoom}
              class="h-6 w-6 p-0"
              title="Zoom Out"
            >
              <span class="text-sm font-bold">−</span>
            </Button>

            <span class="text-sm font-mono text-muted-foreground min-w-[45px] text-center">
              {Math.round(props.zoom * 100)}%
            </span>

            <Button
              onClick={props.onZoomIn}
              size="sm"
              variant="ghost"
              disabled={props.zoom >= props.maxZoom}
              class="h-6 w-6 p-0"
              title="Zoom In"
            >
              <span class="text-sm font-bold">+</span>
            </Button>

            <div class="w-px h-4 bg-border mx-1" />

            <Button
              size="sm"
              variant="ghost"
              onClick={handleToggleMinimize}
              class="h-6 w-6 p-0"
              title="Expand controls"
            >
              <Icon
                name="chevron-up"
                class="h-3 w-3 transition-transform duration-150"
                style={{
                  "transform": isMinimized() ? "rotate(0deg)" : "rotate(180deg)"
                }}
              />
            </Button>
          </div>
          {/* Expanded view */}
          <div
            class="p-2"
            style={{
              "display": isMinimized() ? "none" : "block",
              "animation": !isMinimized() ? "controls-fade-slide 150ms ease-in" : "none"
            }}
          >
            {/* Zoom controls - top row */}
            <div class="flex items-center justify-center gap-1 mb-2">
              <Button
                onClick={props.onZoomOut}
                size="sm"
                variant="ghost"
                disabled={props.zoom <= props.minZoom}
                class="h-8 w-8 p-0"
                title="Zoom Out (Ctrl + Scroll Down)"
              >
                <span class="text-base font-bold">−</span>
              </Button>

              <div class="px-2 min-w-[60px] text-center">
                <span class="text-sm font-mono text-muted-foreground">
                  {Math.round(props.zoom * 100)}%
                </span>
              </div>

              <Button
                onClick={props.onZoomIn}
                size="sm"
                variant="ghost"
                disabled={props.zoom >= props.maxZoom}
                class="h-8 w-8 p-0"
                title="Zoom In (Ctrl + Scroll Up)"
              >
                <span class="text-base font-bold">+</span>
              </Button>
            </div>

            {/* Additional controls - bottom row */}
            <div class="flex items-center justify-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleToggleHelp}
                class="h-7 px-2 text-xs"
                title="Keyboard shortcuts"
              >
                <span class="text-xs mr-1">?</span>
                Help
              </Button>

              <Button
                onClick={props.onResetZoom}
                size="sm"
                variant="ghost"
                disabled={props.zoom === 1.0}
                class="h-7 w-7 p-0"
                title="Reset Zoom (100%)"
              >
                <Icon name="refresh-cw" class="h-4 w-4" />
              </Button>

              <Show when={props.onResetView}>
                <Button
                  onClick={props.onResetView}
                  size="sm"
                  variant="ghost"
                  class="h-7 w-7 p-0"
                  title="Reset View"
                >
                  <Icon name="house" class="h-4 w-4" />
                </Button>
              </Show>

              <Button
                size="sm"
                variant="ghost"
                onClick={handleToggleMinimize}
                class="h-7 w-7 p-0"
                title="Minimize controls"
              >
                <Icon
                  name="chevron-up"
                  class="h-3 w-3 transition-transform duration-150"
                  style={{
                    "transform": isMinimized() ? "rotate(0deg)" : "rotate(180deg)"
                  }}
                />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Help overlay */}
      <Show when={showHelp()}>
        <div
          class={cn(
            "absolute z-50",
            position === 'bottom-left' ? 'bottom-20 left-4' :
              position === 'bottom-right' ? 'bottom-20 right-4' :
                'bottom-20 left-1/2 -translate-x-1/2', // Center if controls are centered
            "bg-background/95 backdrop-blur border rounded-lg shadow-lg p-4",
            "max-w-xs"
          )}
        >
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold">Canvas Controls</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleToggleHelp}
              class="h-6 w-6 p-0"
            >
              <Icon name="x" class="h-3 w-3" />
            </Button>
          </div>

          <div class="space-y-2 text-xs text-muted-foreground">
            <div class="flex justify-between">
              <span>Pan canvas</span>
              <kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Click + Drag</kbd>
            </div>
            <div class="flex justify-between">
              <span>Move agent</span>
              <kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Drag Agent</kbd>
            </div>
            <div class="flex justify-between">
              <span>Zoom in/out</span>
              <kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl + Scroll</kbd>
            </div>
            <div class="flex justify-between">
              <span>Reset zoom</span>
              <kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl + 0</kbd>
            </div>
            <div class="flex justify-between">
              <span>Toggle sidebar</span>
              <kbd class="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl + B</kbd>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
};
