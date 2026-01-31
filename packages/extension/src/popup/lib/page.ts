import { getCurrentBrowserTab } from "../../shared/browser";
import type { SugarBoxPageCommand } from "../../shared/types";

export async function sendCommand(command: SugarBoxPageCommand) {
  const tab = await getCurrentBrowserTab();
  return new Promise(function(resolve, reject) {
    if (!tab.id) {
      reject("Invalid tab");
      return;
    }
    try {
      chrome.tabs
        .sendMessage(tab.id, Object.assign({cmd: "", args: ""}, command))
        .then((res) => resolve(res))
        .catch((err) => reject(err));
    } catch {
      reject("Could not send message");
    }
  });
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).sendCommand = sendCommand

