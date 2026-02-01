import type { CharObj } from "@/shared/types";
import { db } from "./db";
import { state } from "./state"
import { onMessage } from "webext-bridge/background";

const latestCharMap: Record<number, number> = {}; // GameID: CharID

function saveLatestCharMap() {
  chrome.storage.local.set({ latestCharMap })
}

async function loadLatestCharMap() {
  const { latestCharMap: loadedMap } = await chrome.storage.local.get("latestCharMap")
  if (loadedMap) Object.assign(latestCharMap, loadedMap)
}

loadLatestCharMap()

async function handleTabSwitch(tabId: number) {
  const tab = await chrome.tabs.get(tabId)
  if (!tab.id || !tab.url) return
  if (!state.game) {
    // No event, since char is null after tab switch event
    return;
  }
  const latestCharId = latestCharMap[state.game.id];
  if (!latestCharId) return;
  const char = await db.chars.get(latestCharId) ?? null;
  await switchTo(char)
}

async function switchTo(char: CharObj | null) {
  if (state.char === char) return;
  state.char = char;
  if (state.game) {
    if (char)
      latestCharMap[state.game.id] = char.id;
    else delete latestCharMap[state.game.id]

    saveLatestCharMap()
  }
  // TODO: Fire an event
  console.log(`Switched Char: `, char)
}

onMessage("bg_change_char", ({ data }) => switchTo(data as CharObj | null))

export const Char = {
  handleTabSwitch,
  saveLatestCharMap,
  loadLatestCharMap,
  switchTo,
}
