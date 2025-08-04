import type { Component, ComponentProps, JSX, ValidComponent } from "solid-js"
import { splitProps } from "solid-js"

import * as DialogPrimitive from "@kobalte/core/dialog"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"

import { cn } from "~/lib/utils"

const Dialog = (props: DialogPrimitive.DialogRootProps) => {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

const DialogTrigger = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, DialogPrimitive.DialogTriggerProps<T>>
) => {
  return <DialogPrimitive.Trigger class="active:scale-97 transition-[scale] duration-150" data-slot="dialog-trigger" {...props} />
}

const DialogPortal: Component<DialogPrimitive.DialogPortalProps> = (props) => {
  const [, rest] = splitProps(props, ["children"])
  return (
    <DialogPrimitive.Portal {...rest} data-slot="dialog-portal">
      <div class="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
        {props.children}
      </div>
    </DialogPrimitive.Portal>
  )
}

type DialogCloseProps<T extends ValidComponent = "button"> = 
  DialogPrimitive.DialogCloseButtonProps<T> & { class?: string | undefined }

const DialogClose = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, DialogCloseProps<T>>
) => {
  const [, rest] = splitProps(props as DialogCloseProps, ["class"])
  return (
    <DialogPrimitive.CloseButton 
      class={cn(
        "rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[expanded]:bg-accent data-[expanded]:text-muted-foreground",
        props.class
      )}
      data-slot="dialog-close"
      {...rest}
    />
  )
}

type DialogOverlayProps<T extends ValidComponent = "div"> =
  DialogPrimitive.DialogOverlayProps<T> & { class?: string | undefined }

const DialogOverlay = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, DialogOverlayProps<T>>
) => {
  const [, rest] = splitProps(props as DialogOverlayProps, ["class"])
  return (
    <DialogPrimitive.Overlay
      class={cn(
        "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0",
        props.class
      )}
      data-slot="dialog-overlay"
      {...rest}
    />
  )
}

type DialogContentProps<T extends ValidComponent = "div"> =
  DialogPrimitive.DialogContentProps<T> & {
    class?: string | undefined
    children?: JSX.Element
    showCloseButton?: boolean
  }

const DialogContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, DialogContentProps<T>>
) => {
  const [local, rest] = splitProps(props as DialogContentProps, ["class", "children", "showCloseButton"])
  const showClose = local.showCloseButton !== false
  
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        class={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 sm:w-full",
          local.class
        )}
        data-slot="dialog-content"
        {...rest}
      >
        {local.children}
        {showClose && (
          <DialogClose class="absolute right-4 top-4 !cursor-pointer">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-4"
            >
              <path d="M18 6l-12 12" />
              <path d="M6 6l12 12" />
            </svg>
            <span class="sr-only">Close</span>
          </DialogClose>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

const DialogHeader: Component<ComponentProps<"div">> = (props) => {
  const [local, rest] = splitProps(props, ["class"])
  return (
    <div 
      class={cn("flex flex-col gap-2 text-center sm:text-left", local.class)} 
      data-slot="dialog-header"
      {...rest} 
    />
  )
}

const DialogFooter: Component<ComponentProps<"div">> = (props) => {
  const [local, rest] = splitProps(props, ["class"])
  return (
    <div
      class={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", local.class)}
      data-slot="dialog-footer"
      {...rest}
    />
  )
}

type DialogTitleProps<T extends ValidComponent = "h2"> = DialogPrimitive.DialogTitleProps<T> & {
  class?: string | undefined
}

const DialogTitle = <T extends ValidComponent = "h2">(
  props: PolymorphicProps<T, DialogTitleProps<T>>
) => {
  const [local, rest] = splitProps(props as DialogTitleProps, ["class"])
  return (
    <DialogPrimitive.Title
      class={cn("text-lg font-semibold leading-none tracking-tight", local.class)}
      data-slot="dialog-title"
      {...rest}
    />
  )
}

type DialogDescriptionProps<T extends ValidComponent = "p"> =
  DialogPrimitive.DialogDescriptionProps<T> & {
    class?: string | undefined
  }

const DialogDescription = <T extends ValidComponent = "p">(
  props: PolymorphicProps<T, DialogDescriptionProps<T>>
) => {
  const [local, rest] = splitProps(props as DialogDescriptionProps, ["class"])
  return (
    <DialogPrimitive.Description
      class={cn("text-sm text-muted-foreground", local.class)}
      data-slot="dialog-description"
      {...rest}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogOverlay,
  DialogPortal
}
