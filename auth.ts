import { betterAuth } from "better-auth";
import { D1Dialect } from "kysely-d1";
import type { D1Database, KVNamespace } from "@cloudflare/workers-types";

// Define the environment variables required by the application
type Env = {
    DB: D1Database;
    SESSIONS: KVNamespace; // Kept in type in case other parts of the app use it, but auth won't.
    BETTER_AUTH_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
}

// Cache the auth instance to avoid re-initialization on every request in a warm worker
let cachedAuth: ReturnType<typeof betterAuth> | null = null;

export const getAuth = (env: Env) => {
    // In local dev, env bindings can be undefined on initial server startup.
    // We only cache the auth instance if it's created with a valid environment.
    const isEnvValid = env.DB && typeof env.DB.prepare === 'function' && env.SESSIONS;

    // If the environment is valid and we have a cached instance, return it.
    if (isEnvValid && cachedAuth) {
        return cachedAuth;
    }

    // Create a new instance.
    const authInstance = betterAuth({
        secret: env.BETTER_AUTH_SECRET,
        database: {
            dialect: new D1Dialect({ database: env.DB }),
            type: "sqlite"
        },
        emailAndPassword: { 
            enabled: false, // Disabled due to worker free tier CPU limits and password hashing.
        },
        user: {
            deleteUser: {
                enabled: true
            }
        },
        secondaryStorage: {
            get: async (key) => await env.SESSIONS.get(key),
            set: async (key, value, ttl) => {
                await env.SESSIONS.put(key, value, { expirationTtl: ttl });
            },
            delete: async (key) => await env.SESSIONS.delete(key),
        },
        socialProviders: {
            google: {
                prompt: "select_account",
                clientId: env.GOOGLE_CLIENT_ID,
                clientSecret: env.GOOGLE_CLIENT_SECRET,
            }
        }
    });

    // If the environment was valid, cache this new instance for subsequent requests.
    if (isEnvValid) {
        cachedAuth = authInstance;
    }

    return authInstance;
};
