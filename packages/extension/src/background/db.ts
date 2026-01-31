import Dexie, { type EntityTable } from "dexie";
import { exportDB, importInto } from "dexie-export-import";
import type { CharObj, GameObj, SaveObj } from "../shared/types";
import { dbSchema } from "../shared/dbSchema";

type dbType = Dexie & {
  games: EntityTable<GameObj, "id">;
  chars: EntityTable<CharObj, "id">;
  saves: EntityTable<SaveObj, "id">;
};

const db = new Dexie(dbSchema.name) as dbType;

db.version(dbSchema.version).stores(dbSchema.stores);

export async function createDBBlob() {
  return exportDB(db);
}

export function clearDB() {
  return Promise.all([db.games.clear(), db.chars.clear(), db.saves.clear()]);
}

export async function uploadDB(blob: Blob) {
  await clearDB();
  importInto(db, blob);
}

export async function elementCount() {
  let count = 0;
  for (const i of [db.games, db.chars, db.saves]) {
    count += await i.count();
  }
  return count;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _global = globalThis as any;
_global.exportDB = exportDB;
_global.uploadDB = uploadDB;
_global.db = db;

export { db };
