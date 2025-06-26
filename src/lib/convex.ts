import { ConvexClient } from "convex/browser";
import { createStore, reconcile } from "solid-js/store";
import { createEffect, onCleanup } from "solid-js";
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
  // Wrap args in a function to make them reactive for SolidJS
  args: () => FunctionArgs<Query>,
) {
  const [data, setData] = createStore<Store<FunctionReturnType<Query>>>({
    value: undefined,
  });

  createEffect(() => {
    // We need to cast here because the `onUpdate` function in the Convex client
    // is not yet fully generic to preserve query function argument types.
    const unsubscribe = convex.onUpdate(
      query as any,
      args() as any,
      (newData: any) => {
        setData("value", reconcile(newData));
      },
    );
    onCleanup(() => unsubscribe());
  });

  return () => data.value;
}

export const convexClient = convex;
export const convexApi = api; 