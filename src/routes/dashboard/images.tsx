import { createFileRoute } from "@tanstack/solid-router";
import { ImageCanvas } from "~/components/ImageCanvas";
import { ImageCard } from "~/components/ImageCard";
import { useUserImages } from "~/lib/images-actions";
import { Show, For, createSignal } from "solid-js";
import { Icon } from "~/components/ui/icon";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

export const Route = createFileRoute('/dashboard/images')({
  component: ImagesPage,
});

function ImagesPage() {
  const imagesQuery = useUserImages();
  const [activeTab, setActiveTab] = createSignal("canvas");
  
  return (
    <div class="h-full flex flex-col">
      {/* Header */}
      <div class="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div class="container mx-auto max-w-7xl px-4 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-semibold mb-1">AI Image Studio</h1>
              <p class="text-muted-foreground text-sm">
                Create and organize AI-generated images with intelligent agents
              </p>
            </div>
            
            <Tabs value={activeTab()} onChange={setActiveTab}>
              <TabsList class="grid w-full grid-cols-2">
                <TabsTrigger value="canvas" class="flex items-center gap-2">
                  <Icon name="layout-grid" class="h-4 w-4" />
                  Canvas
                </TabsTrigger>
                <TabsTrigger value="history" class="flex items-center gap-2">
                  <Icon name="clock" class="h-4 w-4" />
                  History
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-hidden">
        <Tabs value={activeTab()} class="h-full flex flex-col">
          <TabsContent value="canvas" class="flex-1 m-0 p-0">
            <ImageCanvas class="h-full" />
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
                
                <Show when={imagesQuery()} fallback={
                  <div class="flex justify-center items-center h-64">
                    <Icon name="loader" class="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                }>
                  <Show when={imagesQuery()?.length && imagesQuery()!.length > 0} fallback={
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
                      <For each={imagesQuery() || []}>
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
