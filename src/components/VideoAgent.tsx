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
    status?: 'idle' | 'processing' | 'success' | 'failed';
    model?: 'normal' | 'pro';
    type?: 'video-generate';
    connectedAgentId?: string;
    class?: string;
}

export function VideoAgent(props: VideoAgentProps) {
    const agentId = props.id || createUniqueId();

    // Use persistent state hooks for prompt and video settings
    const [localPrompt, setLocalPrompt] = useAgentPromptState(agentId, props.prompt || '');
    const [aspectRatio, setAspectRatio] = createSignal<'16:9' | '9:16' | '1:1'>('16:9');
    const [duration, setDuration] = createSignal<'8s'>('8s');
    const [negativePrompt, setNegativePrompt] = createSignal('');
    const [enhancePrompt, setEnhancePrompt] = createSignal(true);
    const [generateAudio, setGenerateAudio] = createSignal(true);
    const [showPromptInput, setShowPromptInput] = createSignal(!props.prompt);
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
                body: JSON.stringify({
                    prompt: currentPrompt,
                    model: props.model || 'normal',
                    aspectRatio: aspectRatio(),
                    duration: duration(),
                    negativePrompt: negativePrompt() || undefined,
                    enhancePrompt: enhancePrompt(),
                    generateAudio: generateAudio(),
                    agentId,
                }),
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
                            Video
                        </span>
                    </div>
                    <Show when={props.userName}>
                        <span class="text-xs text-muted-foreground/40">{props.userName}</span>
                    </Show>
                </div>

                <CardContent class="p-4 flex flex-col h-full relative">
                    {/* Action Buttons Overlay */}
                    <Show when={!isLoading() && props.onRemove && (!hasVideo() || showPromptInput())}>
                        <div class="absolute top-2 right-2 flex gap-1 z-10">
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => props.onRemove?.(agentId)}
                            >
                                <Icon name="x" class="h-3 w-3" />
                            </Button>
                        </div>
                    </Show>

                    {/* Prompt Section */}
                    <div class="flex-shrink-0 mb-4">
                        <Show when={showPromptInput() || !hasVideo()}>
                            <div class="space-y-3">
                                {/* Video Settings */}
                                <div class="grid grid-cols-2 gap-2">
                                    <div class="space-y-1">
                                        <label class="text-xs text-muted-foreground">Aspect Ratio:</label>
                                        <select
                                            value={aspectRatio()}
                                            onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16' | '1:1')}
                                            class="w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                                            disabled={isLoading()}
                                        >
                                            <option value="16:9">16:9 (Landscape)</option>
                                            <option value="9:16">9:16 (Portrait)</option>
                                            <option value="1:1">1:1 (Square)</option>
                                        </select>
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-xs text-muted-foreground">Duration:</label>
                                        <select
                                            value={duration()}
                                            onChange={(e) => setDuration(e.target.value as '8s')}
                                            class="w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                                            disabled={isLoading()}
                                        >
                                            <option value="8s">8 seconds</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Negative Prompt */}
                                <Input
                                    value={negativePrompt()}
                                    onInput={(e: Event) => setNegativePrompt((e.target as HTMLInputElement).value)}
                                    placeholder="Optional: What to avoid in the video"
                                    class="text-xs cursor-text"
                                    disabled={isLoading()}
                                />

                                {/* Toggle Options */}
                                <div class="flex items-center gap-4 text-xs">
                                    <label class="flex items-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={enhancePrompt()}
                                            onChange={(e) => setEnhancePrompt(e.target.checked)}
                                            disabled={isLoading()}
                                        />
                                        <span>Enhance prompt</span>
                                    </label>
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

                                {/* Main Prompt */}
                                <textarea
                                    value={localPrompt()}
                                    onInput={(e) => handlePromptChange(e.currentTarget.value)}
                                    onBlur={handleBlur}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Describe the video you want to generate..."
                                    class="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-shadow placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none cursor-text"
                                    rows={3}
                                    disabled={isLoading()}
                                />

                                <Button
                                    onClick={handleGenerateVideo}
                                    class="w-full"
                                    disabled={isLoading() || !localPrompt().trim()}
                                >
                                    <Show when={isLoading()} fallback={
                                        <>
                                            <Icon name="video" class="w-4 h-4 mr-2" />
                                            Generate Video
                                        </>
                                    }>
                                        <Icon name="loader" class="w-4 h-4 mr-2 animate-spin" />
                                        Generating...
                                    </Show>
                                </Button>
                            </div>
                        </Show>
                    </div>

                    {/* Generated Video Display */}
                    <Show when={hasVideo() && isSuccess()}>
                        <div class="flex-1 flex flex-col relative">
                            {/* Video Info */}
                            <div class="mb-3">
                                <p class="text-xs text-muted-foreground mb-1">Generated Video:</p>
                                <p class="text-xs text-muted-foreground/80">
                                    {aspectRatio()} • {duration()}
                                    <Show when={!generateAudio()}>
                                        {" • No audio"}
                                    </Show>
                                </p>
                            </div>

                            {/* Video Player */}
                            <div class="bg-muted/30 rounded-lg p-3 mb-3 relative flex-1">
                                <video
                                controls
                                class="w-full h-auto max-h-full rounded cursor-default"
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
                            <div class="flex gap-2 mt-auto">
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
                                        <Icon name="x" class="w-3 h-3" />
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
