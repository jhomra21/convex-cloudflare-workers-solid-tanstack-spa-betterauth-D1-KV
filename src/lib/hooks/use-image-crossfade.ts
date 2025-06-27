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
  const { 
    transitionDuration = 300,
    onTransitionStart, 
    onTransitionComplete 
  } = options;
  
  const [isPreloading, setIsPreloading] = createSignal(false);
  const [currentImage, setCurrentImage] = createSignal<string | undefined>(imageUrl());
  const [nextImage, setNextImage] = createSignal<string | undefined>(undefined);
  const [showNext, setShowNext] = createSignal(false);
  
  // Simple loading state
  const isLoading = () => isPreloading();
  const hasImage = () => !!currentImage();

  // Initialize from props on mount
  createEffect(() => {
    const url = imageUrl();
    if (url && !currentImage()) {
      setCurrentImage(url);
    }
  });

  // Handle image changes with simple crossfade
  createEffect(on(imageUrl, (newUrl, prevUrl) => {
    if (!newUrl) {
      // Image was cleared
      setCurrentImage(undefined);
      setNextImage(undefined);
      setShowNext(false);
      setIsPreloading(false);
      return;
    }
    
    if (newUrl !== prevUrl && newUrl !== currentImage()) {
      console.log("🖼️ New image URL received:", newUrl);
      
      // Start preloading
      setIsPreloading(true);
      onTransitionStart?.();
      
      // Preload the new image
      const img = new Image();
      img.onload = () => {
        console.log("📥 Image preloaded, starting crossfade");
        
        // Set up the crossfade
        setNextImage(newUrl);
        setIsPreloading(false);
        
        // Start crossfade after a brief delay
        requestAnimationFrame(() => {
          setShowNext(true);
          
          // After transition, swap images
          setTimeout(() => {
            console.log("✨ Crossfade complete, swapping images");
            setCurrentImage(newUrl);
            setNextImage(undefined);
            setShowNext(false);
            onTransitionComplete?.();
          }, transitionDuration);
        });
      };
      
      img.onerror = () => {
        console.error("❌ Failed to load image:", newUrl);
        setIsPreloading(false);
      };
      
      img.src = newUrl;
    }
  }, { defer: true }));

  return {
    currentImage,
    nextImage,
    showNext,
    isLoading,
    hasImage,
  };
}
