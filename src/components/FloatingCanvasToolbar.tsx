import { createSignal, Show, type Component, createEffect } from 'solid-js';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { cn } from '~/lib/utils';
import { CanvasActiveUsers } from './CanvasActiveUsers';

export interface FloatingCanvasToolbarProps {
  // Agent management
  activeAgentType: 'none' | 'generate' | 'edit' | 'voice' | 'video';
  agentCount: number;
  userAgentCount?: number;
  
  // Canvas state
  isSharedCanvas?: boolean;
  isOwnerSharingCanvas?: boolean;
  canvasId?: string;
  currentUserId?: string;
  isCanvasOwner?: boolean;
  
  // Canvas info
  canvasName?: string;
  
  // Handlers
  onAddGenerateAgent: () => void;
  onAddEditAgent: () => void;
  onAddVoiceAgent: () => void;
  onAddVideoAgent: () => void;
  onClearCanvas: () => void;
  
  // Floating toolbar control
  isMinimized?: boolean;
  onToggleMinimize?: (value: boolean) => void;
}

export const FloatingCanvasToolbar: Component<FloatingCanvasToolbarProps> = (props) => {
  // Read initial state synchronously before render
  const storedState = typeof window !== 'undefined' 
    ? localStorage.getItem('canvas-toolbar-minimized') === 'true'
    : false;
  
  const [isMinimized, setIsMinimized] = createSignal(
    props.isMinimized !== undefined ? props.isMinimized : storedState
  );
  
  const handleToggleMinimize = () => {
    const newState = !isMinimized();
    setIsMinimized(newState);
    props.onToggleMinimize?.(newState);
    // Store preference in localStorage
    localStorage.setItem('canvas-toolbar-minimized', String(newState));
  };

  return (
    <div 
      class={cn(
        "absolute top-4 left-1/2 -translate-x-1/2 z-50",
        "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85",
        "border rounded-lg shadow-lg",
        "transition-all ease-[cubic-bezier(0.4,0,0.2,1)]",
        isMinimized() ? "p-2" : "p-3"
      )}
      style={{ 
        "max-width": "min(90vw, 800px)",
        "overflow": "hidden"
      }}
    >
      <div 
        class="relative overflow-hidden"
        style={{
          "max-height": isMinimized() ? "40px" : "300px",
          "transition": "max-height 150ms cubic-bezier(0.4, 0, 0.2, 1) ease-out"
        }}
      >
        {/* Minimized view - compact horizontal layout */}
        <div 
          class="flex items-center gap-3"
          style={{
            "display": isMinimized() ? "flex" : "none"
          }}
        >
          
          <div class="flex items-center gap-2 text-sm">
            <span class="font-semibold text-muted-foreground">
              {props.agentCount} agent{props.agentCount !== 1 ? 's' : ''}
            </span>
            
            <Show when={props.isSharedCanvas || props.isOwnerSharingCanvas}>
              <span class="text-muted-foreground">•</span>
              <div class="flex items-center gap-1">
                <Icon 
                  name={props.isSharedCanvas ? "users" : "share"} 
                  class="h-3 w-3 text-blue-600" 
                />
                <span class="text-xs text-blue-600">
                  {props.isSharedCanvas ? "Shared" : "Sharing"}
                </span>
              </div>
            </Show>
          </div>

          <div class="h-4 w-px bg-border" />

          {/* Quick add buttons */}
          <div class="flex items-center gap-0.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={props.onAddGenerateAgent}
              class="h-7 px-1.5 flex items-center gap-0.5"
              title="Add Generate Agent"
            >
              <Icon name="plus" class="h-3 w-3 text-muted-foreground" />
              <Icon name="image" class="h-3.5 w-3.5 text-blue-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={props.onAddEditAgent}
              class="h-7 px-1.5 flex items-center gap-0.5"
              title="Add Edit Agent"
            >
              <Icon name="plus" class="h-3 w-3 text-muted-foreground" />
              <Icon name="edit" class="h-3.5 w-3.5 text-purple-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={props.onAddVoiceAgent}
              class="h-7 px-1.5 flex items-center gap-0.5"
              title="Add Voice Agent"
            >
              <Icon name="plus" class="h-3 w-3 text-muted-foreground" />
              <Icon name="mic" class="h-3.5 w-3.5 text-indigo-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={props.onAddVideoAgent}
              class="h-7 px-1.5 flex items-center gap-0.5"
              title="Add Video Agent"
            >
              <Icon name="plus" class="h-3 w-3 text-muted-foreground" />
              <Icon name="video" class="h-3.5 w-3.5 text-red-600" />
            </Button>
          </div>

          <div class="h-4 w-px bg-border" />

          {/* Clear button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={props.onClearCanvas}
            class="h-7 px-1.5 flex items-center gap-0.5"
            disabled={
              props.isSharedCanvas && !props.isCanvasOwner
                ? (props.userAgentCount || 0) === 0
                : props.agentCount === 0
            }
            title={props.isSharedCanvas && !props.isCanvasOwner ? "Clear your agents" : "Clear all agents"}
          >
            <span class="h-3 w-3 text-muted-foreground">-</span>
            <Icon name="trash-2" class="h-3.5 w-3.5 text-destructive" />
          </Button>
          
          <div class="flex-1" />
          
          <Button
            size="sm"
            variant="ghost"
            onClick={handleToggleMinimize}
            class="h-7 w-7 p-0"
            title="Expand toolbar"
          >
            <Icon 
              name="chevron-down" 
              class="h-4 w-4 transition-transform duration-150"
              style={{
                "transform": isMinimized() ? "rotate(0deg)" : "rotate(180deg)"
              }}
            />
          </Button>
        </div>
        
        {/* Expanded view - full toolbar */}
        <div 
          class="space-y-3"
          style={{
            "display": isMinimized() ? "none" : "block",
            "animation": !isMinimized() ? "toolbar-fade-slide 300ms ease-out forwards" : "none"
          }}
        >
          {/* Header row with canvas info and minimize button */}
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex items-center gap-2">
                <Show when={props.isSharedCanvas || props.isOwnerSharingCanvas} fallback={
                  <span class="text-sm font-semibold text-muted-foreground whitespace-nowrap">
                    {props.agentCount} <span class="!font-normal text-muted-foreground/70">agent{props.agentCount !== 1 ? 's' : ''}</span>
                  </span>
                }>
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
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleToggleMinimize}
              class="h-7 w-7 p-0 flex-shrink-0"
              title="Minimize toolbar"
            >
              <Icon 
                name="chevron-down" 
                class="h-4 w-4 transition-transform duration-150"
                style={{
                  "transform": isMinimized() ? "rotate(0deg)" : "rotate(180deg)"
                }}
              />
            </Button>
          </div>

          {/* Agent controls row */}
          <div class="flex items-center gap-2">
            {/* Agent Selection Section */}
            <div class="bg-muted/30 border rounded-md flex items-center h-9 overflow-hidden flex-1">
              <div class="text-xs text-muted-foreground px-2 sm:px-3 border-r h-full items-center whitespace-nowrap hidden sm:flex">
                Add Agent:
              </div>
              <div class="flex h-full">
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
              class="h-9 flex-shrink-0"
              disabled={
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
      </div>
    </div>
  );
};
