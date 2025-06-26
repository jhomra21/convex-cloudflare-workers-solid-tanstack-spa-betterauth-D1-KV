import type { Component } from 'solid-js';

const NotFound: Component = () => {
  // This component will be rendered for any route that is not found.
  // We return null because we don't want to show anything,
  // especially for the auth callback which is handled in the background.
  return null;
};

export default NotFound; 