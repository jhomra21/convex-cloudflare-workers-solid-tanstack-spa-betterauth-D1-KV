import { createFileRoute } from "@tanstack/solid-router";
import { ImageGenerator } from "~/components/ImageGenerator";
import { ImageCard } from "~/components/ImageCard";
import { useUserImages } from "~/lib/images-actions";
import { Show, For } from "solid-js";
import { Icon } from "~/components/ui/icon";

export const Route = createFileRoute('/dashboard/images')({
  component: ImagesPage,
});

function ImagesPage() {
  const imagesQuery = useUserImages();
  
  return (
    <div class="container mx-auto max-w-6xl px-4 py-8">
      <div class="flex flex-col space-y-8">
        {/* Header */}
        <div>
          <h1 class="text-2xl font-semibold mb-1">AI Image Generator</h1>
          <p class="text-muted-foreground text-sm">
            Create AI-generated images from text prompts
          </p>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div class="col-span-1">
            <ImageGenerator />
          </div>
          
          <div class="col-span-1 lg:col-span-2">
            <h2 class="text-xl font-semibold mb-4">Your Images</h2>
            
            <Show when={imagesQuery()} fallback={
              <div class="flex justify-center items-center h-64">
                <Icon name="loader" class="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            }>
              <Show when={imagesQuery()?.length && imagesQuery()!.length > 0} fallback={
                <div class="text-center py-16 border rounded-md">
                  <Icon name="image" class="mx-auto h-12 w-12 text-muted-foreground opacity-20 mb-2" />
                  <p class="text-muted-foreground">No images yet. Generate your first image!</p>
                </div>
              }>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
      </div>
    </div>
  );
}
