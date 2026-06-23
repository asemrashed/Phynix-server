import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),
})

export type Env = z.infer<typeof envSchema>

let cached: Env | null = null

export function validateEnv(): Env {
  if (cached) return cached

  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n")
    console.error("Invalid environment variables:\n" + message)
    process.exit(1)
  }

  cached = result.data
  return cached
}

export function getEnv(): Env {
  return cached ?? validateEnv()
}
