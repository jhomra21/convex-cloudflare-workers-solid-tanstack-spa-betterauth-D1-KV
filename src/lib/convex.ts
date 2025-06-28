import { ConvexClient } from "convex/browser";
import { createStore, reconcile } from "solid-js/store";
import { createEffect, onCleanup, createSignal } from "solid-js";
import { api } from "../../convex/_generated/api";
import type {
  FunctionReference,
  FunctionReturnType,
  FunctionArgs,
} from "convex/server";

const convex = new ConvexClient(import.meta.env.VITE_CONVEX_URL as string);

type Store<T> = {
  value: T | undefined;
};

// A type-safe useQuery hook for Convex
export function useQuery<
  Query extends FunctionReference<"query", "public", any, any>,
>(
  query: Query,
  // Wrap args in a function to make them reactive for SolidJS - can return null to skip query
  args: () => FunctionArgs<Query> | null | undefined,
) {
  const [data, setData] = createStore<Store<FunctionReturnType<Query>>>({
    value: undefined,
  });
  const [error, setError] = createSignal<Error | null>(null);

  createEffect(() => {
    const currentArgs = args();
    
    // Skip subscription if args are invalid/null
    if (currentArgs === null || currentArgs === undefined) {
      setData("value", reconcile(undefined));
      setError(null);
      return;
    }

    try {
      const unsubscribe = convex.onUpdate(
        query as any,
        currentArgs as any,
        (newData: any) => {
          setData("value", reconcile(newData));
          setError(null);
        },
      );
      onCleanup(() => unsubscribe());
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    }
  });

  return {
    data: () => data.value,
    error,
    isLoading: () => data.value === undefined && error() === null,
    reset: () => {
      setData("value", reconcile(undefined));
      setError(null);
    },
  };
}

// A type-safe useMutation hook for Convex mutations
export function useMutation<
  Mutation extends FunctionReference<"mutation", "public", any, any>,
>() {
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<Error | null>(null);

  const mutate = async (
    mutation: Mutation,
    args: FunctionArgs<Mutation>,
  ): Promise<FunctionReturnType<Mutation>> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await convex.mutation(mutation as any, args as any);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    mutate,
    isLoading,
    error,
    reset: () => {
      setError(null);
      setIsLoading(false);
    },
  };
}

// A type-safe useAction hook for Convex actions
export function useAction<
  Action extends FunctionReference<"action", "public", any, any>,
>() {
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<Error | null>(null);

  const execute = async (
    action: Action,
    args: FunctionArgs<Action>,
  ): Promise<FunctionReturnType<Action>> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await convex.action(action as any, args as any);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    execute,
    isLoading,
    error,
    reset: () => {
      setError(null);
      setIsLoading(false);
    },
  };
}

export const convexClient = convex;
export const convexApi = api; 