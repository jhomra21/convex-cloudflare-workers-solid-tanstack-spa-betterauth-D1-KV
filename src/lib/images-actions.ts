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
      // Helper function to make the API call
      const makeRequest = async (): Promise<any> => {
        const response = await fetch('/api/images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(options),
        });

        if (!response.ok) {
          const error = await response.json();
          throw { 
            message: error.error || 'Failed to generate image',
            details: error.details,
            type: error.type,
            status: response.status
          };
        }

        return await response.json();
      };

      // First attempt
      try {
        return await makeRequest();
      } catch (error: any) {
        // Only retry for Workers AI capacity errors on "normal" model
        const isWorkersAICapacityError = 
          error.type === 'InferenceUpstreamError' && 
          error.details?.includes('Capacity temporarily exceeded') &&
          (!options.model || options.model === '@cf/black-forest-labs/flux-1-schnell');

        if (isWorkersAICapacityError) {
          console.log('🔄 Workers AI capacity exceeded for model:', options.model || '@cf/black-forest-labs/flux-1-schnell');
          console.log('🔄 Error details:', error.details);
          console.log('🔄 Retrying once...');
          
          // Import toast dynamically to avoid circular dependencies
          const { toast } = await import('solid-sonner');
          toast.info('Workers AI busy, retrying in 2 seconds...', {
            duration: 2000,
          });
          
          // Wait 2 seconds before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          try {
            const result = await makeRequest();
            console.log('✅ Retry successful!');
            toast.success('Retry successful!', { duration: 2000 });
            return result;
          } catch (retryError: any) {
            console.log('❌ Retry failed with error:', retryError);
            toast.error('Retry failed - Workers AI still busy');
            // Throw the retry error if it failed again
            throw new Error(retryError.message || 'Failed to generate image after retry');
          }
        }

        // For all other errors, throw immediately with better messaging
        if (error.type === 'InferenceUpstreamError' && error.details?.includes('Capacity temporarily exceeded')) {
          throw new Error('Workers AI is currently busy. Try again in a few moments or switch to Pro model.');
        }
        
        throw new Error(error.message || 'Failed to generate image');
      }
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
