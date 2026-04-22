import { onMessage } from "webext-bridge/background";
import z from "zod";
import { Api } from "./api";
import { state } from "./state";
import { User } from "./user";

const ConfigSchema = z.object({
  baseURL: z.url().trim().endsWith("/", "baseURL must end with a '/'").default("https://sugarbox.arai.icu/"),
  syncDelay: z.number().default(5_000)
})
export type Config = z.infer<typeof ConfigSchema>

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

onMessage("bg_config_get", () => {
  return config
})

onMessage("bg_config_set", async ({ data }) => {
  const { success, data: newcfg, error } = ConfigSchema.safeParse(data)
  if (!success) {
    return { ok: false as const, message: error.issues[0].message }
  }
  if (config.baseURL !== newcfg.baseURL) {
    const serverVersion = await Api.getServerVersion(newcfg.baseURL)
    if (!serverVersion.ok) {
      return { ok: false as const, message: "Invalid response from server" }
    }
    Object.assign(config, newcfg)
    saveConfig()
    if (state.user.id) User.reset()
    return { ok: true as const, serverVersion }
  }
  Object.assign(config, newcfg)
  saveConfig()
  return { ok: true as const }
})
