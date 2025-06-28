import { Show, For, createMemo } from 'solid-js';
import { useQuery } from '~/lib/convex';
import { convexApi } from '~/lib/convex';
import { useRouteContext } from '@tanstack/solid-router';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';

export interface CanvasSelectorProps {
  activeCanvasId: string | null;
  onCanvasChange: (canvasId: string | null) => void;
  currentCanvasName?: string;
}

export function CanvasSelector(props: CanvasSelectorProps) {
  const context = useRouteContext({ from: '/dashboard' });
  const userId = createMemo(() => context()?.session?.user?.id);
  
  // Fetch user's own canvas
  const ownCanvas = useQuery(
    convexApi.canvas.getCanvas,
    () => userId() ? { userId: userId()! } : undefined
  );
  
  // Fetch shared canvases
  const sharedCanvases = useQuery(
    convexApi.canvas.getSharedCanvases,
    () => userId() ? { userId: userId()! } : undefined
  );
  
  // Fetch specific canvas by ID if we have an activeCanvasId
  const specificCanvas = useQuery(
    convexApi.canvas.getCanvasById,
    () => (props.activeCanvasId && userId()) ? { canvasId: props.activeCanvasId as any, userId: userId()! } : undefined
  );
  
  const currentCanvas = createMemo(() => {
    if (!props.activeCanvasId) {
      return { name: ownCanvas()?.name || 'My Canvas', type: 'own' as const };
    }
    
    // Check if it's the user's own canvas first
    if (ownCanvas()?._id === props.activeCanvasId) {
      return { name: ownCanvas()?.name || 'My Canvas', type: 'own' as const };
    }
    
    // Find in shared canvases (where user is recipient)
    const shared = sharedCanvases()?.find(c => c._id === props.activeCanvasId);
    if (shared) {
      return { name: shared.name, type: 'shared' as const };
    }
    
    // Try specific canvas query (for cases where user joined via share link)
    if (specificCanvas()) {
      const isOwner = specificCanvas()?.userId === userId();
      return { 
        name: specificCanvas()?.name || 'Canvas', 
        type: isOwner ? 'own' as const : 'shared' as const 
      };
    }
    
    return { name: 'Loading...', type: 'unknown' as const };
  });
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="outline" size="sm" class="flex items-center gap-2 min-w-0">
          <Icon 
            name={currentCanvas().type === 'shared' ? 'users' : 'user'} 
            class="h-4 w-4 flex-shrink-0" 
          />
          <span class="truncate max-w-32">
            {currentCanvas().name}
          </span>
          <Icon name="chevron-down" class="h-4 w-4 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent class="w-64">
        <DropdownMenuLabel>Switch Canvas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* User's own canvas */}
        <Show when={ownCanvas()}>
          <DropdownMenuItem
            class="flex items-center gap-2 cursor-pointer"
            onClick={() => props.onCanvasChange(null)}
          >
            <Icon name="user" class="h-4 w-4" />
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">
                {ownCanvas()?.name || 'My Canvas'}
              </div>
              <div class="text-xs text-muted-foreground">Your canvas</div>
            </div>
            <Show when={!props.activeCanvasId}>
              <Icon name="check" class="h-4 w-4 text-primary" />
            </Show>
          </DropdownMenuItem>
        </Show>
        
        {/* Shared canvases */}
        <Show when={sharedCanvases() && sharedCanvases()!.length > 0}>
          <DropdownMenuSeparator />
          <DropdownMenuLabel class="text-xs text-muted-foreground">
            Shared with me
          </DropdownMenuLabel>
          <For each={sharedCanvases()}>
            {(canvas) => (
              <DropdownMenuItem
                class="flex items-center gap-2 cursor-pointer"
                onClick={() => props.onCanvasChange(canvas._id)}
              >
                <Icon name="users" class="h-4 w-4" />
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">{canvas.name}</div>
                  <div class="text-xs text-muted-foreground">
                    Shared by {canvas.sharedBy}
                  </div>
                </div>
                <Show when={props.activeCanvasId === canvas._id}>
                  <Icon name="check" class="h-4 w-4 text-primary" />
                </Show>
              </DropdownMenuItem>
            )}
          </For>
        </Show>
        
        <Show when={!sharedCanvases() || sharedCanvases()!.length === 0}>
          <Show when={userId()}>
            <DropdownMenuSeparator />
            <div class="px-2 py-2 text-sm text-muted-foreground text-center">
              No shared canvases yet
            </div>
          </Show>
        </Show>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
