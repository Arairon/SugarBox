import Dexie, { type EntityTable } from "dexie";
import { exportDB } from "dexie-export-import";
import type { CharObj, GameObj, SaveObj } from "../../shared/types";
import { formatTime } from "../../shared/utils";
import { dbSchema } from "../../shared/dbSchema";
import { downloadBlob } from "./browser";

type dbType = Dexie & {
  games: EntityTable<GameObj, "id">;
  chars: EntityTable<CharObj, "id">;
  saves: EntityTable<SaveObj, "id">;
};

const db = new Dexie(dbSchema.name) as dbType;

db.version(dbSchema.version).stores(dbSchema.stores);

db.on("versionchange", () => {
  // TODO: Fire a DB_CLOSED event or smth
  db.close()
})

export async function createDBBlob() {
  return exportDB(db);
}

export async function downloadDB() {
  const blob = await createDBBlob();
  downloadBlob(blob, `SugarBox-DB-export_${formatTime(Date.now(), true)}.json`);
}

// Popup is ReadOnly
// export function clearDB() {
//   return Promise.all([db.games.clear(), db.chars.clear(), db.saves.clear()]);
// }
//
// export async function uploadDB(blob: Blob) {
//   await clearDB();
//   importInto(db, blob);
// }

export async function elementCount() {
  let count = 0;
  for (const i of [db.games, db.chars, db.saves]) {
    count += await i.count();
  }
  return count;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _global = window as any;
_global.downloadDB = downloadDB;
// _global.uploadDB = uploadDB;
_global.db = db;

export { db };
