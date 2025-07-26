import { createSignal, createUniqueId, Show, For, onCleanup } from 'solid-js';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Icon } from '~/components/ui/icon';
import { Slider, SliderTrack, SliderFill, SliderThumb } from '~/components/ui/slider';
import { toast } from 'solid-sonner';
import { cn } from '~/lib/utils';
import { useAgentPromptState, useAgentVoiceState, useAgentExaggerationState, useAgentCustomAudioState, useAgentEditModeState } from '~/lib/hooks/use-persistent-state';
import { useStableStatus } from '~/lib/hooks/use-stable-props';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { VoiceSelector } from '~/components/VoiceSelector';
import { useConvexMutation, convexApi } from '~/lib/convex';
import type { VoiceOption, AgentStatus } from '~/types/agents';

export interface VoiceAgentProps {
    id?: string;
    userName?: string;
    prompt?: string;
    onRemove?: (id: string) => void;
    onMouseDown?: (e: MouseEvent) => void;
    size?: { width: number; height: number };
    onResizeStart?: (e: MouseEvent, handle: string) => void;
    onSizeChange?: (id: string, size: { width: number; height: number }) => void;
    generatedAudio?: string;
    voice?: VoiceOption;
    audioSampleUrl?: string;

    onPromptChange?: (id: string, prompt: string) => void;
    status?: AgentStatus;
    model?: 'normal' | 'pro';
    type?: 'voice-generate';
    connectedAgentId?: string;
    class?: string;
}

