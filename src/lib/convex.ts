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
  }));

  // Set up Convex real-time subscription to invalidate TanStack Query cache
  createEffect(() => {
    const currentArgs = args();
    if (currentArgs === null || currentArgs === undefined) {
      return;
    }

    const unsubscribe = convex.onUpdate(
      query as any,
      currentArgs as any,
      (newData: any) => {
        // Update TanStack Query cache with new data from Convex
        queryClient.setQueryData(['convex', ...queryKey()], newData);
      }
    );

    onCleanup(() => unsubscribe());
  });

  return tanstackQuery;
}

// Type-safe Convex mutation hook using TanStack Query
export function useConvexMutation<
  Mutation extends FunctionReference<"mutation", "public", any, any>,
>(
  mutation: Mutation,
  options?: {
    onSuccess?: (data: FunctionReturnType<Mutation>, variables: FunctionArgs<Mutation>, context: any) => void;
    onError?: (error: Error, variables: FunctionArgs<Mutation>, context: any) => void;
    onMutate?: (variables: FunctionArgs<Mutation>) => Promise<any> | any;
    onSettled?: (data: FunctionReturnType<Mutation> | undefined, error: Error | null, variables: FunctionArgs<Mutation>, context: any) => void;
    invalidateQueries?: string[][];
  }
) {
  return useMutation(() => ({
    mutationFn: async (args: FunctionArgs<Mutation>) => {
      return await convex.mutation(mutation as any, args as any);
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
    onMutate: options?.onMutate,
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
  }
) {
  return useMutation(() => ({
    mutationFn: async (args: FunctionArgs<Action>) => {
      return await convex.action(action as any, args as any);
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  }));
}

export const convexClient = convex;
export const convexApi = api; 