import { db } from "./logic/db";
import { Game } from "./logic/game";
import { state } from "./logic/state";
import { onMessage } from "webext-bridge/background";
import "./logic/page.ts"

onMessage("bg_ping", () => "pong" as const)

console.log(db.name)

async function updateCurrentTab(tabId: number) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.id) {
    console.error(`Tab with no tabId`, tab)
    return
  }
  console.log("Switched to ", tab)
  state.tabId = tab.id
  await Game.handleTabSwitch(tab.id)

}

let updateCurrentTabTimeout = 0;
function updateCurrentTabDebounced(tabId: number) {
  if (updateCurrentTabTimeout) {
    clearTimeout(updateCurrentTabTimeout)
  }
  updateCurrentTabTimeout = setTimeout(() => updateCurrentTab(tabId), 300)
}

chrome.tabs.onActivated.addListener((activeInfo) =>
  updateCurrentTabDebounced(activeInfo.tabId)
)

chrome.tabs.onUpdated.addListener((tabId) =>
  updateCurrentTabDebounced(tabId)
)
