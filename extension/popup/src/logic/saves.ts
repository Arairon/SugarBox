import { SaveObj, UserObj } from "@/types";
import { v6 as uuidv6 } from "uuid";
import { db } from "@/db";
import { z, ZodIssueCode } from "zod";
import { downloadBlob, pageRequest } from "./browser";
import { Md5 } from "ts-md5/dist/esm/md5";
import { config } from "@/config";
import { authHeader, jsonHeaders, ServerResSchema, User } from "./user";
import { toast } from "sonner";
import { formatTime } from "@/lib/utils";

export const schema = z.object({
  id: z.number().int(),
  uuid: z.string().uuid(),
  remoteId: z.number().int().nullable(),
  name: z.string(),
  description: z.string(),
  gameVersion: z.string(),
  gameId: z.string(), //.uuid(),
  charId: z.string(), //.uuid(),
  data: z.string().nonempty(),
  size: z.number(),
  hash: z.string().nonempty(),
  archived: z.union([z.literal(0), z.literal(1)]).default(0),
  archivedAt: z.number().gte(0),
  updatedAt: z
    .number()
    .gte(1)
    .default(() => Date.now()),
  createdAt: z
    .number()
    .gte(1)
    .default(() => Date.now()),
});

function createEmptySave(): SaveObj {
  return {
    id: -1,
    uuid: uuidv6(),
    remoteId: null,
    name: "",
    description: "",
    gameVersion: "",
    gameId: "",
    charId: "",
    data: "",
    size: 0,
    hash: "",
    archived: 0,
    archivedAt: 0,
    updatedAt: Date.now(),
    createdAt: Date.now(),
  };
}

export const SaveUploadSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  gameVersion: z.string(),
  gameId: z.string().uuid(),
  charId: z.string().uuid(),
  data: z.string(),
  size: z.number(),
  hash: z.string(),
  archived: z.boolean({ coerce: true }),
  archivedAt: z.date({ coerce: true }).default(new Date(0)),
  updatedAt: z.date({ coerce: true }).default(() => new Date()),
  createdAt: z.date({ coerce: true }).default(() => new Date()),
});

export const SaveDownloadSchema = z
  .object({
    id: z.number().optional(),
    uuid: z.string().uuid(),
    remoteId: z.any().transform(() => null as number | null),
    name: z.string(),
    description: z.string(),
    gameVersion: z.string(),
    gameId: z.string().uuid(),
    charId: z.string().uuid(),
    data: z.string(),
    size: z.number(),
    hash: z.string(),
    archived: z.boolean().transform((v) => Number(v)),
    archivedAt: z.date({ coerce: true }).transform((v) => v.getTime()),
    updatedAt: z.date({ coerce: true }).transform((v) => v.getTime()),
    createdAt: z.date({ coerce: true }).transform((v) => v.getTime()),
  })
  .transform((s) => parseRemoteId(s as SaveObj));

function parseRemoteId(save: Omit<SaveObj, "id"> & { id?: number }) {
  save.remoteId = save.id!;
  delete save.id;
  return save as SaveObj;
}

async function upload(save: SaveObj, user: UserObj) {
  user = await User.checkSession(user);
  let res;
  try {
    res = await fetch(config.baseURL + "api/saves/uuid/" + save.uuid, {
      method: "PATCH",
      headers: Object.assign(jsonHeaders(), authHeader(user)),
      body: JSON.stringify(SaveUploadSchema.parse(save)), //.omit({ data: true })
    });
  } catch {}
  if (!res) {
    toast.error("Failed to upload the save", {
      description: "You can try again later",
    });
    return;
  }
  const {
    data: saveData,
    status,
    message,
  } = ServerResSchema.parse(await res.json());
  if (status !== "ok") {
    toast.error("Error when uploading the save", { description: message });
    return;
  }
  const saveParse = SaveDownloadSchema.safeParse(saveData);
  if (!saveParse.success) {
    toast.error("Server sent incorrect save object", {
      description: saveParse.error.message,
    });
    return;
  }
  Object.assign(save, saveParse.data);
  commit(save, null, true);
}

async function uploadNew(save: SaveObj, user: UserObj) {
  user = await User.checkSession(user);
  let res;
  try {
    res = await fetch(config.baseURL + "api/saves/new", {
      method: "POST",
      headers: Object.assign(jsonHeaders(), authHeader(user)),
      body: JSON.stringify(SaveUploadSchema.parse(save)),
    });
  } catch {}
  if (!res) {
    toast.error("Failed to upload the save", {
      description: "You can try again later",
    });
    return;
  }
  const {
    data: saveData,
    status,
    message,
  } = ServerResSchema.parse(await res.json());
  if (status !== "ok") {
    toast.error("Error when uploading the save", { description: message });
    return;
  }
  const saveParse = SaveDownloadSchema.safeParse(saveData);
  if (!saveParse.success) {
    toast.error("Server sent incorrect save object", {
      description: saveParse.error.message,
    });
    return;
  }
  Object.assign(save, saveParse.data);
  commit(save, null, true);
}

function commit(save: SaveObj, user: UserObj | null = null, localonly = false) {
  save.updatedAt = Date.now();
  const promise = db.saves.put(save);
  if (localonly || !user) return promise;
  User.updLastCommit(user);
  promise.then((id) => {
    if (User.online(user, true)) {
      db.saves.get(id).then((s) => {
        if (s) {
          if (s) upload(s, user);
          //else uploadNew(s, user);
        }
      });
    }
  });
}

