import { type JSX, splitProps } from "solid-js";
import type { ValidComponent } from "solid-js";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as TabsPrimitive from "@kobalte/core/tabs";
import { cn } from "~/lib/utils";

const Tabs = TabsPrimitive.Root;

type TabsListProps<T extends ValidComponent = "div"> = TabsPrimitive.TabsListProps<T> & {
  class?: string;
  children?: JSX.Element;
};

const TabsList = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, TabsListProps<T>>
) => {
  const [local, others] = splitProps(props as TabsListProps, ["class", "children"]);
  return (
    <TabsPrimitive.List
      class={cn(
        "inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        local.class
      )}
      {...others}
    >
      {local.children}
    </TabsPrimitive.List>
  );
};

type TabsTriggerProps<T extends ValidComponent = "button"> = TabsPrimitive.TabsTriggerProps<T> & {
  class?: string;
  children?: JSX.Element;
};

const TabsTrigger = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, TabsTriggerProps<T>>
) => {
  const [local, others] = splitProps(props as TabsTriggerProps, ["class", "children"]);
  return (
    <TabsPrimitive.Trigger
      class={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow",
        local.class
      )}
      {...others}
    >
      {local.children}
    </TabsPrimitive.Trigger>
  );
};

type TabsContentProps<T extends ValidComponent = "div"> = TabsPrimitive.TabsContentProps<T> & {
  class?: string;
  children?: JSX.Element;
};

const TabsContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, TabsContentProps<T>>
) => {
  const [local, others] = splitProps(props as TabsContentProps, ["class", "children"]);
  return (
    <TabsPrimitive.Content
      class={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        local.class
      )}
      {...others}
    >
      {local.children}
    </TabsPrimitive.Content>
  );
};

export { Tabs, TabsList, TabsTrigger, TabsContent }; 