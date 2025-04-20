import { z, ZodError } from "zod";

const rawConfig = (await chrome.storage.local.get("config"))?.config;

export const BaseURLSchema = z
  .string()
  .trim()
  .url({ message: "BaseURL must be a valid url" })
  .startsWith("http", { message: "BaseURL must use http(s) protocol" })
  .endsWith("/", { message: "BaseURL must end in a /" });

const ConfigSchema = z.object({
  baseURL: BaseURLSchema.default("https://sugarbox.arai.icu/"),
});

type ConfigObj = z.infer<typeof ConfigSchema>;
let config: ConfigObj;

try {
  config = ConfigSchema.parse(rawConfig ?? {});
  if (!rawConfig || Object.keys(rawConfig).length === 0)
    chrome.storage.local.set({ config });
} catch (err) {
  console.error("Invalid config: " + (err as ZodError).message);
  config = ConfigSchema.parse({});
  //redirect to options page
}

export function saveConfig(obj?: ConfigObj) {
  const c = obj ? obj : config;
  return chrome.storage.local.set({ config: ConfigSchema.parse(c) });
}

(window as any).config = config;

export { config };
