import { GameSchema, type GameObj, type SaveObj } from "@/shared/types";
import { db } from "./db";
import { state } from "./state";
import { onMessage } from "webext-bridge/background";
import { Char } from "./char";

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
  await handleUpdate()
}

async function handleUpdate() {
  const tab = await chrome.tabs.get(state.tabId)
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
  await Char.handleGameSwitch()
}

function validate(game: GameObj) {
  return GameSchema.safeParse(game)
}

async function commit(game: GameObj) {
  if (game.id === -1) {
    game.id = await db.games.put(Object.assign(game, { id: undefined }))
  } else {
    game.id = await db.games.put(game)
  }
  await rebuildUrlToGameMap()
  await handleUpdate()
  return game
}

async function archive(game: GameObj) {
  if (game.archived) {
    return { affectedChars: [], affectedSaves: [] }
  }
  game.archived = 1
  game.archivedAt = Date.now()
  const saves = [] as SaveObj[];
  const chars = await db.chars
    .where("gameId")
    .equals(game.uuid)
    .and((c) => !c.archived)
    .toArray();
  for (const char of chars) {
    const res = await Char.archive(char);
    await Char.commit(char);
    saves.push(...res.affectedSaves);
  }
  return {
    affectedChars: chars,
    affectedSaves: saves
  }
}

onMessage("bg_game_edit", async (msg) => {
  const { success, data: game, error } = validate(msg.data);
  if (!success) {
    return {
      ok: false as const,
      message: error.message
    }
  }
  // TODO: Extra checks?

  const result = await commit(game)
  if (!result) {
    return { ok: false as const, message: "Failed for unknown reasons" }
  }
  return { ok: true as const, game: result }
})

onMessage("bg_game_archive", async (msg) => {
  const { success, data: game, error } = validate(msg.data);
  if (!success) {
    return {
      ok: false as const,
      message: error.message
    }
  }
  // TODO: Extra checks?
  const result = await archive(game);
  await commit(game)
  return { ok: true as const, affectedChars: result.affectedChars.length, affectedSaves: result.affectedSaves.length }
})


export const Game = {
  rebuildUrlToGameMap,
  handleTabSwitch,
  switchTo,
  validate,
  commit,
  archive
}
