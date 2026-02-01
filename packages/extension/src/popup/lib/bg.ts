import type { ChromeMessageRequest } from "@/shared/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function request(cmd: ChromeMessageRequest["cmd"], ...args: any[]) {
  return chrome.runtime.sendMessage(Object.assign({
    target: "background" as const,
  }, {cmd, args}) satisfies ChromeMessageRequest)
}
