import { createSignal, createEffect, on } from 'solid-js';

export interface UseImageCrossfadeOptions {
  transitionDuration?: number;
  onTransitionStart?: () => void;
  onTransitionComplete?: () => void;
}

export function useImageCrossfade(
  imageUrl: () => string | undefined,
  options: UseImageCrossfadeOptions = {}
) {
  const { transitionDuration = 200, onTransitionStart, onTransitionComplete } = options;
  
  const [isPreloading, setIsPreloading] = createSignal(false);
  const [activeImageUrl, setActiveImageUrl] = createSignal<string | undefined>(imageUrl());
  const [newImageUrl, setNewImageUrl] = createSignal<string | undefined>(undefined);
  const [isTransitioning, setIsTransitioning] = createSignal(false);
  
  // Computed loading state
  const isLoading = () => isPreloading();
  const hasImage = () => !!activeImageUrl() || !!newImageUrl();

  // Initialize from props on mount
  createEffect(() => {
    const url = imageUrl();
    if (url && !activeImageUrl()) {
      setActiveImageUrl(url);
    }
  });

  // Handle image changes
  createEffect(on(imageUrl, (newUrl, prevUrl) => {
    if (!newUrl) {
      // Image was cleared
      setActiveImageUrl(undefined);
      setNewImageUrl(undefined);
      return;
    }
    
    if (newUrl !== prevUrl && newUrl !== activeImageUrl()) {
      console.log("New image URL received:", newUrl);
      
      // Start preloading the new image
      setIsPreloading(true);
      onTransitionStart?.();
      
      // Preload the new image off-screen
      const img = new Image();
      img.onload = () => {
        console.log("New image loaded, beginning transition");
        
        // Set the new image URL first, before starting transition
        setNewImageUrl(newUrl);
        
        // Start the crossfade transition
        requestAnimationFrame(() => {
          setIsTransitioning(true);
          
          // After transition completes, update the active image and reset
          setTimeout(() => {
            setActiveImageUrl(newUrl);
            setNewImageUrl(undefined);
            setIsTransitioning(false);
            setIsPreloading(false);
            onTransitionComplete?.();
            console.log("Transition complete");
          }, transitionDuration);
        });
      };
      
      img.onerror = () => {
        console.error("Failed to load image:", newUrl);
        setNewImageUrl(undefined);
        setIsPreloading(false);
      };
      
      img.src = newUrl;
    }
  }, { defer: true }));

  return {
    activeImageUrl,
    newImageUrl,
    isTransitioning,
    isLoading,
    hasImage,
  };
}
