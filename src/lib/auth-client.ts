import { createAuthClient } from "better-auth/client";
import { lastLoginMethodClient } from "better-auth/client/plugins"


export const authClient = createAuthClient({
    plugins: [lastLoginMethodClient()],
}); 