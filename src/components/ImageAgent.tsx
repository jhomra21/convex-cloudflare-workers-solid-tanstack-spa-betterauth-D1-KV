import { createSignal, createUniqueId, Show } from 'solid-js';
import { useGenerateImage } from '~/lib/images-actions';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Icon } from '~/components/ui/icon';
import { toast } from 'solid-sonner';
import { cn } from '~/lib/utils';
import { convexClient, convexApi } from '~/lib/convex';

// Global state to persist input values across component re-creations
const agentPromptState = new Map<string, string>();

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
  
  // Initialize from global state or props
  const initialPrompt = agentPromptState.get(agentId) || props.prompt || '';
  const [localPrompt, setLocalPrompt] = createSignal(initialPrompt);
  const [showPromptInput, setShowPromptInput] = createSignal(!props.prompt);
  
  // Status-based loading state
  const isGenerating = () => props.status === 'processing';
  const hasFailed = () => props.status === 'failed';
  
  // Track edit mode - critical for handling state correctly
  const [isInEditMode, setIsInEditMode] = createSignal(false);
  
  // Model selection state - use prop or default
  const [selectedModel, setSelectedModel] = createSignal<'normal' | 'pro'>(props.model || 'normal');
  
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
    
    // Immediate optimistic update for instant feedback (fire and forget)
    convexClient.mutation(convexApi.agents.updateAgentStatus, {
      agentId: agentId as any,
      status: 'processing',
    }).catch(error => {
      console.error('Failed to update agent status optimistically:', error);
    });
    
    // Critical for edit mode - always clear image first
    if (isInEditMode() || (props.generatedImage && showPromptInput())) {
      props.onImageGenerated?.(agentId, '');
    }
    
    // Sync to canvas before generating
    props.onPromptChange?.(agentId, currentPrompt);
    
    try {
      const model = selectedModel() === 'pro' 
        ? 'fal-ai/flux-kontext-lora/text-to-image'
        : '@cf/black-forest-labs/flux-1-schnell';
        
      const result = await generateImage.mutateAsync({
        prompt: currentPrompt,
        model,
        steps: 4,
        agentId, // Pass agentId to the API for status updates
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
            <div class="space-y-2">
              {/* Model Selection */}
              <div class="flex gap-1 p-1 bg-muted/30 rounded-md">
                <Button
                  variant={selectedModel() === 'normal' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedModel('normal')}
                  class="flex-1 h-7 text-xs"
                  disabled={isGenerating()}
                >
                  Normal
                </Button>
                <Button
                  variant={selectedModel() === 'pro' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedModel('pro')}
                  class="flex-1 h-7 text-xs"
                  disabled={isGenerating()}
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

          {/* Failed state */}
          <Show when={hasFailed()}>
            <div class="flex flex-col items-center justify-center h-full text-destructive">
              <div class="w-16 h-16 border-2 border-dashed border-destructive/30 rounded-lg flex items-center justify-center mb-3">
                <Icon name="x" class="h-8 w-8 opacity-70" />
              </div>
              <p class="text-sm">Generation failed</p>
              <Button variant="outline" size="sm" onClick={handleGenerate} class="mt-2">
                Try again
              </Button>
            </div>
          </Show>

          {/* Empty state - only show when idle AND no image */}
          <Show when={props.status === 'idle' && !props.generatedImage}>
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
