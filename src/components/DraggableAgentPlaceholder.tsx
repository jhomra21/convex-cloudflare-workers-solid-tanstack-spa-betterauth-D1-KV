import { Show, type Component } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Icon } from '~/components/ui/icon';
import { cn } from '~/lib/utils';
import type { AgentDragType } from '~/lib/hooks/use-toolbar-drag-drop';

interface DraggableAgentPlaceholderProps {
  isDragging: boolean;
  dragType: AgentDragType | null;
  cursorX: number;
  cursorY: number;
  isOverCanvas: boolean;
  hasMoved: boolean; // Add this to check if actually dragging
}

export const DraggableAgentPlaceholder: Component<DraggableAgentPlaceholderProps> = (props) => {
  // Get agent details based on type
  const getAgentDetails = () => {
    switch (props.dragType) {
      case 'image-generate':
        return {
          icon: 'image' as const,
          color: 'blue',
          label: 'Image Generate',
          description: 'Create AI images',
        };
      case 'image-edit':
        return {
          icon: 'edit' as const,
          color: 'purple',
          label: 'Image Edit',
          description: 'Edit existing images',
        };
      case 'voice-generate':
        return {
          icon: 'mic' as const,
          color: 'indigo',
          label: 'Voice Generate',
          description: 'Generate voice audio',
        };
      case 'video-generate':
        return {
          icon: 'video' as const,
          color: 'red',
          label: 'Video Generate',
          description: 'Create AI videos',
        };
      default:
        return null;
    }
  };

  return (
    <Show when={props.isDragging && props.dragType && props.hasMoved}>
      <Portal>
        <div
          class="fixed pointer-events-none z-[10000]"
          style={{
            transform: `translate(${props.cursorX}px, ${props.cursorY}px)`,
            left: '0',
            top: '0',
            'will-change': 'transform',
          }}
        >
          {/* Main placeholder card */}
          <div
            class={cn(
              "relative -translate-x-1/2 -translate-y-1/2",
              "bg-background/95 backdrop-blur-sm",
              "border-2 rounded-lg shadow-2xl",
              props.isOverCanvas
                ? "scale-100 opacity-90 border-primary shadow-primary/20"
                : "scale-95 opacity-75 border-dashed border-muted-foreground/50"
            )}
            style={{
              width: props.dragType === 'video-generate' ? '160px' : '160px',
              height: props.dragType === 'video-generate' ? '225px' : '192px',
            }}
          >
            {(() => {
              const details = getAgentDetails();
              if (!details) return null;

              return (
                <>
                  {/* Gradient background effect */}
                  <div
                    class={cn(
                      "absolute inset-0 rounded-lg opacity-10",
                      `bg-gradient-to-br from-${details.color}-500 to-${details.color}-600`
                    )}
                  />

                  {/* Content */}
                  <div class="relative flex flex-col items-center justify-center h-full p-4">
                    {/* Icon */}
                    <div
                      class={cn(
                        "mb-3 p-3 rounded-full",
                        `bg-${details.color}-100 dark:bg-${details.color}-900/50`
                      )}
                    >
                      <Icon
                        name={details.icon}
                        class={cn(
                          "h-8 w-8",
                          `text-${details.color}-600 dark:text-${details.color}-400`
                        )}
                      />
                    </div>

                    {/* Label */}
                    <div class="text-center">
                      <p class="text-sm font-semibold text-foreground mb-1">
                        {details.label}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        {details.description}
                      </p>
                    </div>

                    {/* Drop indicator */}
                    <Show when={props.isOverCanvas}>
                      <div class="absolute -bottom-8 left-1/2 -translate-x-1/2">
                        <div class="flex items-center gap-1 px-2 py-1 bg-primary/90 text-primary-foreground rounded-full text-xs font-medium animate-pulse">
                          <Icon name="arrow-down" class="h-3 w-3" />
                          <span>Drop to add</span>
                        </div>
                      </div>
                    </Show>
                  </div>

                </>
              );
            })()}
          </div>

          {/* Cursor indicator */}
          <Show when={!props.isOverCanvas}>
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <Icon
                name="move"
                class="h-6 w-6 text-muted-foreground animate-pulse"
              />
            </div>
          </Show>
        </div>
      </Portal>
    </Show>
  );
};
