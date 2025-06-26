import { createSignal, Show } from 'solid-js';
import { useGenerateImage } from '~/lib/images-actions';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Icon } from '~/components/ui/icon';
import { toast } from 'solid-sonner';

export function ImageGenerator() {
  const [prompt, setPrompt] = createSignal('');
  const [isAdvancedOpen, setIsAdvancedOpen] = createSignal(false);
  const [model, setModel] = createSignal('@cf/black-forest-labs/flux-1-schnell');
  const [steps, setSteps] = createSignal(4);
  const [seed, setSeed] = createSignal<number | undefined>(undefined);
  const [generatedImage, setGeneratedImage] = createSignal<string | null>(null);
  
  const generateImage = useGenerateImage();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    if (!prompt()) {
      toast.error('Please enter a prompt');
      return;
    }
    
    try {
      const result = await generateImage.mutateAsync({
        prompt: prompt(),
        model: model(),
        steps: steps(),
        seed: seed(),
      });
      
      // Show the generated image immediately
      if (result.image.base64) {
        setGeneratedImage(result.image.base64);
      }
      
      toast.success('Image generated successfully!');
      setPrompt(''); // Clear form after success
    } catch (error) {
      toast.error('Failed to generate image');
      console.error(error);
    }
  };

  const toggleAdvanced = () => setIsAdvancedOpen(!isAdvancedOpen());
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate an Image</CardTitle>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} class="space-y-4">
          <div class="space-y-2">
            <label for="prompt" class="text-sm font-medium">
              Prompt
            </label>
            <Input
              id="prompt"
              placeholder="A serene lakeside cabin at sunset with mountains in the background"
              value={prompt()}
              onChange={setPrompt}
              required
            />
          </div>
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleAdvanced}
            class="flex items-center gap-1"
          >
            <Icon name={isAdvancedOpen() ? 'chevronupdown' : 'chevronupdown'} class="h-4 w-4" />
            <span>Advanced Options</span>
          </Button>
          
          <Show when={isAdvancedOpen()}>
            <div class="space-y-4 rounded-md border p-4">
              <div class="space-y-2">
                <label for="model" class="text-sm font-medium">
                  Model
                </label>
                <select
                  id="model"
                  class="w-full rounded-md border px-3 py-2"
                  value={model()}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option value="@cf/black-forest-labs/flux-1-schnell">FLUX.1 Schnell (Fast)</option>
                  <option value="@cf/stabilityai/stable-diffusion-xl-base-1.0">Stable Diffusion XL</option>
                  <option value="@cf/lykon/dreamshaper-8-lcm">DreamShaper 8 LCM</option>
                </select>
              </div>
              
              <div class="space-y-2">
                <label for="steps" class="text-sm font-medium">
                  Steps
                </label>
                <input
                  id="steps"
                  type="number"
                  min={10}
                  max={50}
                  value={steps().toString()}
                  onInput={(e) => setSteps(parseInt((e.target as HTMLInputElement).value, 10))}
                  class="w-full rounded-md border px-3 py-2"
                />
              </div>
              
              <div class="space-y-2">
                <label for="seed" class="text-sm font-medium">
                  Seed (optional)
                </label>
                <input
                  id="seed"
                  type="number"
                  min={0}
                  placeholder="Random seed"
                  value={seed()?.toString() || ''}
                  onInput={(e) => {
                    const value = (e.target as HTMLInputElement).value;
                    setSeed(value ? parseInt(value, 10) : undefined);
                  }}
                  class="w-full rounded-md border px-3 py-2"
                />
              </div>
            </div>
          </Show>
          
          <Button
            type="submit"
            class="w-full"
            disabled={generateImage.isPending}
          >
            {generateImage.isPending ? (
              <>
                <Icon name="loader" class="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Icon name="sparkles" class="mr-2 h-4 w-4" />
                Generate Image
              </>
            )}
          </Button>
        </form>

        {/* Show generated image immediately */}
        <Show when={generatedImage()}>
          <div class="mt-6 pt-6 border-t">
            <h3 class="text-lg font-medium mb-3">Generated Image</h3>
            <div class="rounded-lg overflow-hidden border bg-muted/30">
              <img
                src={generatedImage()!}
                alt="Generated from prompt"
                class="w-full h-auto object-cover"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              class="mt-3"
              onClick={() => setGeneratedImage(null)}
            >
              <Icon name="x" class="mr-1 h-3 w-3" />
              Clear Preview
            </Button>
          </div>
        </Show>
      </CardContent>
    </Card>
  );
}
