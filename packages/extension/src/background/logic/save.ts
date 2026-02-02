import type { SaveObj } from "@/shared/types";
import { db } from "./db";


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

export const Save = {
  archive,
  commit,
  bulkCommit
}
