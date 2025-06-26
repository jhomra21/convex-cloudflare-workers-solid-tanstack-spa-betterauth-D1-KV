import { createSignal, createUniqueId, Show, createEffect } from 'solid-js';
import { useGenerateImage } from '~/lib/images-actions';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Icon } from '~/components/ui/icon';
import { toast } from 'solid-sonner';
import { cn } from '~/lib/utils';

// Global state to persist input values and loading states across component re-creations
const agentPromptState = new Map<string, string>();
const agentLoadingState = new Map<string, boolean>();

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
  class?: string;
}

export function ImageAgent(props: ImageAgentProps) {
  const agentId = props.id || createUniqueId();
  
  // Initialize from global state or props
  const initialPrompt = agentPromptState.get(agentId) || props.prompt || '';
  const [localPrompt, setLocalPrompt] = createSignal(initialPrompt);
  const [showPromptInput, setShowPromptInput] = createSignal(!props.prompt);
  
  // Use local reactive state but initialize from global
  const [isGenerating, setIsGenerating] = createSignal(agentLoadingState.get(agentId) || false);
  
  // Track edit mode - critical for handling loading state correctly
  const [isInEditMode, setIsInEditMode] = createSignal(false);
  
  // Fix stale loading state on mount
  if (agentLoadingState.get(agentId) && props.generatedImage) {
    agentLoadingState.set(agentId, false);
    setIsGenerating(false);
  }
  
  // Override setIsGenerating to also update global state
  const setIsGeneratingGlobal = (value: boolean) => {
    agentLoadingState.set(agentId, value);
    setIsGenerating(value);
  };
  
  // Handle prompt changes locally and persist to global state
  const handlePromptChange = (value: string) => {
    setLocalPrompt(value);
    agentPromptState.set(agentId, value); // Persist across re-creations
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
    
    // Critical for edit mode - always clear image first
    if (isInEditMode() || (props.generatedImage && showPromptInput())) {
      props.onImageGenerated?.(agentId, '');
    }
    
    // Set loading state after clearing image
    setIsGeneratingGlobal(true);
    
    // Sync to canvas before generating
    props.onPromptChange?.(agentId, currentPrompt);
    
    try {
      const result = await generateImage.mutateAsync({
        prompt: currentPrompt,
        model: '@cf/black-forest-labs/flux-1-schnell',
        steps: 4,
      });
      
      if (result.image?.url) {
        // Use the R2 URL for storage in Convex, not the base64 data
        props.onImageGenerated?.(agentId, result.image.url);
        setShowPromptInput(false); // Only hide input after successful generation
        setIsInEditMode(false); // Exit edit mode
      } else {
        console.error(`Failed to generate image: No URL in result`);
      }
      
      toast.success('Image generated successfully!');
    } catch (error) {
      toast.error('Failed to generate image');
      console.error(error);
    } finally {
      setIsGeneratingGlobal(false);
    }
  };

  const handleRegenerate = () => {
    // Clear the current image and regenerate
    props.onImageGenerated?.(agentId, '');
    handleGenerate();
  };

  const handleEditPrompt = () => {
    setIsInEditMode(true); // Mark as being in edit mode
    setShowPromptInput(true);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const agentSize = props.size || { width: 320, height: 384 };

  return (
    <Card 
      class={cn(
        "flex flex-col relative transition-all duration-300",
        isGenerating() ? "border border-secondary/50" : "",
        props.class
      )}
      style={{
        width: `${agentSize.width}px`,
        height: `${agentSize.height}px`
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
          <Show when={showPromptInput() || !props.generatedImage}>
            <div class="flex gap-2">
              <Input
                placeholder="Enter your prompt..."
                value={localPrompt()}
                onChange={handlePromptChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                class="flex-1"
                disabled={isGenerating()}
              />
              <Button
                onClick={handleGenerate}
                disabled={isGenerating() || !localPrompt().trim()}
                size="sm"
                class={isGenerating() ? "bg-secondary hover:bg-secondary/90 text-muted-foreground" : ""}
              >
                <Show when={isGenerating()} fallback={<Icon name="play" class="h-4 w-4" />}>
                  <Icon name="loader" class="h-4 w-4 animate-spin" />
                </Show>
              </Button>
            </div>
          </Show>
          
          <Show when={!showPromptInput() && props.generatedImage}>
            <div class="flex items-center justify-between">
              <p class="text-sm text-muted-foreground truncate flex-1 mr-2">
                {localPrompt()}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditPrompt}
                disabled={isGenerating()}
              >
                <Icon name="edit" class="h-3 w-3" />
              </Button>
            </div>
          </Show>
        </div>

        {/* Image Section */}
        <div class="flex-1 flex items-center justify-center relative">
          {/* Loading state - completely independent component */}
          <Show when={isGenerating()}>
            <div class="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-md">
              <div class="flex flex-col items-center gap-3">
                <Icon name="loader" class="h-6 w-6 animate-spin text-muted-foreground" />
                <div class="text-xs text-muted-foreground">Generating...</div>
              </div>
            </div>
          </Show>

          {/* Empty state - only show when not generating AND no image */}
          <Show when={!isGenerating() && !props.generatedImage}>
            <div class="flex flex-col items-center justify-center h-full text-muted-foreground">
              <div class="w-16 h-16 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center mb-3">
                <Icon name="image" class="h-8 w-8 opacity-50" />
              </div>
              <p class="text-sm">Enter a prompt to generate</p>
            </div>
          </Show>

          <Show when={props.generatedImage}>
            <div class="relative w-full h-full">
              <img
                src={props.generatedImage!}
                alt="Generated image"
                class="w-full h-full object-cover rounded-md"
              />
              <div class="absolute top-2 right-2 flex gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={isGenerating()}
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
  );
}
