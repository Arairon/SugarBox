import { GamePathSchema, GameSchema, type GameObj, type SaveObj } from "@/shared/types";
import { db } from "./db";
import { state } from "./state";
import { onMessage } from "webext-bridge/background";
import { Char } from "./char";
import z from "zod";
import { Sync } from "./sync";

const urlToGameMap = new Map<string, GameObj>()

async function rebuildUrlToGameMap() {
  urlToGameMap.clear()
  await db.games
    .where("archived").equals(0)
    .each((game: GameObj) => {
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
  if (!state.tabId) return
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

export const GameUploadSchema = z.object({
  uuid: z.uuid(),
  name: z.string(),
  shortname: z.string().default(""),
  paths: z.array(GamePathSchema).transform((p) => JSON.stringify(p)),
  archived: z.coerce.boolean(),
  archivedAt: z.coerce.date().default(new Date(0)),
  updatedAt: z.coerce.date().default(() => new Date()),
  createdAt: z.coerce.date().default(() => new Date()),
});

export type GameUploadObject = z.infer<typeof GameUploadSchema>

export const GameDownloadSchema = z
  .object({
    id: z.number(),
    uuid: z.uuid(),
    remoteId: z.any().transform(() => -1),
    name: z.string(),
    shortname: z.string().default(""),
    paths: z
      .string()
      .transform((p) => z.array(GamePathSchema).parse(JSON.parse(p))),
    archived: z.boolean().transform((v) => Number(v) as 0 | 1),
    archivedAt: z.coerce.date().transform((v) => v.getTime()),
    updatedAt: z.coerce.date().transform((v) => v.getTime()),
    createdAt: z.coerce.date().transform((v) => v.getTime()),
  })
  .transform((g) => {
    g.remoteId = g.id;
    g.id = -1
    return g
  });

export type GameDownloadObject = z.infer<typeof GameDownloadSchema>

function prepareForUpload(game: GameObj) {
  return GameUploadSchema.parse(game)
}

function parseDownloaded(game: unknown) {
  return GameDownloadSchema.parse(game)
}

async function commit(game: GameObj) {
  game.updatedAt = Date.now()
  if (game.id === -1) {
    game.id = await db.games.put(Object.assign(game, { id: undefined }))
  } else {
    game.id = await db.games.put(game)
  }
  await rebuildUrlToGameMap()
  await handleUpdate()
  Sync.scheduleSync()
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
  await commit(game)
  return {
    affectedChars: chars,
    affectedSaves: saves
  }
}

async function restore(game: GameObj) {
  game.archived = 0
  game.archivedAt = 0

  const games = await db.games.where("archived").equals(0).toArray()
  game.paths = game.paths.filter((path) => { // Filter already taken paths
    for (const i of games) {
      if (i.uuid === game.uuid) continue
      if (i.paths.map(p => p.url).includes(path.url)) {
        return false
      }
    }
    return true
  })

  return commit(game)
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
  archive,
  restore,
  prepareForUpload,
  parseDownloaded,
}
