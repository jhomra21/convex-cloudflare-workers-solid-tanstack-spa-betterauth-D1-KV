import { createSignal, createUniqueId, Show, createEffect } from 'solid-js';
import { useGenerateImage } from '~/lib/images-actions';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Icon } from '~/components/ui/icon';
import { toast } from 'solid-sonner';
import { cn } from '~/lib/utils';
import { convexClient, convexApi } from '~/lib/convex';

// Global state to persist loading and image state across re-renders and prop changes
const agentStateMap = new Map<string, {
  prompt: string;
  isGenerating: boolean;
  displayUrl: string | undefined;
}>();

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
  let initialState = agentStateMap.get(agentId);
  if (!initialState) {
    initialState = {
      prompt: props.prompt || '',
      isGenerating: false,
      displayUrl: props.generatedImage,
    };
    agentStateMap.set(agentId, initialState);
  } else if (props.generatedImage && !initialState.isGenerating && props.generatedImage !== initialState.displayUrl) {
    // Update from props only if we're not generating
    initialState.displayUrl = props.generatedImage;
  }
  
  const [localPrompt, setLocalPrompt] = createSignal(initialState.prompt);
  const [showPromptInput, setShowPromptInput] = createSignal(!initialState.prompt);
  
  // --- Simplified State Machine ---
  const [isGenerating, _setIsGenerating] = createSignal(initialState.isGenerating);
  const [hasFailed, setHasFailed] = createSignal(false);
  const [displayUrl, _setDisplayUrl] = createSignal(initialState.displayUrl);
  
  // Wrapper functions that update both local and global state
  const setIsGenerating = (value: boolean) => {
    _setIsGenerating(value);
    initialState!.isGenerating = value;
  };
  
  const setDisplayUrl = (value: string | undefined) => {
    _setDisplayUrl(value);
    initialState!.displayUrl = value;
  };
  
  // Model selection state
  const [selectedModel, setSelectedModel] = createSignal<'normal' | 'pro'>(props.model || 'normal');
  
  const handlePromptChange = (value: string) => {
    setLocalPrompt(value);
    initialState!.prompt = value;
  };

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
    
    // 1. Start loading state immediately
    setIsGenerating(true);
    setHasFailed(false);
    
    // 2. Sync prompt with parent
    props.onPromptChange?.(agentId, currentPrompt);
    
    try {
      const model = selectedModel() === 'pro' 
        ? 'fal-ai/flux-kontext-lora/text-to-image'
        : '@cf/black-forest-labs/flux-1-schnell';
        
      const result = await generateImage.mutateAsync({
        prompt: currentPrompt,
        model,
        steps: 4,
        agentId,
      });
      
      if (result.image?.url) {
        const newImageUrl = result.image.url;

        // 3. Inform parent of new URL for persistence
        props.onImageGenerated?.(agentId, newImageUrl);

        // 4. Preload the new image BEFORE changing any state
        const img = new Image();
        img.onload = () => {
          // 5. THIS IS THE KEY: Only update the display and stop loading AFTER the image is loaded
          setDisplayUrl(newImageUrl);
          setIsGenerating(false);
          setShowPromptInput(false);
          toast.success('Image generated successfully!');
        };
        img.onerror = () => {
          console.error(`Failed to load image: ${newImageUrl}`);
          setHasFailed(true);
          setIsGenerating(false);
          toast.error('Failed to load generated image.');
        };
        img.src = newImageUrl;
        
      } else {
        throw new Error("Generation resulted in no URL.");
      }
    } catch (error) {
      toast.error('Failed to generate image');
      console.error(error);
      setHasFailed(true);
      setIsGenerating(false);
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
      {/* Drag Handle */}
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
          <Show when={showPromptInput() || !displayUrl()}>
            <div class="space-y-2">
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
          
          <Show when={!showPromptInput() && displayUrl()}>
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
          
          <div class="relative w-full h-full">
            {/* Empty State */}
            <Show when={!displayUrl() && !isGenerating() && !hasFailed()}>
              <div class="flex flex-col items-center justify-center h-full text-muted-foreground">
                <div class="w-16 h-16 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center mb-3">
                  <Icon name="image" class="h-8 w-8 opacity-50" />
                </div>
                <p class="text-sm">Enter a prompt to generate</p>
              </div>
            </Show>

            {/* Failed state */}
            <Show when={hasFailed() && !isGenerating()}>
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

            {/* Image Display */}
            <Show when={displayUrl()}>
              <div class="relative w-full h-full">
                <img
                  src={displayUrl()!}
                  alt="Generated image"
                  class="w-full h-full object-cover rounded-md"
                />
                {/* Action Buttons Overlay */}
                <Show when={!isGenerating()}>
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
                </Show>
              </div>
            </Show>
          </div>
          
          {/* Loading Overlay - Renders on top of everything */}
          <Show when={isGenerating()}>
            <div class="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-md">
              <div class="flex flex-col items-center gap-3">
                <Icon name="loader" class="h-6 w-6 animate-spin text-muted-foreground" />
                <div class="text-xs text-muted-foreground">Generating...</div>
              </div>
            </div>
          </Show>
        </div>
      </CardContent>

      {/* Resize Handles */}
      {props.onResizeStart && (
        <>
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
