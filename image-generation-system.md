# Image Generation System with Workers AI, R2, and Convex

## Architecture Overview

### Components:
- **Hono API Endpoint**: Handles image generation requests with Workers AI and R2 storage
- **Workers AI**: Generates AI images from text prompts  
- **R2 Storage**: Stores the generated images
- **Convex Database**: Stores image references and metadata linked to users (schema already exists)
- **Better Auth**: Authentication middleware for secure access (already configured)

### Data Flow:
1. User submits an image generation request with a text prompt
2. Hono API authenticates the user using existing Better Auth middleware
3. Workers AI generates the image from the prompt
4. The image is stored in R2 bucket with a unique ID
5. **Hono API directly saves image reference and metadata to Convex** (more efficient)
6. Client uses existing custom Convex integration for real-time image queries and listings
7. R2 serves the actual image files through public URLs

## Implementation Details

### 1. R2 Bucket Configuration

Create an R2 bucket using Wrangler CLI:
```bash
wrangler r2 bucket create ai-generated-images
```

Update `wrangler.jsonc` to include R2 bucket and AI bindings:
```jsonc
{
  // existing config...
  "r2_buckets": [
    {
      "binding": "IMAGES_BUCKET",
      "bucket_name": "ai-generated-images"
    }
  ],
  "ai": {
    "binding": "AI"
  }
}
```

### 2. Convex Schema

✅ **Already configured** - The `images` table exists in `convex/schema.ts`:

```typescript
// convex/schema.ts (existing)
export default defineSchema({
  images: defineTable({
    imageUrl: v.string(),
    model: v.optional(v.string()),
    prompt: v.string(),
    seed: v.optional(v.number()),
    steps: v.optional(v.number()),
    userId: v.string(),
  }).index("by_userId", ["userId"]),
  tasks: defineTable({
    // existing tasks table
  })
});
```

### 3. Convex Functions for Images

Create `convex/images.ts`:

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getImages = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("images")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const addImage = mutation({
  args: {
    imageUrl: v.string(),
    model: v.optional(v.string()),
    prompt: v.string(),
    seed: v.optional(v.number()),
    steps: v.optional(v.number()),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("images", {
      imageUrl: args.imageUrl,
      model: args.model,
      prompt: args.prompt,
      seed: args.seed,
      steps: args.steps,
      userId: args.userId,
    });
  },
});

export const deleteImage = mutation({
  args: {
    imageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.imageId);
    // Note: This doesn't delete the actual file from R2
    // That would require a separate API call
  },
});
```

### 4. Hono API for Image Generation and Retrieval

Create `api/images.ts` with direct Convex integration:

```typescript
import { Hono } from 'hono';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import type { Env, HonoVariables } from './types';

const imagesApi = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// Generate and store an image
imagesApi.post('/', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const data = await c.req.json();
    const { prompt, model = "@cf/stabilityai/stable-diffusion-xl-base-1.0", steps = 20, seed } = data;

    if (!prompt) {
      return c.json({ error: 'Prompt is required' }, 400);
    }

    // Generate image using Workers AI
    const result = await c.env.AI.run(model, {
      prompt,
      num_steps: steps,
      seed: seed || Math.floor(Math.random() * 4294967295),
    });

    if (!result || !result.images || !result.images.length) {
      return c.json({ error: 'Failed to generate image' }, 500);
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(result.images[0], 'base64');
    
    // Create unique filename
    const filename = `${user.id}-${Date.now()}.png`;
    
    // Store in R2
    await c.env.IMAGES_BUCKET.put(filename, imageBuffer, {
      httpMetadata: {
        contentType: 'image/png',
      },
    });

    // Create a public URL
    const imageUrl = `https://${c.req.headers.get('host')}/api/images/${filename}`;

    // Save directly to Convex from Hono API (more efficient)
    const convex = new ConvexHttpClient(c.env.CONVEX_URL);
    await convex.mutation(api.images.addImage, {
      imageUrl,
      prompt,
      model,
      seed: result.seed,
      steps,
      userId: user.id,
    });

    return c.json({
      success: true,
      image: {
        url: imageUrl,
        prompt,
        model,
        steps,
        seed: result.seed,
      }
    });
  } catch (error) {
    console.error('Error generating image:', error);
    return c.json({ error: 'Failed to generate image' }, 500);
  }
});

// Get an image by filename (R2 object)
imagesApi.get('/:filename', async (c) => {
  const filename = c.req.param('filename');
  try {
    const object = await c.env.IMAGES_BUCKET.get(filename);
    
    if (!object) {
      return c.json({ error: 'Image not found' }, 404);
    }
    
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    
    return new Response(object.body, {
      headers,
    });
  } catch (error) {
    console.error('Error retrieving image:', error);
    return c.json({ error: 'Failed to retrieve image' }, 500);
  }
});

export default imagesApi;
```

Update `api/index.ts` to include the images API (following existing pattern):

```typescript
// In api/index.ts (update existing file)
import imagesApi from './images';

