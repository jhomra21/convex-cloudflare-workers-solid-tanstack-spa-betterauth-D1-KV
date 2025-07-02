import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { ShareCanvasDialog } from '~/components/ShareCanvasDialog';
import { cn } from '~/lib/utils';
import { Show } from 'solid-js';
import { CanvasActiveUsers } from './CanvasActiveUsers';

export interface AgentToolbarProps {
  /**
   * Active agent type ('generate', 'edit', or 'voice')
   * Used for showing active button states
   */
  activeAgentType: 'none' | 'generate' | 'edit' | 'voice';
  
  /**
   * The number of agents currently on the canvas
   */
  agentCount: number;
  
  /**
   * If true, this is someone else's canvas being viewed
   */
  isSharedCanvas?: boolean;
  
  /**
   * If true, this canvas is being shared with others
   */
  isOwnerSharingCanvas?: boolean;
  
  /**
   * Canvas details for sharing
   */
  canvasId?: string;
  canvasName?: string;
  currentShareId?: string;
  canvasOwnerId?: string;
  currentUserId?: string;
  
  /**
   * Callback functions
   */
  onAddGenerateAgent: () => void;
  onAddEditAgent: () => void;
  onAddVoiceAgent: () => void;
  onClearCanvas: () => void;
  

}

/**
 * The toolbar for the image canvas, displaying controls for adding agents
 * and managing the canvas
 */
export function AgentToolbar(props: AgentToolbarProps) {
  return (
    <div class="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-muted-foreground">
          {props.agentCount} <span class="!font-normal text-muted-foreground/70">agent{props.agentCount !== 1 ? 's' : ''}</span>
        </span>
        
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
      
      <div class="flex items-center gap-2">
        {/* Agent Selection Section with improved UI */}
        <div class="bg-muted/30 border rounded-md flex items-center mr-2 h-9 overflow-hidden">
          <div class="text-xs text-muted-foreground px-3 border-r h-full flex items-center">Add Agent:</div>
          <div class="flex h-full">
            <button
              onClick={props.onAddGenerateAgent}
              class={cn(
                "flex items-center gap-1 h-full px-3 relative cursor-pointer",
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
              <span class="text-sm">Generate</span>
            </button>
            <div class="w-px h-full bg-border/50" />
            <button
              onClick={props.onAddEditAgent}
              class={cn(
                "flex items-center gap-1 h-full px-3 relative cursor-pointer",
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
                "flex items-center gap-1 h-full px-3 relative cursor-pointer",
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
              <span class="text-sm">Voice</span>
            </button>
          </div>
        </div>
        
        <ShareCanvasDialog
          canvasId={props.canvasId}
          canvasName={props.canvasName}
          currentShareId={props.currentShareId}
          isShareable={props.isOwnerSharingCanvas}
          canvasOwnerId={props.canvasOwnerId}
          currentUserId={props.currentUserId}
        >
          <Button
            size="sm"
            variant={props.isOwnerSharingCanvas ? "default" : "outline"}
            class={cn(
              "flex items-center gap-2 h-9",
              props.isOwnerSharingCanvas && "bg-blue-600 hover:bg-blue-700 border-blue-600"
            )}
          >
            <Icon name={props.isOwnerSharingCanvas ? "users" : "share"} class="h-4 w-4" />
            {props.isOwnerSharingCanvas ? "Shared" : "Share"}
          </Button>
        </ShareCanvasDialog>
        
        <Button
          onClick={props.onClearCanvas}
          variant="outline"
          size="sm"
          class="h-9"
          disabled={props.agentCount === 0}
        >
          <Icon name="trash-2" class="h-4 w-4" />
          Clear All
        </Button>
      </div>
    </div>
  );
} 