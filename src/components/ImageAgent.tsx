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
  isDragged?: boolean;
  isRecentlyDragged?: boolean;

  onPromptChange?: (id: string, prompt: string) => void;
  status?: 'idle' | 'processing' | 'success' | 'failed';
  model?: 'normal' | 'pro';
  type?: 'image-generate' | 'image-edit';
  connectedAgentId?: string;
  uploadedImageUrl?: string;
  activeImageUrl?: string;
  availableAgents?: Array<{ id: string; prompt: string; imageUrl?: string }>;
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

  // Get input image from either active image, local image, uploaded image, or connected agent
  const getInputImage = () => {
    // For edit agents, prefer activeImageUrl (user's choice)
    if (props.type === 'image-edit' && props.activeImageUrl) {
      return props.activeImageUrl;
    }

    // Show local image immediately if available
    if (localImageUrl()) {
      return localImageUrl();
    }

    if (props.uploadedImageUrl) {
      return props.uploadedImageUrl;
    }
    const connected = connectedAgent();
    return connected?.imageUrl || null;
  };



  // Image upload for edit agents
  const [isDragOver, setIsDragOver] = createSignal(false);
  const [localImageFile, setLocalImageFile] = createSignal<File | null>(null);
  const [localImageUrl, setLocalImageUrl] = createSignal<string | null>(null);

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Clean up previous local URL if it exists
    if (localImageUrl()) {
      URL.revokeObjectURL(localImageUrl()!);
    }

    // Create local URL for immediate display
    const objectUrl = URL.createObjectURL(file);
    setLocalImageFile(file);
    setLocalImageUrl(objectUrl);

    toast.success('Image loaded - ready to edit');
  };

  // Helper to upload file to R2 when needed
  const uploadFileToR2 = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/images/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    const result = await response.json();
    return result.imageUrl;
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

  // Hover state management for interactive elements
  const [isHovered, setIsHovered] = createSignal(false);

  // Drag state to prevent hover flashing during drag operations
  const [isDragging, setIsDragging] = createSignal(false);

  // Touch device detection for alternative interaction patterns
  const [isTouchDevice, setIsTouchDevice] = createSignal(false);

  // Inline prompt editing state
  const [isEditingPrompt, setIsEditingPrompt] = createSignal(false);
  const [editingPromptValue, setEditingPromptValue] = createSignal('');



  // Ref for the native input element
  let inlineEditInputRef: HTMLInputElement | undefined;

  // Initialize touch device detection
  const checkTouchDevice = () => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  };

  // Hover event handlers
  const handleMouseEnter = () => {
    if (!isTouchDevice() && !isDragging()) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isTouchDevice() && !isDragging()) {
      setIsHovered(false);
    }
  };

  // Touch device tap handler for revealing controls
  const handleTouchTap = () => {
    if (isTouchDevice() && hasImage()) {
      setIsHovered(!isHovered());
    }
  };

  // Simple key handler for Enter key in inputs
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isEditingPrompt()) {
      e.preventDefault();
      handleGenerate();
    }
  };

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
        let inputImageUrl = getInputImage();

        if (!inputImageUrl) {
          toast.error('Edit agents need an input image. Upload one or connect to a generator agent.');
          setIsLocallyGenerating(false);
          return;
        }

        // If we have a local file, upload it first
        if (localImageFile() && localImageUrl() === inputImageUrl) {
          try {
            inputImageUrl = await uploadFileToR2(localImageFile()!);
            
            // Update agent with uploaded image URL for future use
            await convexClient.mutation(convexApi.agents.updateAgentUploadedImage, {
              agentId: agentId as any,
              uploadedImageUrl: inputImageUrl,
            });

            // Clean up local file references
            URL.revokeObjectURL(localImageUrl()!);
            setLocalImageFile(null);
            setLocalImageUrl(null);
          } catch (error) {
            console.error('Failed to upload image:', error);
            const errorMessage = error instanceof Error ? error.message : 'Upload failed';
            toast.error(`Failed to upload image: ${errorMessage}`);
            setIsLocallyGenerating(false);
            return;
          }
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

  // Inline prompt editing handlers
  const handleStartInlineEdit = () => {
    setEditingPromptValue(localPrompt());
    setIsEditingPrompt(true);
    // Focus the input after it's rendered
    setTimeout(() => {
      inlineEditInputRef?.focus();
    }, 10);
  };

  const handleSaveInlineEdit = () => {
    const newPrompt = editingPromptValue().trim();
    if (newPrompt) {
      setLocalPrompt(newPrompt);
      props.onPromptChange?.(agentId, newPrompt);
    }
    setIsEditingPrompt(false);
  };

  const handleCancelInlineEdit = () => {
    setEditingPromptValue(localPrompt());
    setIsEditingPrompt(false);
  };

  const handleInlineEditKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveInlineEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelInlineEdit();
    }
  };



  // Agent size - use props.size directly to avoid circular dependency
  const agentSize = () => props.size || { width: 320, height: 384 };

  // Initialize touch device detection on component mount
  checkTouchDevice();

  // Handle drag end globally to reset drag state and prevent hover flashing
  const handleGlobalMouseUp = () => {
    if (isDragging()) {
      setIsDragging(false);
      // Small delay to prevent immediate hover state changes after drag
      setTimeout(() => {
        setIsHovered(false);
      }, 150);
    }
  };

  // Add global event listeners for drag end detection
  if (typeof window !== 'undefined') {
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('dragend', handleGlobalMouseUp);
  }

  return (
    <ErrorBoundary>
      <Card
        class={cn(
          "flex flex-col relative transition-all duration-300 cursor-move overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/50",
          isLoading() ? "border border-secondary/50" : "",
          props.class
        )}
        style={{
          width: `${agentSize().width}px`,
          height: `${agentSize().height}px`
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleTouchTap}

      >
        {/* Drag Handle - Larger clickable area */}
        <div
          class="w-full h-8 bg-muted/30 cursor-move active:cursor-move rounded-t-lg hover:bg-muted/60 hover:border-primary/20 transition-all duration-200 flex items-center justify-between px-3 border-b border-muted/40 flex-shrink-0 z-20"
          title="Drag to move this agent"
          onMouseDown={(e) => {
            setIsDragging(true);
            props.onMouseDown?.(e);
          }}
        >
          <div class="flex items-center gap-2">
            <Icon
              name={props.type === 'image-edit' ? 'edit' : 'image'}
              class="h-4 w-4 text-muted-foreground/60"
            />
            <span class="text-xs text-muted-foreground/60 capitalize">
              {props.type === 'image-edit' ? 'Edit' : 'Generate'}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <Show when={props.userName}>
              <span class="text-xs text-muted-foreground/40">{props.userName}</span>
            </Show>
            {/* Delete button for empty agents */}
            <Show when={!hasImage() && props.onRemove}>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e: Event) => {
                  e.stopPropagation();
                  props.onRemove?.(agentId);
                }}
                class="h-6 w-6 p-0 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                title="Delete agent"
              >
                <Icon name="x" class="h-3 w-3" />
              </Button>
            </Show>
          </div>
        </div>

        {/* Conditional layout: Full image or traditional content */}
        <Show when={hasImage()} fallback={
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
                      class="flex-1 cursor-text text-base"
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
                      <div class="w-full h-32 border-2 border-muted-foreground/30 rounded-lg overflow-hidden mb-3 relative">
                        <img
                          src={getInputImage()!}
                          alt="Input image"
                          class="w-full h-full object-cover"
                        />
                        {/* Show indicator for local files that haven't been uploaded */}
                        <Show when={localImageFile()}>
                          <div class="absolute top-1 right-1 bg-blue-500 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
                            <Icon name="clock" class="h-3 w-3" />
                            Local
                          </div>
                        </Show>
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
          </CardContent>
        }>
          {/* Full-image layout when image is present */}
          <div class="relative flex-1 overflow-hidden">
            {/* Generated image fills entire container */}
            <img
              src={props.generatedImage}
              alt="Generated image"
              class="absolute inset-0 w-full h-full object-cover"
              style={{
                opacity: isLoading() ? 0.3 : 1,
                transition: "opacity 300ms ease"
              }}
            />

            {/* Model Selection Overlay - slides up from bottom when editing */}
            <Show when={props.type !== 'image-edit' && !isLoading()}>
              <div class="absolute bottom-14 left-2 right-20 z-20 pointer-events-none">
                <div
                  data-model-selection
                  class={cn(
                    "bg-black/90 border border-white/20 rounded-md px-3 py-0 h-8 transform transition-all duration-150 ease-in-out",
                    isEditingPrompt() ? "pointer-events-auto" : "pointer-events-none"
                  )}
                  style={{
                    transform: isEditingPrompt() ? 'translateY(0)' : 'translateY(calc(100% + 8px))',
                    opacity: isEditingPrompt() ? 1 : 0
                  }}
                >
                  <div class="flex h-full -mx-3">
                    <Button
                      variant={selectedModel() === 'normal' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setSelectedModel('normal')}
                      class={cn(
                        "flex-1 text-xs text-white hover:bg-white/10 h-full min-w-0 rounded-l-md rounded-r-none",
                        selectedModel() === 'normal'
                          ? "bg-white/20"
                          : "bg-transparent"
                      )}
                    >
                      Normal
                    </Button>
                    <Button
                      variant={selectedModel() === 'pro' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setSelectedModel('pro')}
                      class={cn(
                        "flex-1 text-xs !text-white hover:bg-white/10 h-full min-w-0 rounded-r-md rounded-l-none",
                        selectedModel() === 'pro'
                          ? "bg-white/20"
                          : "bg-transparent"
                      )}
                    >
                      Pro
                    </Button>
                  </div>
                </div>
              </div>
            </Show>

            {/* Image Selection for Edit Agents - slides up from bottom when editing */}
            <Show when={props.type === 'image-edit' && (props.uploadedImageUrl || props.connectedAgentId) && !isLoading()}>
              <div class="absolute bottom-14 left-2 right-20 z-20 pointer-events-none">
                <div
                  class={cn(
                    "bg-black/90 border border-white/20 rounded-md px-3 py-2 transform transition-all duration-150 ease-in-out",
                    isEditingPrompt() ? "pointer-events-auto" : "pointer-events-none"
                  )}
                  style={{
                    transform: isEditingPrompt() ? 'translateY(0)' : 'translateY(calc(100% + 8px))',
                    opacity: isEditingPrompt() ? 1 : 0
                  }}
                >
                  <div class="text-xs font-medium mb-2 text-center text-white">Choose input for next edit:</div>
                  <div class="flex gap-2">
                    <Button
                      variant={getInputImage() === props.uploadedImageUrl ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSelectImage(props.uploadedImageUrl!)}
                      class="flex-1 text-xs !text-white bg-white/10 border-white/20 hover:bg-white/20"
                    >
                      Original
                    </Button>
                    <Button
                      variant={getInputImage() === props.generatedImage ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSelectImage(props.generatedImage!)}
                      class="flex-1 text-xs !text-white bg-white/10 border-white/20 hover:bg-white/20"
                    >
                      Generated
                    </Button>
                  </div>
                </div>
              </div>
            </Show>

            {/* Action Buttons Overlay - fades in on hover */}
            <div
              class={cn(
                "absolute bottom-14 right-2 z-20 flex gap-1 transition-opacity duration-200 motion-reduce:transition-none",
                isHovered() && !isLoading() && !props.isDragged && !props.isRecentlyDragged ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >

              <Button
                variant="secondary"
                size="sm"
                onClick={handleRegenerate}
                class="flex items-center justify-center bg-black/90 hover:bg-black text-white border-white/20 h-8 w-8 p-0 font-mono text-lg leading-none"
                disabled={isLoading()}
                aria-label="Regenerate image"
                title="Regenerate image"
                style={{ "font-feature-settings": '"liga" off' }}
              >
                ↻
              </Button>
              <Show when={props.onRemove}>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => props.onRemove?.(agentId)}
                  class="flex items-center justify-center bg-red-600/90 hover:bg-red-600 text-white border-red-400/20 h-8 w-8 p-0 font-mono text-lg leading-none"
                  aria-label="Remove agent"
                  title="Remove agent"
                  style={{ "font-feature-settings": '"liga" off' }}
                >
                  ×
                </Button>
              </Show>
            </div>



            {/* Prompt Overlay - positioned at bottom with semi-transparent background */}
            <div class="absolute bottom-0 left-0 right-0 z-10">
              <div class="bg-black/80 text-white px-2 py-2 gap-1 rounded-t-lg">
                <Show when={!isEditingPrompt()} fallback={
                  <div class="flex gap-1 items-center">
                    <input
                      ref={inlineEditInputRef}
                      value={editingPromptValue()}
                      onInput={(e) => setEditingPromptValue(e.currentTarget.value)}
                      onKeyDown={handleInlineEditKeyDown}
                      class="flex-1 bg-white/10 border border-white/20 text-base text-white placeholder:text-white/60 px-3 py-1 rounded-md focus:outline-none focus:ring-1 focus:ring-white/40"
                      placeholder="Enter your prompt..."
                      autofocus
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveInlineEdit}
                      class="flex items-center justify-center !text-white bg-inherit hover:bg-background/10 h-8 w-8 p-0 font-mono text-lg leading-none"
                      style={{ "font-feature-settings": '"liga" off' }}
                    >
                      ✓
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelInlineEdit}
                      class="flex items-center justify-center !text-red-500 bg-inherit hover:bg-background/10 h-8 w-8 p-0 font-mono text-lg leading-none"
                      style={{ "font-feature-settings": '"liga" off' }}
                    >
                      ×
                    </Button>
                  </div>
                }>
                  <div class="flex items-center justify-between">
                    <p class="text-sm truncate flex-1">
                      {localPrompt()}
                    </p>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleStartInlineEdit}
                      class={cn(
                        "flex items-center justify-center !text-white bg-inherit hover:bg-background/10 h-8 w-8 p-0 ml-2 transition-opacity duration-200 motion-reduce:transition-none font-mono text-lg leading-none",
                        isHovered() && !isLoading() && !props.isDragged && !props.isRecentlyDragged ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                      )}
                      aria-label="Edit prompt"
                      title="Edit prompt"
                      style={{ "font-feature-settings": '"liga" off' }}
                    >
                      ✎
                    </Button>
                  </div>
                </Show>
              </div>
            </div>

            {/* Loading overlay for full-image layout */}
            <Show when={isLoading()}>
              <div class="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
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
        </Show>

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