// After line 58 (after notes API mount)
app.route('/api/images', imagesApi);
```

### 5. Client-Side Integration

Create `src/lib/images-actions.ts` for client-side image operations (using existing patterns):

```typescript
import { createMutation } from '@tanstack/solid-query';
import { convexApi, convexClient, useQuery } from './convex';
import { useRouteContext } from '@tanstack/solid-router';
import { createMemo } from 'solid-js';

interface GenerateImageOptions {
  prompt: string;
  model?: string;
  steps?: number;
  seed?: number;
}

export function useGenerateImage() {
  return createMutation({
    mutationFn: async (options: GenerateImageOptions) => {
      // Single API call - Hono handles both R2 storage AND Convex saving
      const response = await fetch('/api/images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate image');
      }

      return await response.json();
    },
  });
}

// This function gets images directly from Convex, not through the Hono API
export function useUserImages() {
  const context = useRouteContext({ from: '/dashboard' });
  const userId = createMemo(() => context()?.session?.user?.id as string);
  
  // Use existing custom Convex integration for real-time queries
  return useQuery(
    convexApi.images.getImages,
    () => userId() ? { userId: userId()! } : { userId: "" }
  );
}

export function useDeleteImage() {
  return createMutation({
    mutationFn: async (imageId: string) => {
      return await convexClient.mutation(convexApi.images.deleteImage, { 
        imageId 
      });
    },
  });
}
```

### 6. UI Components

Create `src/components/ImageGenerator.tsx`:

```typescript
import { createSignal, Show } from 'solid-js';
import { useGenerateImage } from '~/lib/images-actions';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Icon } from '~/components/ui/icon';
import { toast } from 'solid-sonner';

export function ImageGenerator() {
  const [prompt, setPrompt] = createSignal('');
  const [isAdvancedOpen, setIsAdvancedOpen] = createSignal(false);
  const [model, setModel] = createSignal('@cf/stabilityai/stable-diffusion-xl-base-1.0');
  const [steps, setSteps] = createSignal(20);
  const [seed, setSeed] = createSignal<number | undefined>(undefined);
  const [generatedImage, setGeneratedImage] = createSignal<string | null>(null);
  
  const generateImage = useGenerateImage();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    if (!prompt()) {
      toast.error('Please enter a prompt');
      return;
    }
    
    try {
      const result = await generateImage.mutateAsync({
        prompt: prompt(),
        model: model(),
        steps: steps(),
        seed: seed(),
      });
      
      setGeneratedImage(result.image.url);
      toast.success('Image generated successfully!');
    } catch (error) {
      toast.error('Failed to generate image');
      console.error(error);
    }
  };

  const toggleAdvanced = () => setIsAdvancedOpen(!isAdvancedOpen());
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate an Image</CardTitle>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} class="space-y-4">
          <div class="space-y-2">
            <label for="prompt" class="text-sm font-medium">
              Prompt
            </label>
            <Input
              id="prompt"
              placeholder="A serene lakeside cabin at sunset with mountains in the background"
              value={prompt()}
              onInput={(e) => setPrompt(e.currentTarget.value)}
              required
            />
          </div>
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleAdvanced}
            class="flex items-center gap-1"
          >
            <Icon name={isAdvancedOpen() ? 'chevron-down' : 'chevron-right'} class="h-4 w-4" />
            <span>Advanced Options</span>
          </Button>
          
          <Show when={isAdvancedOpen()}>
            <div class="space-y-4 rounded-md border p-4">
              <div class="space-y-2">
                <label for="model" class="text-sm font-medium">
                  Model
                </label>
                <select
                  id="model"
                  class="w-full rounded-md border px-3 py-2"
                  value={model()}
                  onChange={(e) => setModel(e.currentTarget.value)}
                >
                  <option value="@cf/stabilityai/stable-diffusion-xl-base-1.0">Stable Diffusion XL</option>
                  <option value="@cf/lykon/dreamshaper-8-lcm">DreamShaper 8 LCM</option>
                </select>
              </div>
              
              <div class="space-y-2">
                <label for="steps" class="text-sm font-medium">
                  Steps
                </label>
                <Input
                  id="steps"
                  type="number"
                  min={10}
                  max={50}
                  value={steps()}
                  onInput={(e) => setSteps(parseInt(e.currentTarget.value, 10))}
                />
              </div>
              
              <div class="space-y-2">
                <label for="seed" class="text-sm font-medium">
                  Seed (optional)
                </label>
                <Input
                  id="seed"
                  type="number"
                  min={0}
                  placeholder="Random seed"
                  value={seed() === undefined ? '' : seed()}
                  onInput={(e) => {
                    const value = e.currentTarget.value;
                    setSeed(value ? parseInt(value, 10) : undefined);
                  }}
                />
              </div>
            </div>
          </Show>
          
          <Button
            type="submit"
            class="w-full"
            disabled={generateImage.isPending}
          >
            {generateImage.isPending ? (
              <>
                <Icon name="loader-2" class="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Icon name="wand-2" class="mr-2 h-4 w-4" />
                Generate Image
              </>
            )}
          </Button>
        </form>
        
        <Show when={generatedImage()}>
          <div class="mt-6">
            <h3 class="text-lg font-medium mb-2">Generated Image</h3>
            <div class="rounded-md overflow-hidden border">
              <img
                src={generatedImage()!}
                alt="Generated from prompt"
                class="w-full h-auto object-cover"
              />
            </div>
          </div>
        </Show>
      </CardContent>
    </Card>
  );
}
```

Create `src/components/ImageCard.tsx`:

```typescript
import { Card, CardContent, CardFooter } from '~/components/ui/card';
import { Icon } from '~/components/ui/icon';
import { Button } from '~/components/ui/button';
import { useDeleteImage } from '~/lib/images-actions';
import { toast } from 'solid-sonner';
import type { Doc } from '../../convex/_generated/dataModel';

