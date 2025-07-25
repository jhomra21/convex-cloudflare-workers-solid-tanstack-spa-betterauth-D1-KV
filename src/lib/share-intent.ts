/**
 * Simple share intent storage that persists across auth flows
 * Stores share IDs immediately when share links are accessed
 */

const SHARE_INTENT_KEY = 'pending_share_intent';

export interface ShareIntent {
  shareId: string;
  timestamp: number;
}

/**
 * Store a share intent when a share link is accessed
 */
export const storeShareIntent = (shareId: string) => {
  const intent: ShareIntent = {
    shareId,
    timestamp: Date.now()
  };

  try {
    localStorage.setItem(SHARE_INTENT_KEY, JSON.stringify(intent));
  } catch (e) {
    console.warn('Failed to store share intent:', e);
  }
};

/**
 * Retrieve and clear any pending share intent
 */
export const getAndClearShareIntent = (): string | null => {
  try {
    const stored = localStorage.getItem(SHARE_INTENT_KEY);
    if (!stored) {
      return null;
    }

    const intent: ShareIntent = JSON.parse(stored);

    // Check if intent is still valid (within 10 minutes)
    const isExpired = Date.now() - intent.timestamp > 10 * 60 * 1000;
    if (isExpired) {
      localStorage.removeItem(SHARE_INTENT_KEY);
      return null;
    }

    localStorage.removeItem(SHARE_INTENT_KEY);
    return intent.shareId;

  } catch (e) {
    console.warn('Failed to retrieve share intent:', e);
    localStorage.removeItem(SHARE_INTENT_KEY);
    return null;
  }
};

/**
 * Check if there's a current share intent without clearing it
 */
export const hasShareIntent = (): boolean => {
  try {
    const stored = localStorage.getItem(SHARE_INTENT_KEY);
    if (!stored) {
      return false;
    }

    const intent: ShareIntent = JSON.parse(stored);
    const isExpired = Date.now() - intent.timestamp > 10 * 60 * 1000;

    return !isExpired;
  } catch (e) {
    return false;
  }
};
