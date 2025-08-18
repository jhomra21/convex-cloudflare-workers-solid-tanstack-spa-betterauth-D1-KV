import { useMutation, useQueryClient } from '@tanstack/solid-query';

type FeedbackSubmission = {
  type: 'bug' | 'feedback';
  message: string;
};

type FeedbackResponse = {
  success: boolean;
  feedback?: {
    id: string;
    type: string;
    message: string;
    status: string;
    createdAt: string;
  };
  error?: string;
};

import { useQuery } from '@tanstack/solid-query';

type FeedbackEntry = {
  id: string;
  type: 'bug' | 'feedback';
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  updatedAt: string;
  userName?: string;
  userEmail?: string;
};

type AllFeedbackResponse = {
  success: boolean;
  feedback: FeedbackEntry[];
  error?: string;
};

/**
 * Submit feedback mutation hook
 */
export function useSubmitFeedbackMutation() {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (feedback: FeedbackSubmission): Promise<FeedbackResponse> => {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedback),
        credentials: 'include', // Include cookies for authentication
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch all feedback queries
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
  }));
}

/**
 * Fetch all feedback query hook
 */
export function useAllFeedbackQuery() {
  return useQuery(() => ({
    queryKey: ['feedback', 'all'],
    queryFn: async (): Promise<AllFeedbackResponse> => {
      const response = await fetch('/api/feedback/all', {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  }));
}

/**
 * Check if current user is admin (non-blocking)
 */
export function useAdminCheckQuery() {
  return useQuery(() => ({
    queryKey: ['admin-check'],
    queryFn: async (): Promise<{ isAdmin: boolean }> => {
      const response = await fetch('/api/feedback/admin-check', {
        credentials: 'include',
      });

      if (!response.ok) {
        // Don't throw error, just return false for admin status
        return { isAdmin: false };
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
    retry: false, // Don't retry admin check failures
  }));
}

/**
 * Update feedback status mutation (admin only)
 */
export function useUpdateFeedbackStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/feedback/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch feedback queries
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
  }));
}

/**
 * Delete feedback mutation (admin only)
 */
export function useDeleteFeedbackMutation() {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/feedback/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch feedback queries
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
  }));
}