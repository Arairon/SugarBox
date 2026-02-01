import type { GameObj } from "@/shared/types";
import { db } from "./db";
import { state } from "./state";

const urlToGameMap = new Map<string, GameObj>()

async function rebuildUrlToGameMap() {
  urlToGameMap.clear()
  await db.games.each((game: GameObj) => {
    game.paths.map(path => {
      if (path.url.startsWith("ERR"))
        return;
      if (urlToGameMap.has(path.url)) {
        path.url = "ERR: Duped: " + path.url
        return
      }
      urlToGameMap.set(path.url, game)
    })
  })
}

rebuildUrlToGameMap()

async function handleTabSwitch(tabId: number) {
  const tab = await chrome.tabs.get(tabId)
  if (!tab.id || !tab.url) return
  const game = urlToGameMap.get(tab.url)
  await switchTo(game ?? null)
}

async function switchTo(game: GameObj | null) {
  if (state.game === game) return;
  state.game = game;
  state.char = null;
  // Fire an event
  console.log(`Switched Game: `, game)
}

export const Game = {
  rebuildUrlToGameMap,
  handleTabSwitch,
  switchTo,
}
