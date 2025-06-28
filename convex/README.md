# General Convex Backend Development Guidelines

This document outlines the definitive rules, conventions, and best practices for developing and maintaining a Convex backend. Adhering to these guidelines is crucial for ensuring consistency, security, performance, and maintainability in any Convex project.

## 1. The Golden Rule: Documentation

You will stay up to date with Convex docs

## 2. Schema (`schema.ts`)

The schema is the single source of truth for your data model.

- **Mandatory Definitions**: All database tables, fields, and indexes **MUST** be defined in `convex/schema.ts`.
- **Strict Validation**: Every field requires a validator from `convex/values` (e.g., `v.string()`, `v.id("users")`, `v.optional(...)`). This is your first line of defense for data integrity.
- **Strategic Indexing**: Add indexes for any fields used in query filters (`.query().withIndex(...)`). This is critical for performance.
  - **Example**: A `posts` table might have `.index("by_user_and_status", ["userId", "status"])` to efficiently fetch all posts for a user with a specific status.

## 3. Function Types: The Right Tool for the Job

Convex provides three types of server-side functions. Using the correct one is essential.

### 3.1. `query`
- **Purpose**: **Read-only** data retrieval.
- **Characteristics**:
    - **Reactive**: Client-side components using `useQuery` automatically update when the underlying data changes.
    - **Deterministic**: Must not have side effects (e.g., no API calls, no `Date.now()`).
- **Error Handling**: Should return `null` or an empty array (`[]`) on auth failure or if data is not found, rather than throwing errors.

### 3.2. `mutation`
- **Purpose**: **Write operations** (create, update, delete).
- **Characteristics**:
    - **Atomic**: All database writes within a single mutation succeed or fail together.
    - Can read from the database.
- **Use Cases**:
    - Directly creating, updating, or deleting documents.
    - Scheduling background jobs (`ctx.scheduler.runAfter`).

### 3.3. `action`
- **Purpose**: **Side effects** and non-deterministic code.
- **Characteristics**:
    - **Cannot access the database directly**. Must use `ctx.runQuery(...)` and `ctx.runMutation(...)`.
    - Can be non-deterministic (e.g., use `Math.random()`, `Date.now()`).
    - Can interact with third-party APIs.
- **Execution Environment**:
    - For interacting with external services or using Node.js APIs, you **MUST** specify `"use node";` at the top of the file.
    - Otherwise, they run in a more limited, but faster, V8 environment.

### 3.4. Internal Functions (`internalQuery`, `internalMutation`, `internalAction`)
- **Purpose**: For functions that should **only** be called by other server-side functions (e.g., from an action or a scheduled job).
- **Security**: These are not exposed to the client, providing a secure way to run privileged operations.
- **Example**: A file processing module might use an `internalAction` to perform heavy computation, scheduled by a public `mutation`.

## 4. Application Patterns & Best Practices

### 4.1. Background Jobs
For long-running tasks, follow this pattern:
1.  A client calls a public `mutation` (e.g., `scheduleTask`).
2.  This mutation performs initial validation, updates the data model to a "processing" state, and schedules a background job using `ctx.scheduler.runAfter(0, internal.someModule.runTask, { ...args });`.
3.  The `internalAction` (e.g., `runTask`) executes the long-running task.
4.  The `internalAction` then calls `internalMutation`s to update the database with the results, setting the status to "completed" or "failed".

### 4.2. External API Interaction
- All external API calls **MUST** be made from within an `action`.
- Store API keys and secrets as Environment Variables in the Convex dashboard and access them via `process.env.SECRET_NAME`. **NEVER** hardcode secrets.
- Wrap API calls in `try...catch` blocks. On failure, update the corresponding document's status to `"failed"` and store a user-friendly error message.

### 4.3. User Management
- A user's identity should be synced with a `users` table using an `upsertUser` mutation. This should be called from the frontend after a user logs in to ensure the Convex database has the latest user information from the auth provider.

### 4.4. File Handling
- **Uploads**: The client gets a short-lived upload URL from a `generateUploadUrl` mutation. It then `POST`s the file directly to that URL.
- **Storage**: After the upload, the client calls another mutation to save the resulting `storageId` to a document. The permanent, accessible URL can then be retrieved via `ctx.storage.getUrl(storageId)`.

### 4.5. HTTP Endpoints
- Use `httpRouter` to define public-facing HTTP endpoints.
- This is primarily used for webhooks or for server-to-server communication that doesn't fit the query/mutation model.
- Remember to handle CORS headers correctly for browser-based requests.

## 5. Code Structure & Conventions

- **File per Table**: Group related functions into files named after the data table they primarily operate on (e.g., `posts.ts`, `comments.ts`, `users.ts`).
- **File per Feature**: For complex features involving multiple tables or external services, create a dedicated file (e.g., `payments.ts`, `notifications.ts`).
- **`_generated` Directory**: This directory is managed by Convex. **DO NOT** edit any files within it manually. Run `npx convex dev` to keep it up-to-date.
- **Argument Validation**: Always define argument types using `v` from `convex/values`. This provides runtime validation and TypeScript types.
- **Naming**: Use clear, verb-based names for functions:
    - `create`, `add`, `insert`
    - `get`, `find`, `list`
    - `update`, `patch`, `upsert`
    - `remove`, `delete`