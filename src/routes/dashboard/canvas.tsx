import { createFileRoute, useSearch } from "@tanstack/solid-router";
import { ImageCanvas } from "~/components/ImageCanvas";
import { createSignal, createEffect } from "solid-js";
import { convexApi, useMutation } from "~/lib/convex";
import { useCurrentUser, useCurrentUserId } from "~/lib/auth-actions";
import { toast } from 'solid-sonner';
import { CanvasSelector } from '~/components/CanvasSelector';
import { storeShareIntent, getAndClearShareIntent } from '~/lib/share-intent';

export const Route = createFileRoute('/dashboard/canvas')({
    component: ImagesPage,
    validateSearch: (search: Record<string, unknown>) => {
        return {
            share: (search.share as string) || undefined,
        } as { share?: string };
    },
});

function ImagesPage() {
    const currentUser = useCurrentUser();
    const userId = useCurrentUserId();
    const search = useSearch({ from: '/dashboard/canvas' });

    // Mutation hooks
    const joinSharedCanvasMutation = useMutation();

    // Track active canvas ID (null = default canvas, string = specific canvas)
    const [activeCanvasId, setActiveCanvasId] = createSignal<string | null>(null);

    // Track processed shares to prevent infinite loops
    const [processedShareIds, setProcessedShareIds] = createSignal<Set<string>>(new Set());

    // Handle share parameter and share intents
    createEffect(() => {
        const shareId = search().share;

        if (shareId) {
            // Check if we already processed this share ID
            if (processedShareIds().has(shareId)) {
                return;
            }

            // Store share intent immediately for persistence across auth
            storeShareIntent(shareId);

            if (userId()) {
                setProcessedShareIds(prev => new Set([...prev, shareId]));
                handleJoinSharedCanvas(shareId as string);
            }
        } else {
            // Check for pending share intent from previous auth flow
            const pendingShareId = getAndClearShareIntent();
            if (pendingShareId && userId()) {
                setProcessedShareIds(prev => new Set([...prev, pendingShareId]));
                handleJoinSharedCanvas(pendingShareId);
                // Update URL to show the share (this will trigger effect again, but we'll skip it)
                window.history.replaceState({}, '', '/dashboard/canvas?share=' + pendingShareId);
            }
        }
    });

    const handleJoinSharedCanvas = async (shareId: string) => {
    try {
    const user = currentUser();
    const userName = user?.name || `User-${userId()?.slice(-4).toUpperCase()}`;
    
    const canvasId = await joinSharedCanvasMutation.mutate(convexApi.canvas.joinSharedCanvas, {
      shareId,
      userId: userId()!,
    userName,
    });
    
    if (canvasId) {
    // Set the active canvas to the shared canvas
      setActiveCanvasId(canvasId);
    toast.success('Successfully joined shared canvas!');
      // Remove share parameter from URL
        window.history.replaceState({}, '', '/dashboard/canvas');
    } else {
      toast.error('Canvas not found or no longer shareable');
      }
      } catch (error) {
      console.error('Failed to join canvas:', error);
      toast.error('Failed to join shared canvas');
    }
  };

    return (
        <div class="h-full flex flex-col">
            {/* Header */}
            <div class="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div class="w-full !px-0 pb-4">
                    <div class="flex flex-col lg:flex-row lg:justify-between gap-4">
                        <div class="flex flex-col sm:flex-row gap-4">
                            <div class="flex-1 min-w-0">
                                <h1 class="text-xl sm:text-2xl font-semibold mb-1">Gen-AI Canvas</h1>
                                <p class="text-muted-foreground text-sm">
                                    Create and organize AI-generated media with intelligent agents
                                </p>
                            </div>

                            <div class="flex-shrink-0 sm:border-l sm:pl-4 sm:ml-4">
                                <div class="text-xs text-muted-foreground mb-1">Canvas</div>
                                <CanvasSelector
                                    activeCanvasId={activeCanvasId()}
                                    onCanvasChange={setActiveCanvasId}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div class="flex-1 overflow-hidden">
                <ImageCanvas
                    class="h-full"
                    activeCanvasId={activeCanvasId()}
                    onCanvasDisabled={() => setActiveCanvasId(null)}
                />
            </div>
        </div>
    );
}
