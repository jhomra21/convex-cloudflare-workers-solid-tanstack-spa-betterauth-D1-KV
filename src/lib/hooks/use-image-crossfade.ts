import { createSignal, createEffect, on } from 'solid-js';

export interface UseImageCrossfadeOptions {
  transitionDuration?: number;
  extendedLoadingDuration?: number; // Extra time to keep loading state during crossfade
  onTransitionStart?: () => void;
  onTransitionComplete?: () => void;
}

export function useImageCrossfade(
  imageUrl: () => string | undefined,
  options: UseImageCrossfadeOptions = {}
) {
  const { 
    transitionDuration = 300, 
    extendedLoadingDuration = 100, // Keep loading a bit longer to cover crossfade
    onTransitionStart, 
    onTransitionComplete 
  } = options;
  
  const [isPreloading, setIsPreloading] = createSignal(false);
  const [activeImageUrl, setActiveImageUrl] = createSignal<string | undefined>(imageUrl());
  const [newImageUrl, setNewImageUrl] = createSignal<string | undefined>(undefined);
  const [isTransitioning, setIsTransitioning] = createSignal(false);
  const [extendedLoading, setExtendedLoading] = createSignal(false);
  
  // Computed loading state - includes preloading AND extended loading during crossfade
  const isLoading = () => isPreloading() || extendedLoading();
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
      setIsPreloading(false);
      setExtendedLoading(false);
      return;
    }
    
    if (newUrl !== prevUrl && newUrl !== activeImageUrl()) {
      console.log("🖼️ New image URL received, starting crossfade:", newUrl);
      
      // Start preloading the new image
      setIsPreloading(true);
      onTransitionStart?.();
      
      // Preload the new image off-screen
      const img = new Image();
      img.onload = () => {
        console.log("📥 New image preloaded, beginning crossfade transition");
        
        // Image is ready, now set up the crossfade
        setNewImageUrl(newUrl);
        setIsPreloading(false); // Stop showing "Generating..." 
        setExtendedLoading(true); // But keep loading overlay to hide transition
        
        // Start the crossfade transition after a brief delay
        requestAnimationFrame(() => {
          setIsTransitioning(true);
          
          // After transition completes, clean up
          setTimeout(() => {
            console.log("✨ Crossfade transition complete");
            setActiveImageUrl(newUrl);
            setNewImageUrl(undefined);
            setIsTransitioning(false);
            
            // End extended loading a bit after transition to ensure smoothness
            setTimeout(() => {
              setExtendedLoading(false);
              onTransitionComplete?.();
            }, extendedLoadingDuration);
            
          }, transitionDuration);
        });
      };
      
      img.onerror = () => {
        console.error("❌ Failed to load image:", newUrl);
        setNewImageUrl(undefined);
        setIsPreloading(false);
        setExtendedLoading(false);
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
    // Additional state for debugging
    isPreloading: () => isPreloading(),
    isExtendedLoading: () => extendedLoading(),
  };
}
