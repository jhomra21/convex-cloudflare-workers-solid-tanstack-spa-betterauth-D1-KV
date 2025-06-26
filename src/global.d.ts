import 'solid-js';

declare module 'solid-js' {
  namespace JSX {
    interface AudioHTMLAttributes<T> {
      playsinline?: boolean;
    }
  }
}
