import { Show, type JSX } from "solid-js";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { authClient } from "~/lib/auth-client";

export type LoginMethodButtonProps = {
  method: string; // e.g., "email", "google", "github", "twitter"
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: JSX.Element;
  class?: string;
};

const Spinner = (props: { class?: string }) => (
  <div
    class={`h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-t-transparent ${props.class ?? ""}`}
  />
);

export function LoginMethodButton(props: LoginMethodButtonProps) {
  const isLast = () => authClient.isLastUsedLoginMethod(props.method) === true;

  return (
    <div class={`relative w-full ${props.class ?? ""}`}>
      <Button
        variant={"outline"}
        class={`w-full`}
        onClick={props.onClick}
        disabled={props.disabled}
      >
        <Show when={!!props.loading}>
          <Spinner class="mr-2" />
        </Show>
        {props.icon}
        {props.label}
      </Button>
      <Show when={isLast()}>
        <Badge
          variant="secondary"
          class="pointer-events-none absolute -top-2 -right-2 z-10 shadow-sm"
        >
          Last used
        </Badge>
      </Show>
    </div>
  );
}
