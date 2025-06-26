import type { JSX } from "solid-js";
import { splitProps } from "solid-js";
import { cva } from "class-variance-authority";
import { cn } from "~/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);

type LabelProps = {
  for?: string;
  class?: string;
  children?: JSX.Element;
};

const Label = (props: LabelProps) => {
  const [local, others] = splitProps(props, ["class", "children"]);
  return (
    <label class={cn(labelVariants(), local.class)} {...others}>
      {local.children}
    </label>
  );
};

export { Label, labelVariants }; 