import type { D1Database, KVNamespace, Fetcher, R2Bucket, Ai } from '@cloudflare/workers-types';
import type { betterAuth } from 'better-auth';

// Use the betterAuth type directly instead of inferring from getAuth
type AuthInstance = ReturnType<typeof betterAuth>;

export type Env = {
  ASSETS: Fetcher;
  DB: D1Database;
  SESSIONS: KVNamespace;
  convex_cf_workers_images_test: R2Bucket;
  AI: Ai;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  FAL_KEY: string;
  CONVEX_URL: string;
  NODE_ENV?: string;
};

export type HonoVariables = {
  user: AuthInstance['$Infer']['Session']['user'] | null;
  session: AuthInstance['$Infer']['Session']['session'] | null;
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