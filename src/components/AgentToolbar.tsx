import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { cn } from '~/lib/utils';
import { Show } from 'solid-js';
import { CanvasActiveUsers } from './CanvasActiveUsers';
export interface AgentToolbarProps {

  activeAgentType: 'none' | 'generate' | 'edit' | 'voice' | 'video';
  agentCount: number;
  userAgentCount?: number;
  isSharedCanvas?: boolean;
  isOwnerSharingCanvas?: boolean;
  canvasId?: string;
  currentUserId?: string;
  isCanvasOwner?: boolean;
  onAddGenerateAgent: () => void;
  onAddEditAgent: () => void;
  onAddVoiceAgent: () => void;
  onAddVideoAgent: () => void;
  onClearCanvas: () => void;
}

export function AgentToolbar(props: AgentToolbarProps) {
  return (
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between px-1 py-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 gap-3 sm:gap-0">
      <div class="flex flex-wrap items-center gap-2">
        <Show when={props.isSharedCanvas || props.isOwnerSharingCanvas} fallback={
          <span class="text-sm font-semibold text-muted-foreground whitespace-nowrap">
            {props.agentCount} <span class="!font-normal text-muted-foreground/70">agent{props.agentCount !== 1 ? 's' : ''}</span>
          </span>
        }>
          {/* Stacked layout for any shared canvas activity */}
          <div class="flex flex-col text-sm font-semibold text-muted-foreground leading-tight">
            <div>{props.agentCount} agent{props.agentCount !== 1 ? 's' : ''}</div>
            <div class="text-xs !font-normal text-muted-foreground/60">{props.userAgentCount || 0} yours</div>
          </div>
        </Show>

        <Show when={props.isSharedCanvas}>
          <div class="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs rounded-md">
            <Icon name="users" class="h-3 w-3" />
            <span>Shared Canvas</span>
          </div>
        </Show>

        <Show when={!props.isSharedCanvas && props.isOwnerSharingCanvas}>
          <div class="flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-xs rounded-md">
            <Icon name="share" class="h-3 w-3" />
            <span>Sharing Enabled</span>
          </div>
        </Show>

        {/* Show active users for shared canvases */}
        <Show when={props.canvasId && (props.isSharedCanvas || props.isOwnerSharingCanvas)}>
          <CanvasActiveUsers
            canvasId={props.canvasId}
            currentUserId={props.currentUserId}
            class="border-l pl-2 ml-2"
          />
        </Show>

      </div>

      <div class="flex flex-wrap items-center gap-2">
        {/* Agent Selection Section with improved UI */}
        <div class="bg-muted/30 border rounded-md flex items-center h-9 overflow-hidden min-w-0">
          <div class="text-xs text-muted-foreground px-2 sm:px-3 border-r h-full items-center whitespace-nowrap hidden sm:flex">Add Agent:</div>
          <div class="flex h-full min-w-0">
            <button
              onClick={props.onAddGenerateAgent}
              class={cn(
                "flex items-center gap-1 h-full px-2 sm:px-3 relative cursor-pointer",
                "hover:bg-foreground/5 transition-colors",
                "focus:outline-none focus-visible:bg-background/80",
                props.activeAgentType === 'generate' ? "bg-background" : ""
              )}
            >
              <div
                class={cn(
                  "absolute left-0 h-4 w-0.5 bg-blue-500 rounded-full transition-opacity",
                  props.activeAgentType === 'generate' ? "opacity-100" : "opacity-0"
                )}
              />
              <Icon name="image" class="h-4 w-4 text-blue-600" />
              <span class="text-sm">
                <span class="hidden sm:inline">Generate</span>
                <span class="sm:hidden">Gen</span>
              </span>
            </button>
            <div class="w-px h-full bg-border/50" />
            <button
              onClick={props.onAddEditAgent}
              class={cn(
                "flex items-center gap-1 h-full px-2 sm:px-3 relative cursor-pointer",
                "hover:bg-foreground/5 transition-colors",
                "focus:outline-none focus-visible:bg-background/80",
                props.activeAgentType === 'edit' ? "bg-background" : ""
              )}
            >
              <div
                class={cn(
                  "absolute left-0 h-4 w-0.5 bg-purple-500 rounded-full transition-opacity",
                  props.activeAgentType === 'edit' ? "opacity-100" : "opacity-0"
                )}
              />
              <Icon name="edit" class="h-4 w-4 text-purple-600" />
              <span class="text-sm">Edit</span>
            </button>
            <div class="w-px h-full bg-border/50" />
            <button
              onClick={props.onAddVoiceAgent}
              class={cn(
                "flex items-center gap-1 h-full px-2 sm:px-3 relative cursor-pointer",
                "hover:bg-foreground/5 transition-colors",
                "focus:outline-none focus-visible:bg-background/80",
                props.activeAgentType === 'voice' ? "bg-background" : ""
              )}
            >
              <div
                class={cn(
                  "absolute left-0 h-4 w-0.5 bg-indigo-500 rounded-full transition-opacity",
                  props.activeAgentType === 'voice' ? "opacity-100" : "opacity-0"
                )}
              />
              <Icon name="mic" class="h-4 w-4 text-indigo-600" />
              <span class="text-sm">
                <span class="hidden sm:inline">Voice</span>
                <span class="sm:hidden">Mic</span>
              </span>
            </button>
            <div class="w-px h-full bg-border/50" />
            <button
              onClick={props.onAddVideoAgent}
              class={cn(
                "flex items-center gap-1 h-full px-2 sm:px-3 relative cursor-pointer",
                "hover:bg-foreground/5 transition-colors",
                "focus:outline-none focus-visible:bg-background/80",
                props.activeAgentType === 'video' ? "bg-background" : ""
              )}
            >
              <div
                class={cn(
                  "absolute left-0 h-4 w-0.5 bg-red-500 rounded-full transition-opacity",
                  props.activeAgentType === 'video' ? "opacity-100" : "opacity-0"
                )}
              />
              <Icon name="video" class="h-4 w-4 text-red-600" />
              <span class="text-sm">
                <span class="hidden sm:inline">Video</span>
                <span class="sm:hidden">Vid</span>
              </span>
            </button>
          </div>
        </div>


        <Button
          onClick={props.onClearCanvas}
          variant="outline"
          size="sm"
          class="h-9"
          disabled={
            // Disable if:
            // - Collaborator on shared canvas with no own agents
            // - Anyone with no agents to clear
            props.isSharedCanvas && !props.isCanvasOwner
              ? (props.userAgentCount || 0) === 0
              : props.agentCount === 0
          }
        >
          <Icon name="trash-2" class="h-4 w-4" />
          {props.isSharedCanvas && !props.isCanvasOwner ? "Clear Mine" : "Clear All"}
        </Button>
      </div>
    </div>
  );
} 