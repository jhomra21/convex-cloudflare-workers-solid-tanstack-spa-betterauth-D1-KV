import { useMutation, useQueryClient } from '@tanstack/solid-query';
import { convexApi, useConvexQuery } from './convex';
import { useCurrentUserId } from './auth-actions';

interface GenerateImageOptions {
  prompt: string;
  model?: string;
  steps?: number;
  seed?: number;
  agentId?: string;
}

interface EditImageOptions {
  prompt: string;
  inputImageUrl: string;
  model?: string;
  steps?: number;
  agentId?: string;
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

export function useEditImage() {
  const queryClient = useQueryClient();
  
  return useMutation(() => ({
    mutationFn: async (options: EditImageOptions) => {
      // Single API call - Hono handles editing with FAL AI
      const response = await fetch('/api/images/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to edit image');
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

export function useDeleteImage() {
  const queryClient = useQueryClient();
  
  return useMutation(() => ({
    mutationFn: async (imageId: string) => {
      // Call Hono API to delete from both R2 and Convex
      const response = await fetch(`/api/images/${imageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete image');
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
