import type { Component, ComponentProps } from "solid-js"

import { Toaster as Sonner } from "solid-sonner"

type ToasterProps = ComponentProps<typeof Sonner>

const Toaster: Component<ToasterProps> = (props) => {
  return (
    <Sonner
      theme="system"
      class="toaster group"
      toastOptions={{
        classes: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground"
        }
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as any
      }
      {...props}
    />
  )
}

export { Toaster }
