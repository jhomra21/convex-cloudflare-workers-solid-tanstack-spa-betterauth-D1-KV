import { Show } from 'solid-js';
import { CanvasSelector } from '~/components/CanvasSelector';
import { ShareCanvasDialog } from '~/components/ShareCanvasDialog';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { cn } from '~/lib/utils';

export interface CanvasControlsProps {
    activeCanvasId: string | null;
    onCanvasChange: (canvasId: string | null) => void;
    currentCanvas: any;
    userId: string | null;
}

export function CanvasControls(props: CanvasControlsProps) {
    return (
        <div class="flex items-center gap-2">
            <div class="text-xs text-muted-foreground">Canvas</div>
            <CanvasSelector
                activeCanvasId={props.activeCanvasId}
                onCanvasChange={props.onCanvasChange}
                currentCanvasName={props.currentCanvas?.name}
            />
            <ShareCanvasDialog
                canvasId={props.currentCanvas?._id}
                canvasName={props.currentCanvas?.name}
                currentShareId={props.currentCanvas?.shareId}
                isShareable={!props.activeCanvasId && !!props.currentCanvas?.isShareable}
                canvasOwnerId={props.currentCanvas?.userId}
                currentUserId={props.userId || undefined}
            >
                <Button
                    size="sm"
                    variant={(!!props.activeCanvasId || (!props.activeCanvasId && !!props.currentCanvas?.isShareable)) ? "default" : "outline"}
                    class={cn(
                        "flex items-center gap-2",
                        (!!props.activeCanvasId || (!props.activeCanvasId && !!props.currentCanvas?.isShareable)) && "bg-blue-600 hover:bg-blue-700 border-blue-600"
                    )}
                >
                    <Icon name={(!!props.activeCanvasId || (!props.activeCanvasId && !!props.currentCanvas?.isShareable)) ? "users" : "share"} class="h-4 w-4" />
                    {
                        !!props.activeCanvasId ? "Shared" : // Collaborator on shared canvas
                            (!props.activeCanvasId && !!props.currentCanvas?.isShareable) ? "Sharing" : // Owner sharing their canvas
                                "Share" // Not shared
                    }
                </Button>
            </ShareCanvasDialog>
        </div>
    );
}