import type { Component } from 'solid-js';

const Footer: Component = () => {
  return (
    <footer class="mt-20 sm:mt-auto py-3 shadow-md border border-b-stone-300 border-t-stone-100 backdrop-blur-sm p-10
                   rounded-lg w-full
                   bg-gradient-to-b from-stone-50 to-stone-200">
      <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div class="text-sm text-muted-foreground">
          Built by juan
        </div>
        <div class="flex items-center gap-4">
          <a 
            href="https://github.com/jhomra21" 
            target="_blank" 
            rel="noopener noreferrer"
            class="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            GitHub @jhomra21
          </a>
          <div class="w-1 h-1 rounded-full bg-muted-foreground/50"></div>
          <a 
            href="https://twitter.com/jhomra21" 
            target="_blank" 
            rel="noopener noreferrer"
            class="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Twitter @jhomra21
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 