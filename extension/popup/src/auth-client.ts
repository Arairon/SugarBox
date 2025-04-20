import { createAuthClient } from "better-auth/react";
import { config } from "./config";

const authClient = await createAuthClient({
  baseURL: config.baseURL,
});

const _global = window as any;
_global.authClient = authClient;
export { authClient };
