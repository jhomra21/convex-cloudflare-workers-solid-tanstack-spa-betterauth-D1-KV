import { createSignal, Show, createMemo } from 'solid-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Icon } from '~/components/ui/icon';
import { toast } from 'solid-sonner';
import { convexClient, convexApi } from '~/lib/convex';

export interface ShareCanvasDialogProps {
  canvasId?: string;
  canvasName?: string;
  currentShareId?: string;
  isShareable?: boolean;
  children?: any;
}

export function ShareCanvasDialog(props: ShareCanvasDialogProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [shareId, setShareId] = createSignal(props.currentShareId || '');
  
  const shareUrl = createMemo(() => {
    if (!shareId()) return '';
    return `${window.location.origin}/dashboard/images?share=${shareId()}`;
  });
  
  const handleEnableSharing = async () => {
    if (!props.canvasId) return;
    
    setIsLoading(true);
    try {
      const newShareId = await convexClient.mutation(convexApi.canvas.enableCanvasSharing, {
        canvasId: props.canvasId as any,
      });
      
      setShareId(newShareId);
      toast.success('Canvas sharing enabled!');
    } catch (error) {
      console.error('Failed to enable sharing:', error);
      toast.error('Failed to enable sharing');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDisableSharing = async () => {
    if (!props.canvasId) return;
    
    setIsLoading(true);
    try {
      await convexClient.mutation(convexApi.canvas.disableCanvasSharing, {
        canvasId: props.canvasId as any,
      });
      
      setShareId('');
      toast.success('Canvas sharing disabled');
    } catch (error) {
      console.error('Failed to disable sharing:', error);
      toast.error('Failed to disable sharing');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      toast.success('Share link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy link');
    }
  };
  
  return (
    <Dialog open={isOpen()} onOpenChange={setIsOpen}>
      <DialogTrigger>
        {props.children}
      </DialogTrigger>
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="share" class="h-5 w-5" />
            Share Canvas
          </DialogTitle>
        </DialogHeader>
        
        <div class="space-y-4">
          <div>
            <p class="text-sm text-muted-foreground mb-2">
              Sharing: <span class="font-medium">{props.canvasName || 'Canvas'}</span>
            </p>
          </div>
          
          <Show 
            when={shareId()} 
            fallback={
              <div class="text-center space-y-4">
                <p class="text-sm text-muted-foreground">
                  Canvas sharing is currently disabled. Enable sharing to generate a shareable link.
                </p>
                <Button
                  onClick={handleEnableSharing}
                  disabled={isLoading()}
                  class="w-full"
                >
                  <Show when={isLoading()} fallback={<Icon name="share" class="h-4 w-4 mr-2" />}>
                    <Icon name="loader" class="h-4 w-4 mr-2 animate-spin" />
                  </Show>
                  Enable Sharing
                </Button>
              </div>
            }
          >
            <div class="space-y-4">
              <div>
                <label class="text-sm font-medium mb-2 block">Share Link</label>
                <div class="flex gap-2">
                  <Input 
                    value={shareUrl()} 
                    readOnly
                    class="flex-1 font-mono text-sm"
                  />
                  <Button 
                    onClick={handleCopyLink}
                    variant="outline"
                    size="sm"
                  >
                    <Icon name="copy" class="h-4 w-4" />
                  </Button>
                </div>
                <p class="text-xs text-muted-foreground mt-1">
                  Anyone with this link can view and edit your canvas
                </p>
              </div>
              
              <div class="flex gap-2">
                <Button
                  onClick={handleCopyLink}
                  class="flex-1"
                >
                  <Icon name="copy" class="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
                <Button
                  onClick={handleDisableSharing}
                  disabled={isLoading()}
                  variant="outline"
                  class="flex-1"
                >
                  <Show when={isLoading()} fallback={<Icon name="x" class="h-4 w-4 mr-2" />}>
                    <Icon name="loader" class="h-4 w-4 mr-2 animate-spin" />
                  </Show>
                  Disable
                </Button>
              </div>
            </div>
          </Show>
        </div>
      </DialogContent>
    </Dialog>
  );
}
