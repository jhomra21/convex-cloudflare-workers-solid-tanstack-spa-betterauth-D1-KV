import { createSignal, createUniqueId, Show, For } from 'solid-js';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Icon } from '~/components/ui/icon';
import { Slider, SliderTrack, SliderFill, SliderThumb } from '~/components/ui/slider';
import { toast } from 'solid-sonner';
import { cn } from '~/lib/utils';
import { useAgentPromptState, useAgentVoiceState, useAgentExaggerationState, useAgentCustomAudioState } from '~/lib/hooks/use-persistent-state';
import { useStableStatus } from '~/lib/hooks/use-stable-props';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { VoiceSelector } from '~/components/VoiceSelector';
import { useConvexMutation, convexApi } from '~/lib/convex';
import type { VoiceOption } from '~/types/agents';

export interface VoiceAgentProps {
    id?: string;
    userName?: string;
    prompt?: string;
    onRemove?: (id: string) => void;
    onMouseDown?: (e: MouseEvent) => void;
    size?: { width: number; height: number };
    onResizeStart?: (e: MouseEvent, handle: string) => void;
    generatedAudio?: string;
    voice?: VoiceOption;
    audioSampleUrl?: string;

    onPromptChange?: (id: string, prompt: string) => void;
    status?: 'idle' | 'processing' | 'success' | 'failed';
    model?: 'normal' | 'pro';
    type?: 'voice-generate';
    connectedAgentId?: string;
    class?: string;
}

// VOICE_OPTIONS moved to VoiceSelector component

export function VoiceAgent(props: VoiceAgentProps) {
    const agentId = props.id || createUniqueId();

    // Use persistent state hooks for prompt, voice, exaggeration, and custom audio
    const [localPrompt, setLocalPrompt] = useAgentPromptState(agentId, props.prompt || '');
    const [selectedVoice, setSelectedVoice] = useAgentVoiceState(agentId, props.voice || 'Aurora');
    const [exaggeration, setExaggeration] = useAgentExaggerationState(agentId, 1.5);
    const [customAudioUrl, setCustomAudioUrl] = useAgentCustomAudioState(agentId, props.audioSampleUrl || '');
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
            setShowPromptInput(false);
        } catch (error) {
            console.error('Voice generation error:', error as Error);
            toast.error((error as Error).message || 'Failed to generate voice');
        } finally {
            setIsLocallyGenerating(false);
        }
    };

    // handlePromptSubmit removed - not needed since we use onKeyDown

    const handlePromptChange = (value: string) => {
        setLocalPrompt(value); // This automatically persists via the hook
    };

    // Only sync to canvas when user finishes editing
    const handleBlur = () => {
        props.onPromptChange?.(agentId, localPrompt());
    };



    // Voice change is now handled directly in VoiceSelector

    const handleEditPrompt = () => {
        setShowPromptInput(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleGenerateVoice();
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
                    {/* Action Buttons Overlay - Only show when there's no audio or we're in prompt input mode */}
                    <Show when={!isLoading() && props.onRemove && (!hasAudio() || showPromptInput())}>
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
                        <Show when={showPromptInput() || !hasAudio()}>
                            <div class="space-y-2">
                                {/* Voice Selection */}
                                <div class="flex items-center gap-2">
                                    <div class="text-xs text-muted-foreground">Voice:</div>
                                    <VoiceSelector
                                        selectedVoice={selectedVoice() as VoiceOption}
                                        onVoiceChange={(voice) => setSelectedVoice(voice)}
                                        customAudioUrl={customAudioUrl()}
                                        disabled={isLoading()}
                                    />
                                </div>

                                {/* Custom Audio URL (Optional) */}
                                <Input
                                    value={customAudioUrl()}
                                    onChange={setCustomAudioUrl}
                                    placeholder="Optional: Custom voice audio URL"
                                    class="text-xs"
                                    disabled={isLoading()}
                                />

                                {/* Exaggeration Slider */}
                                <div class="space-y-2">
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
                                        <span>Subtle (0.25)</span>
                                        <span>Dramatic (2.0)</span>
                                    </div>
                                </div>

                                <Input
                                    multiline
                                    value={localPrompt()}
                                    onChange={handlePromptChange}
                                    onBlur={handleBlur}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Enter text to convert to speech..."
                                    inputClass="min-h-[60px] resize-none"
                                    disabled={isLoading()}
                                />

                                <Button
                                    onClick={handleGenerateVoice}
                                    class="w-full"
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
                            </div>
                        </Show>
                    </div>

                    {/* Generated Audio Display */}
                    <Show when={hasAudio() && isSuccess()}>
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

                                {/* Action Buttons Overlay - removed to prevent overlap */}
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
                                {/* Add delete button here when audio is shown */}
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
                                Generating voice...
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
