[![Convex Client Test](https://github.com/jhomra21/convex-cloudflare-workers-solid-tanstack-spa-betterauth-D1-KV/actions/workflows/test.yml/badge.svg?branch=master)](https://github.com/jhomra21/convex-cloudflare-workers-solid-tanstack-spa-betterauth-D1-KV/actions/workflows/test.yml)

# Generative AI Canvas

An open-source, collaborative canvas for generative AI, powered by Cloudflare Workers, SolidJS, and Convex. This application provides a seamless, interactive environment to create, edit, and chain together AI-generated media.

> [!NOTE]
> 🚀 **Live Demo:** Check out the deployed application here: **[convex-workers-solid-tanstack-spa-betterauth-d1-kv.jhonra121.workers.dev](https://convex-workers-solid-tanstack-spa-betterauth-d1-kv.jhonra121.workers.dev/)**

## 🌟 Core Features

-   **🤖 Agentic Chat UI**: Use natural language to drive the canvas. The chat agent understands your intent to create and connect other agents for media generation.
-   **🖼️ Image Generation & Editing**: Create new images from text prompts or edit existing ones. Connect image agents to build complex visual workflows.
-   **🎬 Video Generation**: Generate video clips from text prompts or animate existing images on the canvas.
-   **🎤 Voice Generation (TTS)**: Produce high-quality speech from text using a variety of voices.
-   **✨ Interactive Canvas**: A dynamic, zoomable canvas where you can arrange, connect, and interact with AI agents.
-   **🤝 Real-time Collaboration**: Share your canvas with others to view and collaborate in real-time, powered by Convex.
-   **🔐 Secure Authentication**: User accounts are secured with Google, GitHub, and Twitter OAuth providers via `better-auth`.
-   **📝 Feedback System**: A built-in system for users to submit bug reports and feedback, with an admin-only board to view and manage submissions.

---

## 🛠️ Tech Stack

-   **Frontend**:
    -   [SolidJS](https://www.solidjs.com/) for reactive UI.
    -   [TanStack Router](https://tanstack.com/router/v1/docs/adapters/solid-router) for type-safe, file-based routing.
    -   [TanStack Query](https://tanstack.com/query/latest/docs/solid/overview) for server-state management.
    -   [Tailwind CSS](https://tailwindcss.com/) & [Shadcn-Solid](https://shadcn-solid.com/) for styling.
-   **Backend**:
    -   [Cloudflare Workers](https://workers.cloudflare.com/) for serverless functions at the edge.
    -   [Hono](https://hono.dev/) for the API framework.
-   **Data & State**:
    -   [Convex](https://www.convex.dev/) for the real-time database, managing canvas and agent state.
    -   [Cloudflare D1](https://developers.cloudflare.com/d1/) for user and authentication data.
    -   [Cloudflare R2](https://developers.cloudflare.com/r2/) for image and asset storage.
    -   [Cloudflare KV](https://developers.cloudflare.com/kv/) for session management and caching.
-   **Authentication**:
    -   [better-auth](https://www.better-auth.com/) for handling OAuth and session logic.
-   **AI/ML Services**:
    -   [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) for intent detection and image generation.
    -   [Fal AI](https://www.fal.ai/) for advanced image, video, and voice generation models.

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/jhomra21/convex-cloudflare-workers-solid-tanstack-spa-betterauth-D1-KV.git
cd convex-cloudflare-workers-solid-tanstack-spa-betterauth-D1-KV
```

### 2. Install Dependencies
```bash
bun install
```

### 3. Configure Cloudflare & Convex
-   **Cloudflare**: Set up a D1 database, R2 bucket, and KV namespace. Update `wrangler.jsonc` with your bindings.
-   **Convex**: Create a new Convex project and get your deployment URL.

### 4. Environment Variables
Copy `example.dev.vars` to `.dev.vars` and fill in the required values:
-   `CONVEX_URL`: Your Convex project URL.
-   `BETTER_AUTH_SECRET`: A randomly generated secret for session encryption.
-   `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: For Google OAuth.
-   `GITHUB_CLIENT_ID` & `GITHUB_CLIENT_SECRET`: For GitHub OAuth.
-   `TWITTER_CLIENT_ID` & `TWITTER_CLIENT_SECRET`: For Twitter OAuth.
-   `FAL_KEY`: Your API key from Fal AI.

For production, set these as secrets in your Cloudflare Worker dashboard. You also need to set a build-time variable `VITE_CONVEX_URL` in your Cloudflare Pages build settings.

### 5. Database Migrations
Apply the initial D1 database schema.
```bash
# For local development
bunx wrangler d1 migrations apply <YOUR_DB_NAME> --local

# For production
bunx wrangler d1 migrations apply <YOUR_DB_NAME> --remote
```

### 6. Run Development Server
```bash
bun run dev
```

---

## 📁 Project Structure

-   `api/`: Contains all Hono backend API route handlers (e.g., `images.ts`, `video.ts`, `ai-chat.ts`).
-   `src/`: The SolidJS frontend application.
    -   `src/routes/`: File-based routing via TanStack Router.
    -   `src/components/`: Reusable UI components.
    -   `src/lib/`: Core logic, including auth, Convex client, and state management.
-   `convex/`: The Convex backend functions and schema definition.
-   `wrangler.jsonc`: Configuration for the Cloudflare Worker.
-   `schema.sql`: The SQL schema for the D1 database.

---

## 🌐 API Endpoints

The backend is a Hono application running on a single Cloudflare Worker.

-   `/api/auth/*`: Handles user authentication (login, logout, callbacks) via `better-auth`.
-   `/api/ai-chat/process`: The core endpoint for the canvas chat agent. It analyzes user intent and orchestrates the creation of other agents.
-   `/api/images`: Endpoints for image generation, editing, uploading, and deletion.
-   `/api/video`: Endpoints to trigger asynchronous video generation and receive results via webhooks.
-   `/api/voice`: Endpoints to trigger asynchronous voice generation and receive results via webhooks.
-   `/api/feedback`: Endpoints for submitting and managing user feedback.