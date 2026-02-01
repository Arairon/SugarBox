import z from "zod";

const ConfigSchema = z.object({
  baseURL: z.url().trim().endsWith("/", "baseURL must end with a '/'").default("https://sugarbox.arai.icu/")
})
type Config = z.infer<typeof ConfigSchema>

export const config: Config = ConfigSchema.parse({})

export function saveConfig() {
  chrome.storage.local.set({ config })
}

export async function loadConfig() {
  const { config: loadedConfig } = await chrome.storage.local.get("config")
  if (!loadedConfig) return;
  const { success, data, error } = ConfigSchema.safeParse(loadedConfig)
  if (!success) {
    console.error(`Invalid config; Error: ${error}`, loadedConfig)
  }
  Object.assign(config, data)
}

loadConfig()
