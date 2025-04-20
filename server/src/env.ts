import { z } from "zod";

const envBoolean = z
  .string()
  .toLowerCase()
  .transform((str) => JSON.parse(str))
  .pipe(z.boolean());

const envVariables = z.object({
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  AUTH_SECRET:
    process.env.NODE_ENV === "production"
      ? z.string()
      : z.string().default("do-not-use-in-prod"),
  ACCESS_TOKEN_LIFESPAN: z.string().default("10m"),
  REFRESH_TOKEN_LIFESPAN: z.string().default("60d"),
  DATABASE_URL: z.string().url().default("file:../db/sugarbox.sqlite"),
  LOG_LEVEL: z.string().default("info"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  STORAGE_QUOTA_USER: z.coerce.number().min(1).default(104857600), //100mb
  STORAGE_QUOTA_ADMIN: z.coerce.number().min(1).default(1073741824), //1gb
  REGISTERED_USERS_LIMITED: envBoolean.default("false"),
});

export type ProcessEnv = z.infer<typeof envVariables>;

const env: ProcessEnv = envVariables.parse(process.env);

export default env;
