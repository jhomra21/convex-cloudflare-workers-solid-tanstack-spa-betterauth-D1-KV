import type { Component, ComponentProps, JSX, ValidComponent } from "solid-js"
import { Show, splitProps } from "solid-js"

import type { PolymorphicProps } from "@kobalte/core"
import * as BreadcrumbPrimitive from "@kobalte/core/breadcrumbs"

import { cn } from "~/lib/utils"

// Updated to include aria-label for accessibility
const Breadcrumb: Component<ComponentProps<"nav"> & { separator?: JSX.Element }> = (props) => {
  const [local, others] = splitProps(props, ["class", "children", "separator"])
  return (
    <BreadcrumbPrimitive.Root 
      as="nav" 
      aria-label="breadcrumb" 
      class={local.class}
      {...others}
    >
      {local.children}
    </BreadcrumbPrimitive.Root>
  )
}

const BreadcrumbList: Component<ComponentProps<"ol">> = (props) => {
  const [local, others] = splitProps(props, ["class"])
  return (
    <ol
      class={cn(
        "flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5",
        local.class
      )}
      {...others}
    />
  )
}

const BreadcrumbItem: Component<ComponentProps<"li">> = (props) => {
  const [local, others] = splitProps(props, ["class"])
  return <li class={cn("inline-flex items-center gap-1.5", local.class)} {...others} />
}

type BreadcrumbLinkProps<T extends ValidComponent = "a"> =
  BreadcrumbPrimitive.BreadcrumbsLinkProps<T> & { class?: string | undefined }

const BreadcrumbLink = <T extends ValidComponent = "a">(
  props: PolymorphicProps<T, BreadcrumbLinkProps<T>>
) => {
  const [local, others] = splitProps(props as BreadcrumbLinkProps, ["class"])
  return (
    <BreadcrumbPrimitive.Link
      class={cn(
        "transition-colors hover:text-foreground data-[current]:font-normal data-[current]:text-foreground",
        local.class
      )}
      {...others}
    />
  )
}

// Added BreadcrumbPage component for current page with proper accessibility attributes
const BreadcrumbPage: Component<ComponentProps<"span">> = (props) => {
  const [local, others] = splitProps(props, ["class"])
  return (
    <span
      role="link"
      aria-disabled="true"
      aria-current="page"
      class={cn("font-normal text-foreground", local.class)}
      {...others}
    />
  )
}

type BreadcrumbSeparatorProps<T extends ValidComponent = "span"> =
  BreadcrumbPrimitive.BreadcrumbsSeparatorProps<T> & {
    class?: string | undefined
    children?: JSX.Element
  }

const BreadcrumbSeparator = <T extends ValidComponent = "span">(
  props: PolymorphicProps<T, BreadcrumbSeparatorProps<T>>
) => {
  const [local, others] = splitProps(props as BreadcrumbSeparatorProps, ["class", "children"])
  return (
    <BreadcrumbPrimitive.Separator 
      role="presentation"
      aria-hidden="true"
      class={cn("[&>svg]:size-3.5", local.class)} 
      {...others}
    >
      <Show
        when={local.children}
        fallback={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 6l6 6l-6 6" />
          </svg>
        }
      >
        {local.children}
      </Show>
    </BreadcrumbPrimitive.Separator>
  )
}

const BreadcrumbEllipsis: Component<ComponentProps<"span">> = (props) => {
  const [local, others] = splitProps(props, ["class"])
  return (
    <span 
      role="presentation"
      aria-hidden="true"
      class={cn("flex h-9 w-9 items-center justify-center", local.class)} 
      {...others}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-4 w-4"
      >
        <path d="M5 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
        <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
        <path d="M19 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      </svg>
      <span class="sr-only">More</span>
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis
}
