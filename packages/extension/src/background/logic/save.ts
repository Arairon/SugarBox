import { createEmptySaveObject, SaveSchema, type SaveObj } from "@/shared/types";
import { db } from "./db";
import { onMessage } from "webext-bridge/background";
import { getSave, isPageAGame, loadSave } from "./page";
import md5 from "md5"
import { state } from "./state";
import { Char } from "./char";


async function commit(save: SaveObj) {
  save.updatedAt = Date.now()
  if (save.id === -1) {
    save.id = await db.saves.put(Object.assign(save, { id: undefined }))
  } else {
    save.id = await db.saves.put(save)
  }
  return save
}

async function bulkCommit(saves: SaveObj[]) {
  saves.map(save => {
    save.updatedAt = Date.now()
    if (save.id === -1) save.id = undefined as unknown as number
  })
  await db.saves.bulkPut(saves)
}

function archive(save: SaveObj) {
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
  } else if (slot) { // Existing slot
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


export const Save = {
  archive,
  commit,
  bulkCommit
}
