import { createFileRoute, useSearch } from "@tanstack/solid-router";
import { ImageCanvas } from "~/components/ImageCanvas";
import { ImageCard } from "~/components/ImageCard";
import { Show, For, createSignal, createEffect } from "solid-js";
import { Icon } from "~/components/ui/icon";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { convexApi, useQuery, useMutation } from "~/lib/convex";
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
    const imagesQuery = useQuery(
        convexApi.images.getImages,
        () => userId() ? { userId: userId()! } : null
    );

    const [activeTab, setActiveTab] = createSignal("canvas");
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
                <div class="container py-4">
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

                        <div class="flex-shrink-0">
                            <Tabs value={activeTab()} onChange={setActiveTab}>
                                <TabsList class="grid w-full grid-cols-2">
                                    <TabsTrigger value="canvas" class="flex items-center gap-2">
                                        <Icon name="layout-grid" class="h-4 w-4" />
                                        <span class="hidden sm:inline">Canvas</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="history" class="flex items-center gap-2">
                                        <Icon name="clock" class="h-4 w-4" />
                                        <span class="hidden sm:inline">History</span>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div class="flex-1 overflow-hidden">
                <Tabs value={activeTab()} class="h-full flex flex-col">
                    <TabsContent value="canvas" class="flex-1 m-0 p-0">
                        <ImageCanvas
                            class="h-full"
                            activeCanvasId={activeCanvasId()}
                            onCanvasDisabled={() => setActiveCanvasId(null)}
                        />
                    </TabsContent>

                    <TabsContent value="history" class="h-full m-0 p-4">
                        <div class="container mx-auto max-w-6xl h-full">
                            <div class="h-full overflow-auto">
                                <div class="mb-6">
                                    <h2 class="text-xl font-semibold mb-2">Your Generated Images</h2>
                                    <p class="text-muted-foreground text-sm">
                                        Browse and manage your previously generated images
                                    </p>
                                </div>

                                {/* Loading State */}
                                <Show when={imagesQuery.isLoading()}>
                                    <div class="flex justify-center items-center h-64">
                                        <Icon name="loader" class="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                                </Show>

                                {/* Error State */}
                                <Show when={imagesQuery.error()}>
                                    <div class="text-center py-8 text-red-500">
                                        <Icon name="x" class="mx-auto h-12 w-12 opacity-20 mb-2" />
                                        <p class="mb-4">Failed to load images: {imagesQuery.error()?.message}</p>
                                        <Button onClick={() => imagesQuery.reset()} variant="outline">
                                            <Icon name="refresh-cw" class="mr-2 h-4 w-4" />
                                            Retry
                                        </Button>
                                    </div>
                                </Show>

                                {/* Images Content */}
                                <Show when={!imagesQuery.isLoading() && !imagesQuery.error()}>
                                    <Show when={imagesQuery.data()?.length && imagesQuery.data()!.length > 0} fallback={
                                        <div class="text-center py-16 border rounded-md">
                                            <Icon name="image" class="mx-auto h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                                            <h3 class="text-lg font-medium text-muted-foreground mb-2">No images yet</h3>
                                            <p class="text-muted-foreground text-sm mb-4">
                                                Generate your first image using the Canvas tab
                                            </p>
                                            <Button onClick={() => setActiveTab("canvas")} size="sm">
                                                <Icon name="layout-grid" class="h-4 w-4 mr-2" />
                                                Go to Canvas
                                            </Button>
                                        </div>
                                    }>
                                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                            <For each={imagesQuery.data() || []}>
                                                {(image) => (
                                                    <ImageCard image={image} />
                                                )}
                                            </For>
                                        </div>
                                    </Show>
                                </Show>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
