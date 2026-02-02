import type { SugarBoxPageCommand } from "@/shared/types";
import { state } from "./state";
import { onMessage } from "webext-bridge/background";

export async function sendCommand(command: SugarBoxPageCommand) {
  const tab = await chrome.tabs.get(state.tabId);
  if (!tab.id) return
  return new Promise(function(resolve, reject) {
    if (!tab.id) {
      reject("Invalid tab");
      return;
    }
    try {
      chrome.tabs
        .sendMessage(tab.id, Object.assign({ cmd: "", args: "" }, command))
        .then((res) => resolve(res))
        .catch((err) => reject(err));
    } catch {
      reject("Could not send message");
    }
  });
}

onMessage("bg_is_page_a_game", async () => {
  try {
    const res = await sendCommand({ cmd: "check_sugarcube" })
    return !!res
  } catch {
    return false
  }
})

// (globalThis as any).sendCommand = sendCommand
