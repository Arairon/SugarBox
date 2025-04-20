import Dexie, { EntityTable } from "dexie";
import { exportDB, importInto } from "dexie-export-import";
import { CharObj, GameObj, SaveObj } from "./types";
import { downloadBlob } from "./logic/browser";
import { formatTime } from "./lib/utils";

type dbType = Dexie & {
  games: EntityTable<GameObj, "id">;
  chars: EntityTable<CharObj, "id">;
  saves: EntityTable<SaveObj, "id">;
};
const db = new Dexie("sugarbox") as dbType;

db.version(1).stores({
  games: `++id,remoteId,&uuid,name,shortname,archived,archivedAt,createdAt,updatedAt`,
  chars: `++id,remoteId,&uuid,name,gameId,archived,archivedAt,createdAt,updatedAt`,
  saves: `++id,remoteId,&uuid,name,hash,gameVersion,charId,gameId,createdAt,archived,archivedAt,updatedAt`,
});

export async function createDBBlob() {
  return exportDB(db);
}

export async function download_db() {
  const blob = await createDBBlob();
  downloadBlob(blob, `SugarBox-DB-export_${formatTime(Date.now(), true)}.json`);
}

export function clear_db() {
  return Promise.all([db.games.clear(), db.chars.clear(), db.saves.clear()]);
}

export async function upload_db(blob: Blob) {
  await clear_db();
  importInto(db, blob);
}

export async function elementCount() {
  let count = 0;
  for (let i of [db.games, db.chars, db.saves]) {
    count += await i.count();
  }
  return count;
}

const _global = window as any;
_global.download_db = download_db;
_global.upload_db = upload_db;
_global.db = db;

export { db };
