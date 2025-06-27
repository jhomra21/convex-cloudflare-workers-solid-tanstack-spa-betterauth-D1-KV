import { createSignal, createUniqueId, Show, createMemo } from 'solid-js';
import { useGenerateImage } from '~/lib/images-actions';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Icon } from '~/components/ui/icon';
import { toast } from 'solid-sonner';
import { cn } from '~/lib/utils';
import { convexClient, convexApi } from '~/lib/convex';
import { useImageCrossfade } from '~/lib/hooks/use-image-crossfade';
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
  onImageGenerated?: (id: string, image: string) => void;
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
  
  // Use crossfade hook for image transitions with longer duration
  const crossfade = useImageCrossfade(() => props.generatedImage, {
    transitionDuration: 300, // Match CSS transition
    extendedLoadingDuration: 150, // Keep loading a bit longer
  });
  
  // Use stable status to minimize re-renders
  const stableStatus = useStableStatus(() => props.status);
  
  // Computed loading state: true if backend is processing OR we are preloading a new image
  const isLoading = () => stableStatus().isProcessing || crossfade.isLoading();
  const hasFailed = () => stableStatus().isFailed;
  const hasImage = () => crossfade.hasImage();
  
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
    
    // Set status to 'processing' optimistically
    // This provides immediate feedback to the user
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
        
      // The mutation will eventually update the agent's status and imageUrl,
      // which will flow back down as props and trigger the UI changes.
      const result = await generateImage.mutateAsync({
        prompt: currentPrompt,
        model,
        steps: 4,
        agentId,
      });
      
      // Ensure we update the image URL in Convex
      if (result?.image?.url) {
        // Call the callback to update the image in Convex
        props.onImageGenerated?.(agentId, result.image.url);
      }
      
      // We don't need to handle the result here, the UI is driven by prop changes.
      // Success/error toasts can be handled in the useGenerateImage hook if desired.
      setShowPromptInput(false);
    } catch (error) {
      // The hook's onError will likely set the agent status to 'failed'
      console.error(error);
      toast.error('Failed to generate image');
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

          {/* Image container - always present but conditionally shown */}
          <div class="relative w-full h-full">
            {/* Current Image (fading out during transition) */}
            <Show when={crossfade.activeImageUrl()}>
              <img
                src={crossfade.activeImageUrl()}
                alt="Generated image"
                class={cn(
                  "absolute inset-0 w-full h-full object-cover rounded-md transition-opacity duration-300",
                  crossfade.isTransitioning() ? "opacity-0" : "opacity-100" 
                )}
              />
            </Show>
            
            {/* New Image (fading in during transition) */}
            <Show when={crossfade.newImageUrl()}>
              <img
                src={crossfade.newImageUrl()}
                alt="New generated image"
                class={cn(
                  "absolute inset-0 w-full h-full object-cover rounded-md transition-opacity duration-300",
                  crossfade.isTransitioning() ? "opacity-100" : "opacity-0"
                )}
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
                  {crossfade.isPreloading() ? "Generating..." : 
                   crossfade.isExtendedLoading() ? "Loading..." : "Processing..."}
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
