import { createSignal, createUniqueId, Show, For } from 'solid-js';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Icon } from '~/components/ui/icon';
import { toast } from 'solid-sonner';
import { cn } from '~/lib/utils';
import { useAgentPromptState } from '~/lib/hooks/use-persistent-state';
import { useStableStatus } from '~/lib/hooks/use-stable-props';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { useConvexMutation, convexApi } from '~/lib/convex';
import type { AgentStatus, AvailableAgent } from '~/types/agents';

export interface VideoAgentProps {
    id?: string;
    userName?: string;
    prompt?: string;
    onRemove?: (id: string) => void;
    onMouseDown?: (e: MouseEvent) => void;
    size?: { width: number; height: number };
    onResizeStart?: (e: MouseEvent, handle: string) => void;
    generatedVideo?: string;
    onPromptChange?: (id: string, prompt: string) => void;
    status?: AgentStatus;
    model?: 'normal' | 'pro';
    type?: 'video-generate' | 'video-image-to-video';
    connectedAgentId?: string;
    class?: string;
    availableAgents?: AvailableAgent[];
    onConnectAgent?: (sourceAgentId: string, targetAgentId: string) => void;
    onDisconnectAgent?: (agentId: string) => void;
}

export function VideoAgent(props: VideoAgentProps) {
    const agentId = props.id || createUniqueId();

    // State for video generation type
    const [videoType, setVideoType] = createSignal<'text-to-video' | 'image-to-video'>('text-to-video');

    // Image upload for image-to-video
    const [isDragOver, setIsDragOver] = createSignal(false);
    const [localImageFile, setLocalImageFile] = createSignal<File | null>(null);
    const [localImageUrl, setLocalImageUrl] = createSignal<string | null>(null);

    const handleImageUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }
        if (localImageUrl()) {
            URL.revokeObjectURL(localImageUrl()!);
        }
        const objectUrl = URL.createObjectURL(file);
        setLocalImageFile(file);
        setLocalImageUrl(objectUrl);
        if (localImageUrl()) {
            setVideoType('image-to-video');
        } else {
            setVideoType('text-to-video');
        }
        toast.success('Image loaded, ready to generate video.');
    };

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

    // Use persistent state hooks for prompt and video settings
    const [localPrompt, setLocalPrompt] = useAgentPromptState(agentId, props.prompt || '');
    const [aspectRatio, setAspectRatio] = createSignal<'16:9' | '9:16' | '1:1'>('16:9');
    // Duration is always 8s for Veo3
    const [negativePrompt, setNegativePrompt] = createSignal('');
    const [enhancePrompt, setEnhancePrompt] = createSignal(true);
    const [generateAudio, setGenerateAudio] = createSignal(false); // Default to false
    const [showPromptInput, setShowPromptInput] = createSignal(!props.prompt);
    const [resolution, setResolution] = createSignal<'720p' | '1080p'>('720p');
    const [isLocallyGenerating, setIsLocallyGenerating] = createSignal(false);

    // Use stable status to prevent flicker
    const stableStatus = useStableStatus(() => props.status);

    // Convex mutation hook for better error handling
    const updateAgentStatusMutation = useConvexMutation(convexApi.agents.updateAgentStatus);

    // Combined loading state: local generating OR backend processing
    const isLoading = () => isLocallyGenerating() || stableStatus().isProcessing;
    const hasFailed = () => stableStatus().isFailed;
    const isSuccess = () => stableStatus().isSuccess;
    const hasVideo = () => !!props.generatedVideo;

    const handleGenerateVideo = async () => {
        const currentPrompt = localPrompt().trim();
        if (!currentPrompt) {
            toast.error('Please enter a prompt to generate video');
            return;
        }

        let requestBody: any;

        if (videoType() === 'image-to-video') {
            let imageUrlToUse: string | null = localImageUrl();

            if (localImageFile()) {
                try {
                    imageUrlToUse = await uploadFileToR2(localImageFile()!);
                    URL.revokeObjectURL(localImageUrl()!); 
                    setLocalImageFile(null);
                    setLocalImageUrl(null);
                } catch (error) {
                    console.error('Failed to upload image:', error);
                    toast.error(`Failed to upload image: ${error instanceof Error ? error.message : 'Upload failed'}`);
                    setIsLocallyGenerating(false);
                    return;
                }
            } else if (!imageUrlToUse) {
                toast.error('Please upload an image for image-to-video generation');
                return;
            }
            
            requestBody = {
                prompt: currentPrompt,
                model: props.model || 'normal',
                duration: '8s',
                generateAudio: generateAudio(),
                agentId,
                imageUrl: imageUrlToUse,
                videoType: videoType(),
            };
        } else {
            requestBody = {
                prompt: currentPrompt,
                model: props.model || 'normal',
                aspectRatio: aspectRatio(),
                duration: '8s',
                negativePrompt: negativePrompt() || undefined,
                enhancePrompt: enhancePrompt(),
                generateAudio: generateAudio(),
                agentId,
                videoType: videoType(),
                resolution: resolution(),
            };
        }

        setIsLocallyGenerating(true);

        // Set status to 'processing' optimistically  
        updateAgentStatusMutation.mutate({
            agentId: agentId as any,
            status: 'processing',
        });

        // Sync prompt with parent before calling mutation
        props.onPromptChange?.(agentId, currentPrompt);

        try {
            const response = await fetch('/api/video', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate video');
            }

            toast.success('Video generation started! This may take a few minutes...');
            setShowPromptInput(false);
        } catch (error) {
            console.error('Video generation error:', error as Error);
            toast.error((error as Error).message || 'Failed to generate video');
        } finally {
            setIsLocallyGenerating(false);
        }
    };

    const handlePromptChange = (value: string) => {
        setLocalPrompt(value); // This automatically persists via the hook
    };

    // Only sync to canvas when user finishes editing
    const handleBlur = () => {
        props.onPromptChange?.(agentId, localPrompt());
    };

    const handleEditPrompt = () => {
        setShowPromptInput(true);
    };

    const handleCancelEdit = () => {
        setShowPromptInput(false);
        // Reset local prompt to the last generated prompt if there's a video
        if (hasVideo() && props.prompt) {
            setLocalPrompt(props.prompt);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleGenerateVideo();
        }
    };

    // Agent size - use props.size directly to avoid circular dependency
    const agentSize = () => props.size || { width: 320, height: 450 };

    return (
        <ErrorBoundary>
            <Card
                class={cn(
                    "flex flex-col relative transition-all duration-300 cursor-move overflow-hidden",
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
                    class="w-full h-8 bg-muted/30 cursor-move active:cursor-move rounded-t-lg hover:bg-muted/60 hover:border-primary/20 transition-all duration-200 flex items-center justify-between px-3 border-b border-muted/40 flex-shrink-0 z-20"
                    title="Drag to move this agent"
                    onMouseDown={props.onMouseDown}
                >
                    <div class="flex items-center gap-2">
                        <Show when={isLoading()} fallback={
                            <Icon
                                name="video"
                                class="h-4 w-4 text-muted-foreground/60"
                            />
                        }>
                            <Icon
                                name="loader"
                                class="h-4 w-4 animate-spin text-muted-foreground/60"
                            />
                        </Show>
                                        <span class="text-xs text-muted-foreground/60 capitalize">
                                            {videoType() === 'image-to-video' ? 'Image to Video' : 'Video'}
                                        </span>
                    </div>
                    <Show when={props.userName}>
                        <span class="text-xs text-muted-foreground/40">{props.userName}</span>
                    </Show>
                </div>

                <CardContent class="p-4 flex flex-col flex-1 overflow-hidden">
                    {/* Prompt Section */}
                    <Show when={showPromptInput() || !hasVideo()}>
                        <div class="flex flex-col justify-between h-full">
                                <div> {/* Top container for controls */}
                                    <textarea
                                        value={localPrompt()}
                                        onInput={(e) => handlePromptChange(e.currentTarget.value)}
                                        onBlur={handleBlur}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Describe the video you want to generate..."
                                        class="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-shadow placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none cursor-text mb-3"
                                        rows={3}
                                        disabled={isLoading()}
                                    />
                                    <div class="flex gap-3">
                                        <div class="flex-1 space-y-3">
                                            <Show when={videoType() === 'text-to-video'}>
                                                <Input
                                                    value={negativePrompt()}
                                                    onInput={(e: Event) => setNegativePrompt((e.target as HTMLInputElement).value)}
                                                    placeholder="Optional: What to avoid in the video"
                                                    class="text-xs cursor-text w-full"
                                                    disabled={isLoading()}
                                                />
                                                <div class="flex items-center justify-between gap-4 text-xs">
                                                    <label class="text-muted-foreground">Aspect Ratio:</label>
                                                    <select
                                                        value={aspectRatio()}
                                                        onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16' | '1:1')}
                                                        class="rounded-md border border-input bg-background px-2 py-1"
                                                        disabled={isLoading()}
                                                    >
                                                        <option value="16:9">16:9</option>
                                                        <option value="9:16">9:16</option>
                                                        <option value="1:1">1:1</option>
                                                    </select>
                                                </div>
                                                <div class="flex items-center justify-between gap-2 text-xs">
                                                    <label class="text-muted-foreground">Resolution:</label>
                                                    <select
                                                        value={resolution()}
                                                        onChange={(e) => setResolution(e.target.value as '720p' | '1080p')}
                                                        class="rounded-md border border-input bg-background px-2 py-1"
                                                        disabled={isLoading()}
                                                    >
                                                        <option value="720p">720p</option>
                                                        <option value="1080p">1080p</option>
                                                    </select>
                                                </div>
                                            </Show>
                                            <div class="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                                                <Icon name="clock" class="w-3 h-3" />
                                                <span>Duration: 8 seconds</span>
                                            </div>
                                        </div>
                                        <div
                                            class="relative flex flex-col items-center justify-center p-2 border-2 border-dashed rounded-md cursor-pointer hover:border-primary/60 transition-colors w-32 h-40 flex-shrink-0"
                                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                            onDragLeave={() => setIsDragOver(false)}
                                            onDrop={handleDrop}
                                            onClick={() => document.getElementById(`file-input-${agentId}`)?.click()}
                                            onMouseDown={(e) => {
                                                // Prevent drag-to-move when clicking on the image upload area
                                                e.stopPropagation();
                                            }}
                                        >
                                            <input id={`file-input-${agentId}`} type="file" class="hidden" accept="image/*" onInput={handleFileInput} />
                                            <Show when={localImageUrl()} fallback={
                                                <div class="text-center text-xs text-muted-foreground">
                                                    <Icon name="upload" class="w-5 h-5 mx-auto mb-1" />
                                                    <p>Drop image or click</p>
                                                </div>
                                            }>
                                                <img src={localImageUrl()!} class="object-cover w-full h-full rounded-md" alt="Uploaded image" />
                                            </Show>
                                        </div>
                                    </div>
                                    <div class="flex items-center justify-between text-xs pt-4">
                                        <Show when={videoType() === 'text-to-video'}>
                                            <label class="flex items-center gap-1">
                                                <input
                                                    type="checkbox"
                                                    checked={enhancePrompt()}
                                                    onChange={(e) => setEnhancePrompt(e.target.checked)}
                                                    disabled={isLoading()}
                                                />
                                                <span>Enhance prompt</span>
                                            </label>
                                        </Show>
                                        <label class="flex items-center gap-1">
                                            <input
                                                type="checkbox"
                                                checked={generateAudio()}
                                                onChange={(e) => setGenerateAudio(e.target.checked)}
                                                disabled={isLoading()}
                                            />
                                            <span>Generate audio</span>
                                        </label>
                                    </div>
                                </div>
                                <div class="flex gap-2 mt-auto pt-3">
                                    <Show when={hasVideo() && isSuccess()}>
                                        <Button
                                            variant="outline"
                                            onClick={handleCancelEdit}
                                            class="flex-1"
                                            disabled={isLoading()}
                                        >
                                            <Icon name="x" class="w-4 h-4 mr-2" />
                                            Cancel
                                        </Button>
                                    </Show>
                                    <Button
                                        onClick={handleGenerateVideo}
                                        class="flex-1"
                                        disabled={isLoading() || !localPrompt().trim()}
                                    >
                                        <Show when={isLoading()} fallback={
                                            <>
                                                <Icon name="video" class="w-4 h-4 mr-2" />
                                                {hasVideo() ? 'Regenerate' : 'Generate Video'}
                                            </>
                                        }>
                                            <Icon name="loader" class="w-4 h-4 mr-2 animate-spin" />
                                            Generating...
                                        </Show>
                                    </Button>
                                    <Show when={props.onRemove && !isLoading()}>
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => props.onRemove?.(agentId)}
                                            title="Delete Agent"
                                        >
                                            <Icon name="trash-2" class="h-4 w-4" />
                                        </Button>
                                    </Show>
                                </div>
                        </div>
                    </Show>

                    {/* Generated Video Display */}
                    <Show when={hasVideo() && isSuccess() && !showPromptInput()}>
                        <div class="flex flex-col h-full">
                            {/* Video Info */}
                            <div class="mb-3">
                                <p class="text-xs text-muted-foreground mb-1">Generated Video:</p>
                                <p class="text-xs text-muted-foreground/80">
                                    {videoType() === 'image-to-video' ? '16:9' : aspectRatio()} • 8 seconds
                                    <Show when={!generateAudio()}>
                                        {" • No audio"}
                                    </Show>
                                </p>
                            </div>

                            {/* Video Player */}
                            <div class="flex-1 bg-muted/30 rounded-lg p-3 mb-3 flex items-center justify-center min-h-0">
                                <video
                                controls
                                class="w-full h-auto max-w-full max-h-[calc(100%-2rem)] rounded cursor-default object-contain"
                                preload="none"
                                style={{
                                "aspect-ratio": aspectRatio() === '16:9' ? '16/9' : 
                                aspectRatio() === '9:16' ? '9/16' : '1/1'
                                }}
                                >
                                    <source src={props.generatedVideo} type="video/mp4" />
                                    Your browser does not support the video element.
                                </video>
                            </div>

                            {/* Action Buttons */}
                            <div class="flex gap-2 flex-shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="flex-1"
                                    onClick={handleEditPrompt}
                                >
                                    <Icon name="edit" class="w-3 h-3 mr-2" />
                                    Edit
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="flex-1"
                                    onClick={() => {
                                        if (props.generatedVideo) {
                                            const link = document.createElement('a');
                                            link.href = props.generatedVideo;
                                            link.download = `video-${Date.now()}.mp4`;
                                            link.click();
                                        }
                                    }}
                                >
                                    <Icon name="download" class="w-3 h-3 mr-2" />
                                    Download
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

                    {/* Error State */}
                    <Show when={hasFailed()}>
                        <div class="flex-1 flex flex-col items-center justify-center text-center">
                            <Icon name="x" class="w-8 h-8 text-destructive mb-2" />
                            <p class="text-sm text-muted-foreground mb-3">
                                Video generation failed
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleEditPrompt}
                            >
                                <Icon name="refresh-cw" class="w-3 h-3 mr-2" />
                                Try Again
                            </Button>
                        </div>
                    </Show>

                    {/* Loading State */}
                    <Show when={isLoading() && !hasVideo()}>
                        <div class="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-20">
                            <Icon name="loader" class="w-8 h-8 animate-spin text-muted-foreground mb-2" />
                            <p class="text-sm text-muted-foreground text-center">
                                Generating video...<br />
                                <span class="text-xs">This may take a few minutes</span>
                            </p>
                        </div>
                    </Show>
                </CardContent>

                {/* Resize Handles - Larger invisible areas for easier grabbing */}
                <Show when={props.onResizeStart}>
                    <For each={[
                        { position: 'nw', cursor: 'nw-resize', class: '-top-2 -left-2' },
                        { position: 'ne', cursor: 'ne-resize', class: '-top-2 -right-2' },
                        { position: 'sw', cursor: 'sw-resize', class: '-bottom-2 -left-2' },
                        { position: 'se', cursor: 'se-resize', class: '-bottom-2 -right-2' },
                        { position: 'n', cursor: 'n-resize', class: '-top-2 left-1/2 -translate-x-1/2' },
                        { position: 's', cursor: 's-resize', class: '-bottom-2 left-1/2 -translate-x-1/2' },
                        { position: 'w', cursor: 'w-resize', class: 'top-1/2 -left-2 -translate-y-1/2' },
                        { position: 'e', cursor: 'e-resize', class: 'top-1/2 -right-2 -translate-y-1/2' },
                    ]}>
                        {(handle) => (
                            <div
                                class={cn(
                                    "absolute w-6 h-6 opacity-0 z-30",
                                    handle.class
                                )}
                                style={{ cursor: handle.cursor }}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    props.onResizeStart?.(e, handle.position);
                                }}
                                title="Resize"
                            />
                        )}
                    </For>
                </Show>
            </Card>
        </ErrorBoundary>
    );
}
