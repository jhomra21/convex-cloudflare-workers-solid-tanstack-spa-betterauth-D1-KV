import { ConvexClient } from "convex/browser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/solid-query";
import { createEffect, onCleanup } from "solid-js";
import { api } from "../../convex/_generated/api";
import type {
  FunctionReference,
  FunctionReturnType,
  FunctionArgs,
} from "convex/server";

const convex = new ConvexClient(import.meta.env.VITE_CONVEX_URL as string);

// Type-safe Convex query hook using TanStack Query with real-time subscriptions
export function useConvexQuery<
  Query extends FunctionReference<"query", "public", any, any>,
>(
  query: Query,
  args: () => FunctionArgs<Query> | null | undefined,
  queryKey: () => (string | number | boolean | null | undefined)[],
) {
  const queryClient = useQueryClient();

  const tanstackQuery = useQuery(() => ({
    queryKey: ['convex', ...queryKey()],
    queryFn: async () => {
      const currentArgs = args();
      if (currentArgs === null || currentArgs === undefined) {
        throw new Error('Query args are null or undefined');
      }
      return await convex.query(query as any, currentArgs as any);
    },
    enabled: () => {
      const currentArgs = args();
      return currentArgs !== null && currentArgs !== undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - we rely on real-time invalidation
    refetchOnWindowFocus: false, // Rely on real-time updates instead
    refetchOnReconnect: true, // Refetch when connection is restored
  }));

  // Set up Convex real-time subscription to invalidate TanStack Query cache
  createEffect(() => {
    const currentArgs = args();
    const currentQueryKey = queryKey();

    // Guard: Only proceed if we have valid args and query key
    if (currentArgs === null || currentArgs === undefined || !currentQueryKey) {
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let isSubscriptionActive = true;

    try {
      unsubscribe = convex.onUpdate(
        query as any,
        currentArgs as any,
        (newData: any) => {
          // Guard: Only update if subscription is still active
          if (!isSubscriptionActive) return;

          // Update TanStack Query cache with new data from Convex
          queryClient.setQueryData(['convex', ...currentQueryKey], newData);
        },
        (error: Error) => {
          // Guard: Only handle errors if subscription is still active
          if (!isSubscriptionActive) return;

          // Handle subscription errors by invalidating the query
          console.warn('Convex subscription error:', error);
          queryClient.invalidateQueries({ queryKey: ['convex', ...currentQueryKey] });
        }
      );
    } catch (error) {
      console.warn('Failed to set up Convex subscription:', error);
    }

    onCleanup(() => {
      isSubscriptionActive = false;
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('Failed to cleanup Convex subscription:', error);
        }
      }
    });
  });

  return tanstackQuery;
}

// Type-safe Convex mutation hook using TanStack Query
export function useConvexMutation<
  Mutation extends FunctionReference<"mutation", "public", any, any>,
>(
  mutation: Mutation,
  options?: {
    onSuccess?: (data: FunctionReturnType<Mutation>, variables: FunctionArgs<Mutation>) => void;
    onError?: (error: Error, variables: FunctionArgs<Mutation>) => void;
    onMutate?: (variables: FunctionArgs<Mutation>) => Promise<any> | any;
    onSettled?: (data: FunctionReturnType<Mutation> | undefined, error: Error | null, variables: FunctionArgs<Mutation>) => void;
    invalidateQueries?: string[][];
    optimisticUpdate?: (queryClient: any, variables: FunctionArgs<Mutation>) => void;
  }
) {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (args: FunctionArgs<Mutation>) => {
      return await convex.mutation(mutation as any, args as any);
    },
    onMutate: async (variables) => {
      // Apply optimistic update if provided
      if (options?.optimisticUpdate) {
        options.optimisticUpdate(queryClient, variables);
      }

      // Call user's onMutate
      return await options?.onMutate?.(variables);
    },
    onSuccess: (data, variables) => {
      // Auto-invalidate specified query patterns
      if (options?.invalidateQueries) {
        options.invalidateQueries.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey });
        });
      }
      options?.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      // Revert optimistic updates on error by invalidating affected queries
      if (options?.optimisticUpdate && options?.invalidateQueries) {
        options.invalidateQueries.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey });
        });
      }
      options?.onError?.(error, variables);
    },
    onSettled: options?.onSettled,
  }));
}

// Type-safe Convex action hook using TanStack Query
export function useConvexAction<
  Action extends FunctionReference<"action", "public", any, any>,
>(
  action: Action,
  options?: {
    onSuccess?: (data: FunctionReturnType<Action>, variables: FunctionArgs<Action>) => void;
    onError?: (error: Error, variables: FunctionArgs<Action>) => void;
    onMutate?: (variables: FunctionArgs<Action>) => Promise<any> | any;
    onSettled?: (data: FunctionReturnType<Action> | undefined, error: Error | null, variables: FunctionArgs<Action>) => void;
    invalidateQueries?: string[][];
  }
) {
  const queryClient = useQueryClient();

  return useMutation(() => ({
    mutationFn: async (args: FunctionArgs<Action>) => {
      return await convex.action(action as any, args as any);
    },
    onSuccess: (data, variables) => {
      // Auto-invalidate specified query patterns
      if (options?.invalidateQueries) {
        options.invalidateQueries.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey });
        });
      }
      options?.onSuccess?.(data, variables);
    },
    onError: options?.onError,
    onMutate: options?.onMutate,
    onSettled: options?.onSettled,
  }));
}

// Utility function to prefetch Convex queries
export function prefetchConvexQuery<
  Query extends FunctionReference<"query", "public", any, any>,
>(
  queryClient: any,
  query: Query,
  args: FunctionArgs<Query>,
  queryKey: (string | number | boolean | null | undefined)[]
) {
  return queryClient.prefetchQuery({
    queryKey: ['convex', ...queryKey],
    queryFn: () => convex.query(query as any, args as any),
    staleTime: 1000 * 60 * 5,
  });
}

// Utility function to manually invalidate Convex queries
export function invalidateConvexQueries(
  queryClient: any,
  queryKeyPattern: (string | number | boolean | null | undefined)[]
) {
  return queryClient.invalidateQueries({
    queryKey: ['convex', ...queryKeyPattern],
  });
}



// Utility for batch operations
export function useBatchConvexMutations() {
  const queryClient = useQueryClient();

  return {
    batch: async (operations: Array<() => Promise<any>>) => {
      const results = await Promise.allSettled(operations.map(op => op()));

      // Invalidate all Convex queries after batch operations
      queryClient.invalidateQueries({ queryKey: ['convex'] });

      return results;
    }
  };
}

// Direct access to Convex client for advanced use cases
export const convexClient = convex;
export const convexApi = api; 