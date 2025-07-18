import type { D1Database, KVNamespace, Fetcher, R2Bucket, Ai } from '@cloudflare/workers-types';
import { getAuth } from '../auth';

// This is a common pattern to get types from a factory function without executing it.
const authForTypes = getAuth({} as any);

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
    user: typeof authForTypes.$Infer.Session.user | null;
    session: typeof authForTypes.$Infer.Session.session | null;
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