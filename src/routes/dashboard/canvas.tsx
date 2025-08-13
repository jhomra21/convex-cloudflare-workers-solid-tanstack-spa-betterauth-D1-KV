import { createFileRoute, useSearch } from "@tanstack/solid-router";
import { ImageCanvas } from "~/components/ImageCanvas";
import { createEffect, batch, createSignal } from "solid-js";
import { convexApi, useConvexMutation, useConvexQuery } from "~/lib/convex";
import { useCurrentUserId, useCurrentUserName } from "~/lib/auth-actions";
import { toast } from 'solid-sonner';
import { storeShareIntent, getAndClearShareIntent } from '~/lib/share-intent';
import { activeCanvasId, setActiveCanvasId, currentCanvas, setCurrentCanvas } from '~/lib/canvas-store';

export const Route = createFileRoute('/dashboard/canvas')({
    component: ImagesPage,
    validateSearch: (search: Record<string, unknown>) => {
        return {
            share: (search.share as string) || undefined,
        } as { share?: string };
    },
});

function ImagesPage() {
    const currentUserName = useCurrentUserName();
    const userId = useCurrentUserId();
    const search = useSearch({ from: '/dashboard/canvas' });

    // Mutation hooks
    const joinSharedCanvasMutation = useConvexMutation(convexApi.canvas.joinSharedCanvas);

    // Canvas data for share functionality
    const defaultCanvas = useConvexQuery(
        convexApi.canvas.getCanvas,
        () => (!activeCanvasId() && userId()) ? { userId: userId()! } : null,
        () => ['canvas', 'default', userId()]
    );

    const specificCanvas = useConvexQuery(
        convexApi.canvas.getCanvasById,
        () => (activeCanvasId() && userId()) ? { canvasId: activeCanvasId() as any, userId: userId()! } : null,
        () => ['canvas', 'specific', activeCanvasId(), userId()]
    );

    // Update the shared store with current canvas data
    createEffect(() => {
        const canvas = activeCanvasId() ? specificCanvas.data : defaultCanvas.data;
        setCurrentCanvas(canvas);
    });

    // Track the last processed share ID to prevent duplicate processing
    const [lastProcessedShareId, setLastProcessedShareId] = createSignal<string | null>(null);
    const [hasCheckedPendingShare, setHasCheckedPendingShare] = createSignal(false);

    // Handle URL share parameter
    createEffect(() => {
        const shareId = search().share;
        const currentUserId = userId();
        const lastProcessed = lastProcessedShareId();

        // Guard: Only process if we have a share ID, user is authenticated, and we haven't processed this share yet
        if (!shareId || !currentUserId || lastProcessed === shareId) {
            return;
        }

        // Store share intent for persistence across auth flows
        storeShareIntent(shareId);

        // Use batch to group state updates and prevent cascading effects
        batch(() => {
            setLastProcessedShareId(shareId);
        });

        // Handle the share asynchronously to avoid blocking the effect
        queueMicrotask(() => {
            handleJoinSharedCanvas(shareId);
        });
    });

    // Handle pending share intents when user becomes authenticated
    createEffect(() => {
        const currentUserId = userId();
        const hasChecked = hasCheckedPendingShare();

        // Guard: Only check when user becomes authenticated and we haven't checked yet
        if (!currentUserId || hasChecked) {
            return;
        }

        // Check for pending share intent from storage
        const pendingShareId = getAndClearShareIntent();

        // Always mark as checked to prevent re-runs (use batch for state updates)
        batch(() => {
            setHasCheckedPendingShare(true);
        });

        if (pendingShareId) {
            // Only proceed if there's no current share in URL to avoid conflicts
            const currentShareId = search().share;
            if (!currentShareId) {
                batch(() => {
                    setLastProcessedShareId(pendingShareId);
                });

                // Update URL first, then handle the share asynchronously
                window.history.replaceState({}, '', '/dashboard/canvas?share=' + pendingShareId);
                queueMicrotask(() => {
                    handleJoinSharedCanvas(pendingShareId);
                });
            }
        }
    });

    const handleJoinSharedCanvas = async (shareId: string) => {
        try {
            const userName = currentUserName();

            const canvasId = await joinSharedCanvasMutation.mutateAsync({
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
        <div class="h-full !p-0">
            <ImageCanvas
                class="h-full"
                activeCanvasId={activeCanvasId()}
                onCanvasDisabled={() => setActiveCanvasId(null)}
            />
        </div>
    );
}