export function VoiceAgent(props: VoiceAgentProps) {
    const agentId = props.id || createUniqueId();

    // Use persistent state hooks for agent settings
    const [localPrompt, setLocalPrompt] = useAgentPromptState(agentId, props.prompt || '');
    const [selectedVoice, setSelectedVoice] = useAgentVoiceState(agentId, props.voice || 'Aurora');
    const [exaggeration, setExaggeration] = useAgentExaggerationState(agentId, 1.5);
    const [customAudioUrl, setCustomAudioUrl] = useAgentCustomAudioState(agentId, props.audioSampleUrl || '');
    const [isInEditMode, setIsInEditMode] = useAgentEditModeState(agentId, false);

    const [isLocallyGenerating, setIsLocallyGenerating] = createSignal(false);
    const [isResizingForEdit, setIsResizingForEdit] = createSignal(false);
    let resizeTimeoutId: number | undefined;

    // Cleanup timeout on component unmount
    onCleanup(() => {
        if (resizeTimeoutId) {
            window.clearTimeout(resizeTimeoutId);
        }
    });

    // Use stable status to prevent flicker
    const stableStatus = useStableStatus(() => props.status);

    // Convex mutation hook for better error handling
    const updateAgentStatusMutation = useConvexMutation(convexApi.agents.updateAgentStatus);

    // Combined loading state: local generating OR backend processing OR resizing for edit
    const isLoading = () => isLocallyGenerating() || stableStatus().isProcessing || isResizingForEdit();
    const hasFailed = () => stableStatus().isFailed;
    const isSuccess = () => stableStatus().isSuccess;
    const hasAudio = () => !!props.generatedAudio;

    const handleGenerateVoice = async () => {
        const currentPrompt = localPrompt().trim();
        if (!currentPrompt) {
            toast.error('Please enter text to generate speech');
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
            const response = await fetch('/api/voice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: currentPrompt,
                    voice: customAudioUrl() ? undefined : selectedVoice(),
                    audioSampleUrl: customAudioUrl() || undefined,
                    exaggeration: exaggeration(),
                    model: props.model || 'normal',
                    agentId,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate voice');
            }

            toast.success('Voice generation started! Please wait...');
            setIsInEditMode(false);
        } catch (error) {
            console.error('Voice generation error:', error as Error);
            toast.error((error as Error).message || 'Failed to generate voice');
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
        // Set edit mode first - this persists across re-renders
        setIsInEditMode(true);
        
        // Check if current size is too small for edit mode and resize if needed
        const currentSize = props.size || { width: 320, height: 384 };
        const minEditWidth = 320;
        const minEditHeight = 460; // Enough for all edit controls

        const needsResize = props.onSizeChange && (currentSize.width < minEditWidth || currentSize.height < minEditHeight);
        
        if (needsResize) {
            setIsResizingForEdit(true);
            const newSize = {
                width: Math.max(currentSize.width, minEditWidth),
                height: Math.max(currentSize.height, minEditHeight)
            };
            props.onSizeChange?.(agentId, newSize);

            // Clear the resizing state after animation
            resizeTimeoutId = window.setTimeout(() => {
                setIsResizingForEdit(false);
            }, 500);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleGenerateVoice();
        }
    };

    // Agent size - use props.size directly to avoid circular dependency
    const agentSize = () => {
        // Always use props.size if available (user has manually resized)
        if (props.size) return props.size;

        // Default size for new agents
        const baseWidth = 320;
        const baseHeight = 384;

        return { width: baseWidth, height: baseHeight };
    };

    return (
        <ErrorBoundary>
            <Card
                class={cn(
                    "flex flex-col relative transition-all duration-500 ease-out cursor-move",
                    isLoading() ? "border border-secondary/50" : "",
                    props.class
                )}
                style={{
                    width: `${agentSize().width}px`,
                    height: `${agentSize().height}px`,
                    "min-height": isInEditMode() ? "460px" : "350px"
                }}
            >
                {/* Drag Handle - Larger clickable area */}
                <div
                    class="w-full h-8 bg-muted/30 cursor-move active:cursor-move rounded-t-lg hover:bg-muted/60 hover:border-primary/20 transition-all duration-200 flex items-center justify-between px-3 border-b border-muted/40 flex-shrink-0 z-20"
                    title="Drag to move this agent"
                    onMouseDown={props.onMouseDown}
                >
                    <div class="flex items-center gap-2">
                        <Icon
                            name="mic"
                            class="h-4 w-4 text-muted-foreground/60"
                        />
                        <span class="text-xs text-muted-foreground/60 capitalize">
                            Voice
                        </span>
                    </div>
                    <Show when={props.userName}>
                        <span class="text-xs text-muted-foreground/40">{props.userName}</span>
                    </Show>
                </div>

                <CardContent class="p-4 flex flex-col h-full relative" style="pointer-events: auto;">
                    {/* Single Delete Button - Top right when no audio, with action buttons when audio exists */}
                    <Show when={!isLoading() && props.onRemove && !hasAudio()}>
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

                    {/* Prompt Section - Only show when no audio OR explicitly in edit mode */}
                    <Show when={!hasAudio() || isInEditMode()}>
                        <div class="flex-1 flex flex-col relative">
                            
                            <div class="space-y-2 flex-1">
                                {/* Voice Selection - More compact */}
                                <div class="flex items-center gap-2">
                                    <div class="text-xs text-muted-foreground min-w-[40px]">Voice:</div>
                                    <VoiceSelector
                                        selectedVoice={selectedVoice() as VoiceOption}
                                        onVoiceChange={(voice) => setSelectedVoice(voice)}
                                        customAudioUrl={customAudioUrl()}
                                        disabled={isLoading()}
                                    />
                                </div>

                                {/* Custom Audio URL (Optional) - More compact */}
                                <Input
                                    value={customAudioUrl()}
                                    onChange={setCustomAudioUrl}
                                    placeholder="Optional: Custom voice audio URL"
                                    class="text-xs h-8"
                                    disabled={isLoading()}
                                />

                                {/* Exaggeration Slider - More compact */}
                                <div class="space-y-1">
                                    <div class="flex items-center justify-between">
                                        <label class="text-xs text-muted-foreground">Exaggeration:</label>
                                        <span class="text-xs text-muted-foreground font-mono">{exaggeration().toFixed(2)}</span>
                                    </div>
                                    <Slider
                                        value={[exaggeration()]}
                                        onChange={(value) => setExaggeration(value[0])}
                                        minValue={0.25}
                                        maxValue={2.0}
                                        step={0.05}
                                        disabled={isLoading()}
                                        class="w-full"
                                    >
                                        <SliderTrack>
                                            <SliderFill />
                                        </SliderTrack>
                                        <SliderThumb />
                                    </Slider>
                                    <div class="flex justify-between text-xs text-muted-foreground/60">
                                        <span>Subtle</span>
                                        <span>Dramatic</span>
                                    </div>
                                </div>

                                {/* Text Input - More compact */}
                                <Input
                                    multiline
                                    value={localPrompt()}
                                    onChange={handlePromptChange}
                                    onBlur={handleBlur}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Enter text to convert to speech..."
                                    inputClass="min-h-[45px] resize-none text-sm"
                                    disabled={isLoading()}
                                />

                                {/* Action buttons - Generate, Cancel, and Delete */}
                                <div class="flex gap-2">
                                    <Button
                                        onClick={handleGenerateVoice}
                                        class="flex-1 h-9"
                                        disabled={isLoading() || !localPrompt().trim()}
                                    >
                                        <Show when={isLoading()} fallback={
                                            <>
                                                <Icon name="mic" class="w-4 h-4 mr-2" />
                                                Generate Speech
                                            </>
                                        }>
                                            <Icon name="loader" class="w-4 h-4 mr-2 animate-spin" />
                                            Generating...
                                        </Show>
                                    </Button>

                                    {/* Cancel button - only show if we have existing audio */}
                                    <Show when={hasAudio()}>
                                        <Button
                                            variant="outline"
                                            onClick={() => setIsInEditMode(false)}
                                            class="h-9 px-3"
                                            disabled={isLoading()}
                                        >
                                            Cancel
                                        </Button>
                                    </Show>


                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* Generated Audio Display - Hide when in edit mode */}
                    <Show when={hasAudio() && isSuccess() && !isInEditMode()}>
                        <div class="flex-1 flex flex-col relative">
                            {/* Audio Info */}
                            <div class="mb-3">
                                <p class="text-xs text-muted-foreground mb-1">Generated Audio:</p>
                                <p class="text-xs text-muted-foreground/80">
                                    Voice: {selectedVoice()}
                                    <Show when={customAudioUrl()}>
                                        {" (Custom)"}
                                    </Show>
                                    <br />
                                    Exaggeration: {exaggeration().toFixed(2)}
                                </p>
                            </div>

                            {/* Audio Player */}
                            <div class="bg-muted/30 rounded-lg p-3 mb-3 relative">
                                <audio
                                    controls
                                    class="w-full cursor-default"
                                    preload="none"
                                >
                                    <source src={props.generatedAudio} type="audio/wav" />
                                    Your browser does not support the audio element.
                                </audio>


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
                                        if (props.generatedAudio) {
                                            const link = document.createElement('a');
                                            link.href = props.generatedAudio;
                                            link.download = `voice-${Date.now()}.wav`;
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
                                Voice generation failed
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
                    <Show when={isLoading() && !hasAudio()}>
                        <div class="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-20">
                            <Icon name="loader" class="w-8 h-8 animate-spin text-muted-foreground mb-2" />
                            <p class="text-sm text-muted-foreground">
                                {isResizingForEdit() ? "Preparing edit mode..." :
                                    isLocallyGenerating() ? "Starting..." :
                                        stableStatus().isProcessing ? "Generating voice..." : "Loading..."}
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
