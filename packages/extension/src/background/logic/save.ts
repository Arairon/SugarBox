import { createEmptySaveObject, SaveSchema, type SaveObj } from "@/shared/types";
import { db } from "./db";
import { onMessage } from "webext-bridge/background";
import { getSave, isPageAGame, loadSave } from "./page";
import md5 from "md5"
import { state } from "./state";
import { Char } from "./char";
import z from "zod";
import { Sync } from "./sync";
import { Game } from "./game";


export const SaveUploadSchema = z.object({
  uuid: z.uuid(),
  name: z.string(),
  description: z.string(),
  gameVersion: z.string(),
  gameId: z.uuid(),
  charId: z.uuid(),
  data: z.string(),
  size: z.number(),
  hash: z.string(),
  archived: z.coerce.boolean(),
  archivedAt: z.coerce.date().default(new Date(0)),
  updatedAt: z.coerce.date().default(() => new Date()),
  createdAt: z.coerce.date().default(() => new Date()),
});

export type SaveUploadObject = z.infer<typeof SaveUploadSchema>

export const SaveDownloadSchema = z
  .object({
    id: z.number(),
    uuid: z.uuid(),
    remoteId: z.any().transform(() => -1),
    name: z.string(),
    description: z.string(),
    gameVersion: z.string(),
    gameId: z.uuid(),
    charId: z.uuid(),
    data: z.string(),
    size: z.number(),
    hash: z.string(),
    archived: z.boolean().transform((v) => Number(v) as 0 | 1),
    archivedAt: z.coerce.date().transform((v) => v.getTime()),
    updatedAt: z.coerce.date().transform((v) => v.getTime()),
    createdAt: z.coerce.date().transform((v) => v.getTime()),
  })
  .transform((s) => {
    s.remoteId = s.id
    s.id = -1
    return s
  });

export type SaveDownloadObject = z.infer<typeof SaveDownloadSchema>

function prepareForUpload(save: SaveObj) {
  return SaveUploadSchema.parse(save)
}

function parseDownloaded(save: unknown) {
  return SaveDownloadSchema.parse(save)
}

async function commit(save: SaveObj) {
  save.updatedAt = Date.now()
  if (save.id === -1) {
    save.id = await db.saves.put(Object.assign(save, { id: undefined }))
  } else {
    save.id = await db.saves.put(save)
  }
  Sync.scheduleSync()
  return save
}

async function bulkCommit(saves: SaveObj[]) {
  saves.map(save => {
    save.updatedAt = Date.now()
    if (save.id === -1) save.id = undefined as unknown as number
  })
  await db.saves.bulkPut(saves)
  Sync.scheduleSync()
}

function archive(save: SaveObj) {
  if (save.archived) return
  save.archived = 1;
  save.archivedAt = Date.now();
}

function validate(save: SaveObj) {
  return SaveSchema.safeParse(save)
}

onMessage("bg_save_new", async (msg) => {
  const slot = msg.data
  if (!state.game || !state.char || !state.tabId) {
    return { ok: false as const, message: "Invalid state, please refresh the page" }
  }
  if (!(await isPageAGame())) {
    return { ok: false as const, message: "Unable to contact SugarCube backend" }
  }
  const saveData = await getSave()
  if (!saveData || !saveData.data) {
    return { ok: false as const, message: "Game refused to save" }
  }

  const save = createEmptySaveObject()
  save.charId = state.char.uuid;
  save.gameId = state.game.uuid;
  save.data = saveData.data;
  save.hash = md5(save.data);
  save.name = saveData.passage;
  save.description = saveData.description;
  save.gameVersion = saveData.version;

  await commit(save)

  if (slot === -1) { // New slot
    state.char.slots.push(save.uuid)
    await Char.commit(state.char)
  } else if (slot !== undefined) { // Existing slot
    const existingSaveId = state.char.slots[slot]
    if (existingSaveId) {
      const exSave = await db.saves.get({ uuid: existingSaveId })
      if (exSave) {
        archive(exSave)
        await commit(exSave)
      }
    }
    if (state.char.slots.length - 1 < slot) {
      console.warn(`Invalid slot ${slot} for char: `, state.char)
      state.char.slots.push(save.uuid)
    } else {
      state.char.slots[slot] = save.uuid
    }
    await Char.commit(state.char)
  }
  // TODO: Fire update event
  return { ok: true as const, save }
})

onMessage("bg_save_edit", async (msg) => {
  const { success, data: save, error } = validate(msg.data);
  if (!success) {
    return {
      ok: false as const,
      message: error.message
    }
  }
  // TODO: Extra checks?

  const result = await commit(save)
  if (!result) {
    return { ok: false as const, message: "Failed for unknown reasons" }
  }
  return { ok: true as const, save: result }
})

onMessage("bg_save_archive", async (msg) => {
  const { success, data: save, error } = validate(msg.data);
  if (!success) {
    return {
      ok: false as const,
      message: error.message
    }
  }
  // TODO: Extra checks?
  archive(save);
  await commit(save)
  return { ok: true as const }
})

onMessage("bg_save_load", async (msg) => {
  const { success, data: save, error } = validate(msg.data);
  if (!success) {
    return {
      ok: false as const,
      message: error.message
    }
  }
  if (!(await isPageAGame())) {
    return { ok: false as const, message: "Unable to contact SugarCube backend" }
  }

  // TODO: Extra checks?
  await loadSave(save.data)
  return { ok: true as const }
})

async function restore(save: SaveObj) {
  const game = await db.games.get({ uuid: save.gameId })
  if (!game) return { ok: false as const, message: "Unable to restore related game" }
  const char = await db.chars.get({ uuid: save.charId })
  if (!char) return { ok: false as const, message: "Unable to restore related character" }

  if (game.archived) await Game.restore(game)
  if (char.archived) await Char.restore(char)

  save.archived = 0
  save.archivedAt = 0
  char.slots.push(save.uuid)

  await Char.commit(char)
  await Save.commit(save)
  return { ok: true as const }
}

onMessage("bg_save_restore", async (msg) => {
  const { success, data: save, error } = validate(msg.data);
  if (!success) {
    return {
      ok: false as const,
      message: error.message
    }
  }

  return await restore(save)
})


export const Save = {
  archive,
  restore,
  commit,
  bulkCommit,
  prepareForUpload,
  parseDownloaded
}
