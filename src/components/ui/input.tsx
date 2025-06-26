import type { ValidComponent, JSX } from "solid-js";
import { mergeProps, splitProps } from "solid-js";
import type { PolymorphicProps } from "@kobalte/core";
import * as TextFieldPrimitive from "@kobalte/core/text-field";
import { cn } from "~/lib/utils";

// Re-exporting parts from your existing text-field.tsx for consistency if needed,
// or use TextFieldPrimitive directly. For this component, we'''ll use TextFieldPrimitive.
// We can also import TextFieldLabel, TextFieldErrorMessage etc. from your ui/text-field.tsx
// if they have specific styling you want to reuse. For now, let'''s define them locally
// or use TextFieldPrimitive directly if styling is applied via `cn` and classes.

type InputRootProps<T extends ValidComponent = "div"> =
  TextFieldPrimitive.TextFieldRootProps<T> & {
    class?: string | undefined;
    // Add other specific root props if necessary
  };

// Props for the custom Input component
interface InputProps<T extends ValidComponent = "div"> extends InputRootProps<T> {
  type?: JSX.InputHTMLAttributes<HTMLInputElement>["type"];
  label?: string;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
  inputClass?: string; // For specific styling of the input/textarea element itself
}

const Input = <T extends ValidComponent = "div">(
  rawProps: PolymorphicProps<T, InputProps<T>>
) => {
  // Merge with default props if any (e.g., default type could be "text")
  const props = mergeProps({}, rawProps as InputProps);

  const [local, others] = splitProps(props, [
    "class",
    "type",
    "label",
    "placeholder",
    "error",
    "multiline",
    "inputClass",
  ]);

  return (
    <TextFieldPrimitive.Root
      class={cn("flex flex-col gap-1.5", local.class)}
      validationState={local.error ? "invalid" : "valid"}
      {...others} // This will pass down 'ref', 'value', 'onChange', etc.
    >
      {local.label && (
        // Assuming TextFieldLabel is styled similarly to your ui/text-field.tsx or use a shared one
        <TextFieldPrimitive.Label class="text-sm font-medium text-foreground data-[invalid]:text-destructive">
          {local.label}
        </TextFieldPrimitive.Label>
      )}
      {local.multiline ? (
        <TextFieldPrimitive.TextArea
          placeholder={local.placeholder}
          class={cn(
            "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm data-[invalid]:border-destructive data-[invalid]:text-destructive",
            local.inputClass
          )}
          // {...inputSpecificOthers} // If there were props only for textarea
        />
      ) : (
        <TextFieldPrimitive.Input
          type={local.type || "text"} // Default to "text" if not provided
          placeholder={local.placeholder}
          class={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm data-[invalid]:border-destructive data-[invalid]:text-destructive",
            local.inputClass
          )}
        />
      )}
      {local.error && (
        // Assuming TextFieldErrorMessage is styled similarly or use a shared one
        <TextFieldPrimitive.ErrorMessage class="text-sm font-medium text-destructive">
          {local.error}
        </TextFieldPrimitive.ErrorMessage>
      )}
    </TextFieldPrimitive.Root>
  );
};

export { Input };
