import { useMutation, useQueryClient } from '@tanstack/solid-query';
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
  const queryClient = useQueryClient();
  
  return useMutation(() => ({
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
    onSuccess: () => {
      // Since we're using Convex real-time queries, the UI will auto-update
      // But we can still invalidate to be safe
      queryClient.invalidateQueries({ queryKey: ['images'] });
    },
  }));
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
  const queryClient = useQueryClient();
  
  return useMutation(() => ({
    mutationFn: async (imageId: string) => {
      return await convexClient.mutation(convexApi.images.deleteImage, { 
        imageId: imageId as any
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
    },
  }));
}
