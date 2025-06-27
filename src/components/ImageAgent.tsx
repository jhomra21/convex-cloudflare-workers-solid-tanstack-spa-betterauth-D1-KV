import { createSignal, createUniqueId, Show, createMemo } from 'solid-js';
import { useGenerateImage } from '~/lib/images-actions';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Icon } from '~/components/ui/icon';
import { toast } from 'solid-sonner';
import { cn } from '~/lib/utils';
import { convexClient, convexApi } from '~/lib/convex';

import { useAgentPromptState } from '~/lib/hooks/use-persistent-state';
import { useStableStatus } from '~/lib/hooks/use-stable-props';
import { ErrorBoundary } from '~/components/ErrorBoundary';

export interface ImageAgentProps {
  id?: string;
  prompt?: string;
  onRemove?: (id: string) => void;
  onMouseDown?: (e: MouseEvent) => void;
  size?: { width: number; height: number };
  onResizeStart?: (e: MouseEvent, handle: string) => void;
  generatedImage?: string;

  onPromptChange?: (id: string, prompt: string) => void;
  status?: 'idle' | 'processing' | 'success' | 'failed';
  model?: 'normal' | 'pro';
  class?: string;
}

export function ImageAgent(props: ImageAgentProps) {
  const agentId = props.id || createUniqueId();
  
  // Use persistent state hook for prompt
  const [localPrompt, setLocalPrompt] = useAgentPromptState(agentId, props.prompt || '');
  const [showPromptInput, setShowPromptInput] = createSignal(!props.prompt);
  
  // Local loading state for immediate feedback
  const [isLocallyGenerating, setIsLocallyGenerating] = createSignal(false);
  
  // Use stable status to minimize re-renders
  const stableStatus = useStableStatus(() => props.status);
  
  // Combined loading state: local generating OR backend processing
  const isLoading = () => isLocallyGenerating() || stableStatus().isProcessing;
  const hasFailed = () => stableStatus().isFailed;
  const hasImage = () => !!props.generatedImage;
  
  // Model selection state
  const [selectedModel, setSelectedModel] = createSignal<'normal' | 'pro'>(props.model || 'normal');
  
  const handlePromptChange = (value: string) => {
    setLocalPrompt(value); // This automatically persists via the hook
  };

  // Only sync to canvas when user finishes editing
  const handleBlur = () => {
    props.onPromptChange?.(agentId, localPrompt());
  };
  
  const generateImage = useGenerateImage();

  const handleGenerate = async () => {
    const currentPrompt = localPrompt().trim();
    if (!currentPrompt) {
      toast.error('Please enter a prompt');
      return;
    }
    
    // Immediate local loading feedback
    setIsLocallyGenerating(true);
    
    // Set status to 'processing' optimistically  
    convexClient.mutation(convexApi.agents.updateAgentStatus, {
      agentId: agentId as any,
      status: 'processing',
    });

    // Sync prompt with parent before calling mutation
    props.onPromptChange?.(agentId, currentPrompt);
    
    try {
      const model = selectedModel() === 'pro' 
        ? 'fal-ai/flux-kontext-lora/text-to-image'
        : '@cf/black-forest-labs/flux-1-schnell';
        
      // Let the backend handle ALL updates - no frontend callbacks
      await generateImage.mutateAsync({
        prompt: currentPrompt,
        model,
        steps: 4,
        agentId,
      });
      
      // Backend handles all updates - UI reacts to Convex changes
      setShowPromptInput(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate image');
    } finally {
      // Clear local loading state once generation completes (success or failure)
      setIsLocallyGenerating(false);
    }
  };

  const handleRegenerate = () => {
    handleGenerate();
  };

  const handleEditPrompt = () => {
    setShowPromptInput(true);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  // Memoize agent size to prevent unnecessary recalculations
  const agentSize = createMemo(() => props.size || { width: 320, height: 384 });

  return (
    <ErrorBoundary>
      <Card 
        class={cn(
          "flex flex-col relative transition-all duration-300",
          isLoading() ? "border border-secondary/50" : "",
          props.class
        )}
        style={{
          width: `${agentSize().width}px`,
          height: `${agentSize().height}px`
        }}
      >
      {/* Drag Handle - Larger clickable area */}
      <div 
        class="w-full h-8 bg-muted/30 cursor-move rounded-t-lg hover:bg-muted/50 transition-colors flex items-center justify-center border-b border-muted/40"
        onMouseDown={props.onMouseDown}
        title="Drag to move agent"
      >
        <div class="flex gap-1">
          <div class="w-1 h-1 bg-muted-foreground/40 rounded-full"></div>
          <div class="w-1 h-1 bg-muted-foreground/40 rounded-full"></div>
          <div class="w-1 h-1 bg-muted-foreground/40 rounded-full"></div>
          <div class="w-1 h-1 bg-muted-foreground/40 rounded-full"></div>
          <div class="w-1 h-1 bg-muted-foreground/40 rounded-full"></div>
        </div>
      </div>
      
      <CardContent class="p-4 flex flex-col h-full">
        {/* Prompt Section */}
        <div class="flex-shrink-0 mb-4">
          <Show when={showPromptInput() || !hasImage()}>
            <div class="space-y-2">
              {/* Model Selection */}
              <div class="flex gap-1 p-1 bg-muted/30 rounded-md">
                <Button
                  variant={selectedModel() === 'normal' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedModel('normal')}
                  class="flex-1 h-7 text-xs"
                  disabled={isLoading()}
                >
                  Normal
                </Button>
                <Button
                  variant={selectedModel() === 'pro' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedModel('pro')}
                  class="flex-1 h-7 text-xs"
                  disabled={isLoading()}
                >
                  Pro
                </Button>
              </div>
              
              {/* Prompt Input */}
              <div class="flex gap-2">
                <Input
                  placeholder="Enter your prompt..."
                  value={localPrompt()}
                  onChange={handlePromptChange}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  class="flex-1"
                  disabled={isLoading()}
                />
                <Button
                  onClick={handleGenerate}
                  disabled={isLoading() || !localPrompt().trim()}
                  size="sm"
                  class={isLoading() ? "bg-secondary hover:bg-secondary/90 text-muted-foreground" : ""}
                >
                  <Show when={isLoading()} fallback={<Icon name="play" class="h-4 w-4" />}>
                    <Icon name="loader" class="h-4 w-4 animate-spin" />
                  </Show>
                </Button>
              </div>
            </div>
          </Show>
          
          <Show when={!showPromptInput() && hasImage()}>
            <div class="flex items-center justify-between">
              <p class="text-sm text-muted-foreground truncate flex-1 mr-2">
                {localPrompt()}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditPrompt}
                disabled={isLoading()}
              >
                <Icon name="edit" class="h-3 w-3" />
              </Button>
            </div>
          </Show>
        </div>

        {/* Image Section */}
        <div class="flex-1 flex items-center justify-center relative overflow-hidden">
          {/* Empty state - only show when idle AND no image */}
          <Show when={!hasImage() && !isLoading() && !hasFailed()}>
            <div class="flex flex-col items-center justify-center h-full text-muted-foreground">
              <div class="w-16 h-16 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center mb-3">
                <Icon name="image" class="h-8 w-8 opacity-50" />
              </div>
              <p class="text-sm">Enter a prompt to generate</p>
            </div>
          </Show>

          {/* Failed state */}
          <Show when={hasFailed() && !isLoading()}>
            <div class="flex flex-col items-center justify-center h-full text-destructive">
              <div class="w-16 h-16 border-2 border-dashed border-destructive/30 rounded-lg flex items-center justify-center mb-3">
                <Icon name="x" class="h-8 w-8 opacity-70" />
              </div>
              <p class="text-sm">Generation failed</p>
              <Button variant="outline" size="sm" onClick={handleRegenerate} class="mt-2">
                Try again
              </Button>
            </div>
          </Show>

          {/* Image container - simple and reactive */}
          <div class="relative w-full h-full">
            <Show when={props.generatedImage}>
              <img
                src={props.generatedImage}
                alt="Generated image"
                class="absolute inset-0 w-full h-full object-cover rounded-md"
                style={{
                  opacity: isLoading() ? 0.3 : 1,
                  transition: "opacity 300ms ease"
                }}
              />
            </Show>

            {/* Action Buttons Overlay - inside the image container to be properly positioned */}
            <Show when={!isLoading()}>
              <div class="absolute top-2 right-2 flex gap-1 z-10">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={isLoading()}
                >
                  <Icon name="refresh-cw" class="h-3 w-3" />
                </Button>
                <Show when={props.onRemove}>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => props.onRemove?.(agentId)}
                  >
                    <Icon name="x" class="h-3 w-3" />
                  </Button>
                </Show>
              </div>
            </Show>
          </div>
          
          {/* Loading state - completely independent overlay component */}
          <Show when={isLoading()}>
            <div class="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-md">
              <div class="flex flex-col items-center gap-3">
                <Icon name="loader" class="h-6 w-6 animate-spin text-muted-foreground" />
                <div class="text-xs text-muted-foreground">
                  {isLocallyGenerating() ? "Starting..." : 
                   stableStatus().isProcessing ? "Generating..." : "Loading..."}
                </div>
              </div>
            </div>
          </Show>
        </div>
      </CardContent>

      {/* Resize Handles */}
      {props.onResizeStart && (
        <>
          {/* Corner resize handles */}
          <div 
            class="absolute -top-1 -left-1 w-3 h-3 bg-primary/60 border border-primary rounded-full cursor-nw-resize opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => props.onResizeStart?.(e, 'nw')}
            title="Resize"
          />
          <div 
            class="absolute -top-1 -right-1 w-3 h-3 bg-primary/60 border border-primary rounded-full cursor-ne-resize opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => props.onResizeStart?.(e, 'ne')}
            title="Resize"
          />
          <div 
            class="absolute -bottom-1 -left-1 w-3 h-3 bg-primary/60 border border-primary rounded-full cursor-sw-resize opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => props.onResizeStart?.(e, 'sw')}
            title="Resize"
          />
          <div 
            class="absolute -bottom-1 -right-1 w-3 h-3 bg-primary/60 border border-primary rounded-full cursor-se-resize opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => props.onResizeStart?.(e, 'se')}
            title="Resize"
          />
        </>
      )}
    </Card>
    </ErrorBoundary>
  );
}
