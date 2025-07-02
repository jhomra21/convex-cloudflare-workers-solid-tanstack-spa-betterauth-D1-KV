import { Show, For } from 'solid-js';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import type { VoiceOption } from '~/types/agents';

export interface VoiceSelectorProps {
    selectedVoice: VoiceOption;
    onVoiceChange: (voice: VoiceOption) => void;
    customAudioUrl?: string;
    disabled?: boolean;
}

const VOICE_OPTIONS: VoiceOption[] = [
    'Aurora', 'Blade', 'Britney', 'Carl', 'Cliff', 'Richard', 'Rico', 'Siobhan', 'Vicky'
];

const VOICE_DESCRIPTIONS: Record<VoiceOption, string> = {
    'Aurora': 'Female, warm and friendly',
    'Blade': 'Male, deep and authoritative', 
    'Britney': 'Female, young and energetic',
    'Carl': 'Male, professional and clear',
    'Cliff': 'Male, mature and confident',
    'Richard': 'Male, sophisticated and refined',
    'Rico': 'Male, casual and approachable',
    'Siobhan': 'Female, elegant and articulate',
    'Vicky': 'Female, cheerful and expressive'
};

export function VoiceSelector(props: VoiceSelectorProps) {
    const displayVoice = () => {
        if (props.customAudioUrl) {
            return 'Custom Voice';
        }
        return props.selectedVoice;
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger>
                <Button 
                    variant="outline" 
                    size="sm" 
                    class="flex items-center gap-2 min-w-0"
                    disabled={props.disabled}
                >
                    <Icon
                        name={props.customAudioUrl ? 'upload' : 'mic'}
                        class="h-4 w-4 flex-shrink-0"
                    />
                    <span class="truncate max-w-32">
                        {displayVoice()}
                    </span>
                    <Icon name="chevron-down" class="h-4 w-4 flex-shrink-0" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent class="w-64">
                {/* <DropdownMenuSeparator /> */}

                {/* Preset voices */}
                <For each={VOICE_OPTIONS}>
                    {(voice) => (
                        <DropdownMenuItem
                            class="flex items-center gap-2 cursor-pointer"
                            onClick={() => props.onVoiceChange(voice)}
                        >
                            <Icon name="mic" class="h-4 w-4" />
                            <div class="flex-1 min-w-0">
                                <div class="font-medium truncate">{voice}</div>
                                <div class="text-xs text-muted-foreground">
                                    {VOICE_DESCRIPTIONS[voice]}
                                </div>
                            </div>
                            <Show when={props.selectedVoice === voice && !props.customAudioUrl}>
                                <Icon name="check" class="h-4 w-4 text-primary" />
                            </Show>
                        </DropdownMenuItem>
                    )}
                </For>

                <Show when={props.customAudioUrl}>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel class="text-xs text-muted-foreground">
                        Custom Voice
                    </DropdownMenuLabel>
                    <DropdownMenuItem class="flex items-center gap-2">
                        <Icon name="upload" class="h-4 w-4" />
                        <div class="flex-1 min-w-0">
                            <div class="font-medium truncate">Custom Voice</div>
                            <div class="text-xs text-muted-foreground">Voice cloning active</div>
                        </div>
                        <Icon name="check" class="h-4 w-4 text-primary" />
                    </DropdownMenuItem>
                </Show>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
