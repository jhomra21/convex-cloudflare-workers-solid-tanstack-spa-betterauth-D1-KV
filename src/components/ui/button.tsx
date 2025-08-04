import type { JSX, ValidComponent } from "solid-js"
import { splitProps } from "solid-js"

import * as ButtonPrimitive from "@kobalte/core/button"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"
import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

import { cn } from "~/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer ring-offset-background active:scale-[0.97] transition-[colors,transform,scale] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-primary-foreground hover:bg-destructive/90",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        skeuomorphic: "bg-gradient-to-b from-zinc-50 via-white to-zinc-200 text-gray-800 border-2 border-gray-300 hover:shadow-lg active:translate-y-0.5 active:shadow-inner transform transition-all duration-150 ease-in-out dark:from-gray-700 dark:via-gray-800 dark:to-gray-900 dark:text-white dark:border-gray-600",
        "sf-compute": "pb-[2px] relative z-0 border border-blue-700/90 bg-gradient-to-b from-blue-400 via-blue-600 to-blue-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.2),0_1px_2px_rgba(0,0,0,0.2)] [text-shadow:0_1px_rgba(0,11,15,0.4) active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]",
        "sf-compute-destructive": "pb-[2px] relative z-0 border border-red-700/90 bg-gradient-to-b from-red-400 via-red-600 to-red-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1.5px_0_rgba(0,0,0,0.3),0_1px_2px_rgba(0,0,0,0.2)] [text-shadow:0_1px_rgba(0,11,15,0.4)] active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-8",
        icon: "size-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

type ButtonProps<T extends ValidComponent = "button"> = ButtonPrimitive.ButtonRootProps<T> &
  VariantProps<typeof buttonVariants> & { class?: string | undefined; children?: JSX.Element }

const Button = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, ButtonProps<T>>
) => {
  const [local, others] = splitProps(props as ButtonProps, ["variant", "size", "class"])
  return (
    <ButtonPrimitive.Root
      class={cn(buttonVariants({ variant: local.variant, size: local.size }), local.class)}
      {...others}
    />
  )
}

export { Button, buttonVariants }
export type { ButtonProps }
