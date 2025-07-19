import { createSignal, createUniqueId, Show, For } from 'solid-js';
import { useGenerateImage, useEditImage } from '~/lib/images-actions';
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
  userName?: string;
  prompt?: string;
  onRemove?: (id: string) => void;
  onMouseDown?: (e: MouseEvent) => void;
  size?: { width: number; height: number };
  onResizeStart?: (e: MouseEvent, handle: string) => void;
  generatedImage?: string;

  onPromptChange?: (id: string, prompt: string) => void;
  status?: 'idle' | 'processing' | 'success' | 'failed';
  model?: 'normal' | 'pro';
  type?: 'image-generate' | 'image-edit';
  connectedAgentId?: string;
  uploadedImageUrl?: string;
  activeImageUrl?: string;
  availableAgents?: Array<{id: string; prompt: string; imageUrl?: string}>;
  onConnectAgent?: (sourceAgentId: string, targetAgentId: string) => void;
  onDisconnectAgent?: (agentId: string) => void;
  class?: string;
}

export function ImageAgent(props: ImageAgentProps) {
  const agentId = props.id || createUniqueId();
  
  // Use persistent state hook for prompt
  const [localPrompt, setLocalPrompt] = useAgentPromptState(agentId, props.prompt || '');
  const [showPromptInput, setShowPromptInput] = createSignal(!props.prompt);
  
  // Get connected agent info
  const connectedAgent = () => {
    if (props.type === 'image-edit' && props.connectedAgentId && props.availableAgents) {
      return props.availableAgents.find(agent => agent.id === props.connectedAgentId);
    }
    return null;
  };
  
  // Get input image from either active image, uploaded image, or connected agent
  const getInputImage = () => {
    // For edit agents, prefer activeImageUrl (user's choice)
    if (props.type === 'image-edit' && props.activeImageUrl) {
      return props.activeImageUrl;
    }
    
    if (props.uploadedImageUrl) {
      return props.uploadedImageUrl;
    }
    const connected = connectedAgent();
    return connected?.imageUrl || null;
  };
  

  
  // Image upload for edit agents
  const [isDragOver, setIsDragOver] = createSignal(false);
  
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    
    try {
      // Convert to base64 for now - in production you'd upload to R2
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        
        // Update agent with uploaded image
        await convexClient.mutation(convexApi.agents.updateAgentUploadedImage, {
          agentId: agentId as any,
          uploadedImageUrl: base64,
        });
        
        toast.success('Image uploaded successfully');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload image');
    }
  };
  
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleImageUpload(files[0]);
    }
  };
  
  const handleFileInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      handleImageUpload(files[0]);
    }
  };
  
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
  const editImage = useEditImage();

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
      if (props.type === 'image-edit') {
        // For editing, we need an input image
        const inputImageUrl = getInputImage();
        
        if (!inputImageUrl) {
          toast.error('Edit agents need an input image. Upload one or connect to a generator agent.');
          setIsLocallyGenerating(false);
          return;
        }
        
        await editImage.mutateAsync({
          prompt: currentPrompt,
          inputImageUrl,
          model: 'fal-ai/flux-kontext-lora',
          steps: 30,
          agentId,
        });
      } else {
        // Regular generation
        const model = selectedModel() === 'pro' 
          ? 'fal-ai/flux-kontext-lora/text-to-image'
          : '@cf/black-forest-labs/flux-1-schnell';
          
        await generateImage.mutateAsync({
          prompt: currentPrompt,
          model,
          steps: 4,
          agentId,
        });
      }
      
      // Backend handles all updates - UI reacts to Convex changes
      setShowPromptInput(false);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to ${props.type === 'image-edit' ? 'edit' : 'generate'} image`);
    } finally {
      // Clear local loading state once generation completes (success or failure)
      setIsLocallyGenerating(false);
    }
  };

  const handleRegenerate = () => {
    handleGenerate();
  };
  
  const handleSelectImage = async (imageUrl: string) => {
    try {
      await convexClient.mutation(convexApi.agents.updateAgentActiveImage, {
        agentId: agentId as any,
        activeImageUrl: imageUrl,
      });
      toast.success('Active image updated');
    } catch (error) {
      console.error('Failed to update active image:', error);
      toast.error('Failed to update active image');
    }
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

  // Agent size - use props.size directly to avoid circular dependency
  const agentSize = () => props.size || { width: 320, height: 384 };

  return (
    <ErrorBoundary>
      <Card 
        class={cn(
          "flex flex-col relative transition-all duration-300 cursor-move",
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
        class="w-full h-8 bg-muted/30 cursor-move active:cursor-move rounded-t-lg hover:bg-muted/60 hover:border-primary/20 transition-all duration-200 flex items-center justify-between px-3 border-b border-muted/40"
        title="Drag to move this agent"
      >
        <div class="flex items-center gap-2">
          <Icon 
            name={props.type === 'image-edit' ? 'edit' : 'image'} 
            class="h-3 w-3 text-muted-foreground/60" 
          />
          <span class="text-xs text-muted-foreground/60 capitalize">
            {props.type === 'image-edit' ? 'Edit' : 'Generate'}
          </span>
          <Show when={props.userName}>
            <span class="text-xs text-muted-foreground/40">• {props.userName}</span>
          </Show>
        </div>
        <div class="flex gap-1">
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
              {/* Model Selection - Only show for image-generate agents */}
              <Show when={props.type !== 'image-edit'}>
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
              </Show>
              
              {/* Prompt Input */}
              <div class="flex gap-2">
                <Input
                  placeholder="Enter your prompt..."
                  value={localPrompt()}
                  onChange={handlePromptChange}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  class="flex-1 cursor-text"
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
            <Show when={props.type === 'image-edit'} fallback={
              <div class="flex flex-col items-center justify-center h-full text-muted-foreground">
                <div class="w-16 h-16 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center mb-3">
                  <Icon name="image" class="h-8 w-8 opacity-50" />
                </div>
                <p class="text-sm">Enter a prompt to generate</p>
              </div>
            }>
              {/* Edit agent empty state with input image upload */}
              <div class="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <Show when={!getInputImage()}>
                  <div 
                    class={cn(
                      "w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center mb-3 transition-colors cursor-pointer",
                      isDragOver() 
                        ? "border-primary bg-primary/5" 
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    )}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = handleFileInput;
                      input.click();
                    }}
                  >
                    <Icon name="upload" class="h-8 w-8 opacity-50 mb-2" />
                    <p class="text-sm text-center">
                      Drop an image here or click to upload
                    </p>
                    <p class="text-xs text-muted-foreground/60 mt-1">
                      PNG, JPG, GIF up to 10MB
                    </p>
                  </div>
                  
                  {/* Agent connection section */}
                  <Show when={props.availableAgents && props.availableAgents.length > 0}>
                    <div class="w-full">
                      <div class="flex items-center gap-2 mb-2">
                        <div class="flex-1 h-px bg-muted-foreground/30"></div>
                        <span class="text-xs text-muted-foreground/60">OR</span>
                        <div class="flex-1 h-px bg-muted-foreground/30"></div>
                      </div>
                      
                      <div class="w-full">
                        <p class="text-xs text-center mb-2">Connect to a generator agent:</p>
                        <div class="space-y-1 max-h-24 overflow-y-auto">
                          <For each={props.availableAgents?.filter(agent => agent.id !== agentId && agent.imageUrl)}>
                            {(agent) => (
                              <Button
                                variant="outline"
                                size="sm"
                                class="w-full text-xs justify-start h-8"
                                onClick={() => {
                                  // Connect Generate agent (source) to Edit agent (target)
                                  // agent.id = Generate agent with image, agentId = Edit agent that needs image
                                  props.onConnectAgent?.(agent.id, agentId);
                                  toast.success('Agent connected successfully');
                                }}
                              >
                                <Icon name="image" class="h-3 w-3 mr-2" />
                                <span class="truncate">{agent.prompt || 'Untitled'}</span>
                              </Button>
                            )}
                          </For>
                        </div>
                      </div>
                    </div>
                  </Show>
                </Show>
                
                <Show when={getInputImage()}>
                  <div class="w-full h-32 border-2 border-muted-foreground/30 rounded-lg overflow-hidden mb-3">
                    <img 
                      src={getInputImage()!} 
                      alt="Input image" 
                      class="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div class="flex gap-2 mb-2">
                    <Show when={props.uploadedImageUrl} fallback={
                      <Show when={connectedAgent()}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            props.onDisconnectAgent?.(agentId);
                            toast.success('Agent disconnected');
                          }}
                          class="flex-1"
                        >
                          <Icon name="x" class="h-4 w-4 mr-2" />
                          Disconnect
                        </Button>
                      </Show>
                    }>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = handleFileInput;
                          input.click();
                        }}
                        class="flex-1"
                      >
                        <Icon name="upload" class="h-4 w-4 mr-2" />
                        Change Image
                      </Button>
                    </Show>
                  </div>
                  
                  <Show when={connectedAgent()}>
                    <p class="text-xs text-center text-muted-foreground/60">
                      Connected to: {connectedAgent()?.prompt || 'Untitled'}
                    </p>
                  </Show>
                </Show>
                
                <p class="text-sm text-center">
                  Upload an image and enter a prompt to edit
                </p>
              </div>
            </Show>
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
        </div>

        {/* Image Selection for Edit Agents */}
        <Show when={props.type === 'image-edit' && (props.uploadedImageUrl || props.connectedAgentId) && props.generatedImage && !isLoading()}>
          <div class="mt-3">
            <div class="bg-background/95 backdrop-blur-sm border rounded-md p-2">
              <div class="text-xs font-medium mb-2 text-center">Choose input for next edit:</div>
              <div class="flex gap-2">
                <Button
                  variant={getInputImage() === props.uploadedImageUrl ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSelectImage(props.uploadedImageUrl!)}
                  class="flex-1 text-xs"
                >
                  <Icon name="upload" class="h-3 w-3 mr-1" />
                  Original
                </Button>
                <Button
                  variant={getInputImage() === props.generatedImage ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSelectImage(props.generatedImage!)}
                  class="flex-1 text-xs"
                >
                  <Icon name="sparkles" class="h-3 w-3 mr-1" />
                  Generated
                </Button>
              </div>
            </div>
          </div>
        </Show>

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