function bulkCommit(saves: SaveObj[], user: UserObj | null = null) {
  saves.map((s) => (s.updatedAt = Date.now()));
  const promise = db.saves.bulkPut(saves);
  if (!user) return promise;
  return promise.then(async () => {
    if (User.online(user, true)) {
      const payload = {
        saves: saves.map((s) => SaveUploadSchema.parse(s)),
      };
      let res;
      try {
        res = await fetch(config.baseURL + "api/sync/up", {
          method: "POST",
          headers: Object.assign(jsonHeaders(), authHeader(user)),
          body: JSON.stringify(payload),
        });
      } catch {}
      if (!res) return -1;
      const { data, success, error } = ServerResSchema.safeParse(
        await res.json()
      );
      if (!success) {
        console.error(
          "Error bulk uploading saves (server sent wrong response)",
          error
        );
        return -1;
      }
      if (data.status !== "ok") {
        console.error(
          "Error bulk uploading saves, server refused",
          data.message
        );
        return -1;
      }
    }
  });
}

function validate(save: any) {
  return schema.safeParse(save);
}

const SaveDBSchema = schema.superRefine(async (save, ctx) => {
  if (save.archived) return;
  const gameIds = (await db.games.where("archived").equals(0).toArray()).map(
    (i) => i.uuid
  );
  if (!gameIds.includes(save.gameId))
    ctx.addIssue({
      code: ZodIssueCode.custom,
      path: ["gameId"],
      message: "Save does not belong to any valid game",
    });
  const charIds = (await db.chars.where("archived").equals(0).toArray()).map(
    (i) => i.uuid
  );
  if (!charIds.includes(save.charId))
    ctx.addIssue({
      code: ZodIssueCode.custom,
      path: ["saveId"],
      message: "Save does not belong to any valid char",
    });
});

function validateDB(save: SaveObj) {
  return SaveDBSchema.safeParseAsync(save);
}

function md5(data: string) {
  const hash = new Md5().start();
  hash.appendAsciiStr(data);
  return hash.end() as string;
}

function addNew(save: SaveObj, user: UserObj | null = null, localonly = false) {
  const saveToAdd: any = save;
  if (save.id === -1) delete saveToAdd.id;
  const promise = db.saves.add(saveToAdd as SaveObj);
  if (localonly || !user) return promise;
  return promise.then((id) => {
    if (User.online(user, true)) {
      db.saves.get(id).then((s) => {
        if (s) uploadNew(s, user);
      });
    }
  });
}

function archive(save: SaveObj) {
  save.archived = 1;
  save.archivedAt = Date.now();
}

function unarchive(save: SaveObj) {
  save.archived = 0;
  save.archivedAt = 0;
}

function getSize(save: SaveObj) {
  return new Blob([save.data]).size;
}

function calcSavesSize(saves: SaveObj[]) {
  let size = 0;
  for (let save of saves) size += getSize(save);
  return size;
}

function autofix(save: SaveObj) {
  const base = createEmptySave();
  if (save?.id !== undefined) base.id = save.id;
  if (save?.uuid && save?.uuid !== undefined) base.uuid = save.uuid;
  if (save?.remoteId !== undefined) base.remoteId = save.remoteId;
  if (save?.data !== undefined) base.data = save.data;
  if (save?.hash !== undefined) base.hash = save.hash;
  if (save?.name !== undefined) base.name = save.name;
  if (save?.description !== undefined) base.description = save.description;
  if (save?.gameId !== undefined) base.gameId = save.gameId;
  if (save?.charId !== undefined) base.charId = save.charId;
  if (save?.gameVersion !== undefined) base.gameVersion = save.gameVersion;
  if (save?.archived !== undefined)
    base.archived = Number(!!save.archived) as 0 | 1;
  if (save?.archivedAt !== undefined && !isNaN(save.archivedAt))
    base.archivedAt = save.archivedAt;
  return base;
}

function createSaveFromPageData(
  data: PageSave,
  charId: string,
  gameId: string
) {
  const save = Save.createEmptySave();
  save.charId = charId;
  save.gameId = gameId;
  save.data = data.data;
  save.hash = Save.md5(save.data);
  save.name = data.passage;
  save.description = data.description;
  save.gameVersion = data.version;
  return save;
}

function invalidateRemoteIds() {
  return db.saves.toArray().then((saves) => {
    saves.map((s) => (s.remoteId = null));
    return bulkCommit(saves);
  });
}

async function exportDataToFile(save: SaveObj) {
  const blob = new Blob([save.data]);
  const game = await db.games.get({ uuid: save.gameId });
  const gamename = game?.name?.replaceAll(" ", "_") ?? "Unknown game";
  downloadBlob(
    blob,
    `${gamename}-${save.name}_${formatTime(save.createdAt, true)}.save`
  );
}

//export type saveType = z.infer<typeof schema> // can replace types.d.ts
export const Save = {
  createEmptySave,
  addNew,
  commit,
  bulkCommit,
  validate,
  validateDB,
  schema,
  md5,
  autofix,
  archive,
  unarchive,
  getSize,
  calcSavesSize,
  exportDataToFile,
  invalidateRemoteIds,
  createSaveFromPageData,
};

export const pageSaveSchema = z.object({
  passage: z.string().nonempty(),
  data: z.string().nonempty(),
  description: z.string().nonempty().default("No description"),
  version: z.string().default("vUNK"),
});
type PageSave = z.infer<typeof pageSaveSchema>;

export async function requestSave() {
  const save = (await pageRequest("save")) as PageSave;
  return save;
}
export async function requestLoad(save: SaveObj) {
  const data = save.data;
  return pageRequest("load", data);
}

const _global = window as any;
_global.Save;
