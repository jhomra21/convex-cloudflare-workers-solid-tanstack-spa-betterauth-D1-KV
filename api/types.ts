import type { D1Database, KVNamespace, Fetcher, R2Bucket, Ai } from '@cloudflare/workers-types';
import type { betterAuth } from 'better-auth';

// Use the betterAuth type directly instead of inferring from getAuth
type AuthInstance = ReturnType<typeof betterAuth>;

export type Env = {
  ASSETS: Fetcher;
  DB: D1Database;
  SESSIONS: KVNamespace;
  // Optional, dedicated KV for feedback caching (separate from SESSIONS)
  FEEDBACK_CACHE?: KVNamespace;
  convex_cf_workers_images_test: R2Bucket;
  AI: Ai;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  TWITTER_CLIENT_ID: string;
  TWITTER_CLIENT_SECRET: string;
  FAL_KEY: string;
  CONVEX_URL: string;
  NODE_ENV?: string;
};

// Agent type for validated agents in middleware
export type ValidatedAgent = {
  _id: string;
  _creationTime: number;
  canvasId: string;
  userId: string;
  userName?: string;
  prompt: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  voice?: "Aurora" | "Blade" | "Britney" | "Carl" | "Cliff" | "Richard" | "Rico" | "Siobhan" | "Vicky";
  audioSampleUrl?: string;
  requestId?: string;
  model: "normal" | "pro";
  status: "idle" | "processing" | "success" | "failed" | "deleting";
  type: "image-generate" | "image-edit" | "voice-generate" | "video-generate" | "video-image-to-video" | "ai-chat";
  connectedAgentId?: string;
  uploadedImageUrl?: string;
  activeImageUrl?: string;
  createdAt: number;
  updatedAt: number;
};

export type HonoVariables = {
  user: AuthInstance['$Infer']['Session']['user'] | null;
  session: AuthInstance['$Infer']['Session']['session'] | null;
  validatedAgent?: ValidatedAgent;
  parsedBody?: any;
}

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
} 