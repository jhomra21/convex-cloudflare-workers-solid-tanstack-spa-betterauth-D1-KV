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

    // Track the last processed share ID to prevent duplicate processing
    const [lastProcessedShareId, setLastProcessedShareId] = createSignal<string | null>(null);
    const [hasCheckedPendingShare, setHasCheckedPendingShare] = createSignal(false);

    // Handle URL share parameter
    createEffect(() => {
        const shareId = search().share;
        const currentUserId = userId();

        // Guard: Only process if we have a share ID, user is authenticated, and we haven't processed this share yet
        if (!shareId || !currentUserId || lastProcessedShareId() === shareId) {
            return;
        }

        // Store share intent for persistence across auth flows
        storeShareIntent(shareId);

        // Mark as processed and handle the share
        setLastProcessedShareId(shareId);
        handleJoinSharedCanvas(shareId);
    });

    // Handle pending share intents when user becomes authenticated
    createEffect(() => {
        const currentUserId = userId();

        // Guard: Only check when user becomes authenticated and we haven't checked yet
        if (!currentUserId || hasCheckedPendingShare()) {
            return;
        }

        // Check for pending share intent from storage
        const pendingShareId = getAndClearShareIntent();

        // Always mark as checked to prevent re-runs
        setHasCheckedPendingShare(true);

        if (pendingShareId) {
            // Only proceed if there's no current share in URL to avoid conflicts
            const currentShareId = search().share;
            if (!currentShareId) {
                setLastProcessedShareId(pendingShareId);
                // Update URL first, then handle the share
                window.history.replaceState({}, '', '/dashboard/canvas?share=' + pendingShareId);
                handleJoinSharedCanvas(pendingShareId);
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