export interface ImageCardProps {
  image: Doc<"images">;
}

export function ImageCard(props: ImageCardProps) {
  const deleteImage = useDeleteImage();

  const handleDelete = async () => {
    try {
      await deleteImage.mutateAsync(props.image._id);
      toast.success("Image deleted");
    } catch (error) {
      toast.error("Failed to delete image");
    }
  };

  const formattedDate = props.image._creationTime 
    ? new Date(props.image._creationTime).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <Card class="overflow-hidden">
      <div class="aspect-square relative group">
        <img 
          src={props.image.imageUrl} 
          alt={props.image.prompt}
          class="w-full h-full object-cover"
          loading="lazy"
        />
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <Button 
            variant="outline" 
            size="icon"
            class="bg-white text-red-500 hover:bg-red-500 hover:text-white"
            onClick={handleDelete}
            disabled={deleteImage.isPending}
          >
            <Icon name={deleteImage.isPending ? "loader-2" : "trash-2"} class={`h-4 w-4 ${deleteImage.isPending ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
      <CardContent class="p-4">
        <p class="text-sm line-clamp-2">{props.image.prompt}</p>
      </CardContent>
      {formattedDate && (
        <CardFooter class="px-4 pb-4 pt-0 flex justify-between text-xs text-muted-foreground">
          <span>{formattedDate}</span>
          <span>{props.image.model?.split('/').pop()}</span>
        </CardFooter>
      )}
    </Card>
  );
}
```

### 7. Images Page Component

Create `src/routes/dashboard/images.tsx`:

```typescript
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
            
            <Show when={!imagesQuery.isLoading} fallback={
              <div class="flex justify-center items-center h-64">
                <Icon name="loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            }>
              <Show when={imagesQuery()?.length > 0} fallback={
                <div class="text-center py-16 border rounded-md">
                  <Icon name="image" class="mx-auto h-12 w-12 text-muted-foreground opacity-20 mb-2" />
                  <p class="text-muted-foreground">No images yet. Generate your first image!</p>
                </div>
              }>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <For each={imagesQuery()}>
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
```

### 8. Update Navigation

In `src/components/AppSidebar.tsx`, add the Images page to the `routeMetadata` object:

```typescript
// In src/components/AppSidebar.tsx (line ~22)
const routeMetadata: Partial<Record<keyof FileRoutesByFullPath, { name: string; iconName: IconName; isSidebarItem?: boolean }>> = {
  '/dashboard': { name: 'Home', iconName: 'house', isSidebarItem: true },
  '/dashboard/account': { name: 'Account', iconName: 'user', isSidebarItem: true },
  '/dashboard/notes': { name: 'Notes', iconName: 'file', isSidebarItem: true },
  '/dashboard/tasks': { name: 'Tasks', iconName: 'square-check', isSidebarItem: true },
  '/dashboard/images': { name: 'Images', iconName: 'image', isSidebarItem: true }, // Add this line
};
```

## Development Workflow

1. **Set up R2 bucket and bindings**
   ```bash
   wrangler r2 bucket create ai-generated-images
   ```

2. **Update wrangler.jsonc** with R2 and AI bindings
   - Add to existing config following project conventions

3. **Create Convex functions** for image management
   - Schema already exists, just need functions in `convex/images.ts`

4. **Create Hono API endpoints** for image generation and serving
   - Follow existing API pattern in `api/notes.ts`
   - Use existing auth middleware

5. **Implement client-side integration**
   - Client only calls Hono API for generation (simplified)
   - Use existing Convex integration for real-time image listing
   - Follow existing dashboard route structure
   - Use solid-ui components for consistency

6. **Update navigation**
   - Add to existing `routeMetadata` object in AppSidebar

7. **Testing**
   - Use `bun run test` (project uses Vitest)
   - Test with `bun dev` for local development
   - Verify deployment with `wrangler deploy`

## Summary

This implementation provides a complete image generation system that:

1. Uses Workers AI for generating images from text prompts
2. Stores images in R2 for efficient binary storage  
3. **Hono API handles both R2 storage AND Convex saving in one request**
4. Client uses single API call for generation, direct Convex queries for listings
5. Provides real-time image updates via existing Convex integration
6. Provides a clean, user-friendly UI for generating and managing images

The system follows project best practices by:
- Using existing auth middleware and patterns
- Following established file naming conventions (kebab-case)
- Using the custom Convex integration for real-time queries
- Using solid-ui components for consistency
- Following TypeScript strict mode with explicit types
- Using existing package manager (Bun) and build tools
``` 