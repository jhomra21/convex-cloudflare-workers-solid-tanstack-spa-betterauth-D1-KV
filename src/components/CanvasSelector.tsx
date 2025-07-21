import { Show, For, createMemo } from 'solid-js';
import { convexApi, useQuery } from '~/lib/convex';
import { useCurrentUserId, useCurrentUserName } from '~/lib/auth-actions';
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
    const userId = useCurrentUserId();

    // Only query for shared canvases (these are needed for the dropdown)
    // The main canvas queries are handled by the parent ImageCanvas component
    const sharedCanvases = useQuery(
        convexApi.canvas.getSharedCanvases,
        () => userId() ? { userId: userId()!} : null
    );

    // For the current canvas display, we'll use a simple approach
    // The parent component will pass the current canvas name if needed
    const currentCanvasName = () => {
        if (props.currentCanvasName) {
            return props.currentCanvasName;
        }
        return props.activeCanvasId ? 'Shared Canvas' : 'My Canvas';
    };

    const currentCanvas = createMemo(() => {
        if (!props.activeCanvasId) {
            return { name: currentCanvasName(), type: 'own' as const };
        }

        // Find in shared canvases (where user is recipient)
        const shared = sharedCanvases.data()?.find((c: any) => c._id === props.activeCanvasId);
        if (shared) {
            return { name: shared.name, type: 'shared' as const };
        }

        // Fallback to passed name or generic name
        return { 
            name: currentCanvasName(), 
            type: props.activeCanvasId ? 'shared' as const : 'own' as const 
        };
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
                <DropdownMenuItem
                    class="flex items-center gap-2 cursor-pointer"
                    onClick={() => props.onCanvasChange(null)}
                >
                    <Icon name="user" class="h-4 w-4" />
                    <div class="flex-1 min-w-0">
                        <div class="font-medium truncate">
                            My Canvas
                        </div>
                        <div class="text-xs text-muted-foreground">Your canvas</div>
                    </div>
                    <Show when={!props.activeCanvasId}>
                        <Icon name="check" class="h-4 w-4 text-primary" />
                    </Show>
                </DropdownMenuItem>

                {/* Shared canvases */}
                <Show when={sharedCanvases.data() && sharedCanvases.data()!.length > 0}>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel class="text-xs text-muted-foreground">
                        Shared with me
                    </DropdownMenuLabel>
                    <For each={sharedCanvases.data()}>
                        {(canvas: any) => (
                            <DropdownMenuItem
                                class="flex items-center gap-2 cursor-pointer"
                                onClick={() => props.onCanvasChange(canvas._id)}
                            >
                                <Icon name="users" class="h-4 w-4" />
                                <div class="flex-1 min-w-0">
                                    <div class="font-medium truncate">{canvas.name}</div>
                                    <div class="text-xs text-muted-foreground">
                                        Owner: {canvas.sharedBy}
                                    </div>
                                </div>
                                <Show when={props.activeCanvasId === canvas._id}>
                                    <Icon name="check" class="h-4 w-4 text-primary" />
                                </Show>
                            </DropdownMenuItem>
                        )}
                    </For>
                </Show>

                <Show when={!sharedCanvases.data() || sharedCanvases.data()!.length === 0}>
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
