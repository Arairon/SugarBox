import { CharObj, UserObj } from "@/types";
import { v6 as uuidv6 } from "uuid";
import { db } from "@/db";
import { z, ZodIssueCode } from "zod";
import { Save } from "./saves";
import { authHeader, jsonHeaders, ServerResSchema, User } from "./user";
import { config } from "@/config";
import { toast } from "sonner";

export const schema = z.object({
  id: z.number().int(),
  uuid: z.string().uuid(),
  remoteId: z.number().int().nullable(),
  name: z.string(),
  gameId: z.string(), //.uuid(),
  slots: z.array(z.union([z.string().uuid(), z.literal("")])),
  archived: z.union([z.literal(0), z.literal(1)]).default(0),
  archivedAt: z.number().gte(0).int(),
  updatedAt: z
    .number()
    .gte(1)
    .default(() => Date.now()),
  createdAt: z
    .number()
    .gte(1)
    .default(() => Date.now()),
});

function createEmptyChar(): CharObj {
  return {
    id: -1,
    uuid: uuidv6(),
    remoteId: null,
    name: "",
    gameId: "",
    slots: [],
    archived: 0,
    archivedAt: 0,
    updatedAt: Date.now(),
    createdAt: Date.now(),
  };
}

export const CharUploadSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string(),
  gameId: z.string().uuid(),
  slots: z
    .array(z.union([z.string().uuid(), z.literal("")]))
    .transform((p) => JSON.stringify(p)),
  archived: z.boolean({ coerce: true }),
  archivedAt: z.date({ coerce: true }).default(new Date(0)),
  updatedAt: z.date({ coerce: true }).default(() => new Date()),
  createdAt: z.date({ coerce: true }).default(() => new Date()),
});

export const CharDownloadSchema = z
  .object({
    id: z.number().optional(),
    uuid: z.string().uuid(),
    remoteId: z.any().transform(() => null as number | null),
    name: z.string(),
    gameId: z.string().uuid(),
    slots: z
      .string()
      .transform((slots) =>
        z
          .array(z.union([z.string().uuid(), z.literal("")]))
          .parse(JSON.parse(slots))
      ),
    archived: z.boolean().transform((v) => Number(v)),
    archivedAt: z.date({ coerce: true }).transform((v) => v.getTime()),
    updatedAt: z.date({ coerce: true }).transform((v) => v.getTime()),
    createdAt: z.date({ coerce: true }).transform((v) => v.getTime()),
  })
  .transform((c) => parseRemoteId(c as CharObj));

function parseRemoteId(char: Omit<CharObj, "id"> & { id?: number }) {
  char.remoteId = char.id!;
  delete char.id;
  return char as CharObj;
}

async function upload(char: CharObj, user: UserObj) {
  user = await User.checkSession(user);
  let res;
  try {
    res = await fetch(config.baseURL + "api/chars/uuid/" + char.uuid, {
      method: "PATCH",
      headers: Object.assign(jsonHeaders(), authHeader(user)),
      body: JSON.stringify(CharUploadSchema.parse(char)),
    });
  } catch {}
  if (!res) {
    toast.error("Failed to upload the char", {
      description: "You can try again later",
    });
    return;
  }
  const {
    data: charData,
    status,
    message,
  } = ServerResSchema.parse(await res.json());
  if (status !== "ok") {
    toast.error("Error when uploading the char", { description: message });
    return;
  }
  const charParse = await CharDownloadSchema.safeParseAsync(charData);
  if (!charParse.success) {
    toast.error("Server sent incorrect char object", {
      description: charParse.error.message,
    });
    return;
  }
  Object.assign(char, charParse.data);
  commit(char, null, true);
}

async function uploadNew(char: CharObj, user: UserObj) {
  user = await User.checkSession(user);
  let res;
  try {
    res = await fetch(config.baseURL + "api/chars/new", {
      method: "POST",
      headers: Object.assign(jsonHeaders(), authHeader(user)),
      body: JSON.stringify(CharUploadSchema.parse(char)),
    });
  } catch {}
  if (!res) {
    toast.error("Failed to upload the char", {
      description: "You can try again later",
    });
    return;
  }
  const {
    data: charData,
    status,
    message,
  } = ServerResSchema.parse(await res.json());
  if (status !== "ok") {
    toast.error("Error when uploading the char", { description: message });
    return;
  }
  const charParse = await CharDownloadSchema.safeParseAsync(charData);
  if (!charParse.success) {
    toast.error("Server sent incorrect char object", {
      description: charParse.error.message,
    });
    return;
  }
  Object.assign(char, charParse.data);
  commit(char, null, true);
}

function commit(char: CharObj, user: UserObj | null = null, localonly = false) {
  char.updatedAt = Date.now();
  const promise = db.chars.put(char);
  if (localonly || !user) return promise;
  User.updLastCommit(user);
  promise.then((id) => {
    if (User.online(user, true)) {
      db.chars.get(id).then((c) => {
        if (c) {
          if (c) upload(c, user);
          //else uploadNew(c, user);
        }
      });
    }
  });
}

function bulkCommit(chars: CharObj[], user: UserObj | null = null) {
  chars.map((c) => (c.updatedAt = Date.now()));
  const promise = db.chars.bulkPut(chars);
  if (!user) return promise;
  return promise.then(async () => {
    if (User.online(user, true)) {
      const payload = {
        chars: chars.map((c) => CharUploadSchema.parse(c)),
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
          "Error bulk uploading chars (server sent wrong response)",
          error
        );
        return -1;
      }
      if (data.status !== "ok") {
        console.error(
          "Error bulk uploading chars, server refused",
          data.message
        );
        return -1;
      }
    }
  });
}

function validate(char: any) {
  return schema.safeParse(char);
}

const CharDBSchema = schema.superRefine(async (char, ctx) => {
  if (char.archived) return;
  const gameIds = (await db.games.where("archived").equals(0).toArray()).map(
    (i) => i.uuid
  );
  if (!gameIds.includes(char.gameId))
    ctx.addIssue({
      code: ZodIssueCode.custom,
      path: ["gameId"],
      message: "Char does not belong to any valid game",
    });
});

async function validateDB(char: CharObj) {
  return CharDBSchema.safeParseAsync(char);
}

function addNew(char: CharObj, user: UserObj | null = null, localonly = false) {
  const charToAdd: any = char;
  if (char.id === -1) delete charToAdd.id;
  const promise = db.chars.add(charToAdd as CharObj);
  if (localonly || !user) return promise;
  promise.then((id) => {
    if (User.online(user, true)) {
      db.chars.get(id).then((c) => {
        if (c) uploadNew(c, user);
      });
    }
  });
}

async function archive(char: CharObj) {
  char.archived = 1;
  char.archivedAt = Date.now();
  const saves = await db.saves
    .where("charId")
    .equals(char.uuid)
    .and((s) => !s.archived)
    .toArray();
  saves.map((s) => {
    Save.archive(s);
  });
  return {
    affectedSaves: saves,
  };
}

function unarchive(char: CharObj) {
  char.archived = 0;
  char.archivedAt = 0;
}

function autofix(char: CharObj) {
  const base = createEmptyChar();
  if (char?.id !== undefined) base.id = char.id;
  if (char?.uuid && char?.uuid !== undefined) base.uuid = char.uuid;
  if (char?.remoteId !== undefined) base.remoteId = char.remoteId;
  if (char?.name !== undefined) base.name = char.name;
  if (char?.gameId !== undefined) base.gameId = char.gameId;
  for (let slot of char?.slots ?? []) {
    const { success, data } = z
      .union([z.string().uuid(), z.literal("")])
      .safeParse(slot);
    if (success) base.slots.push(data);
  }
  if (char?.archived !== undefined)
    base.archived = Number(!!char.archived) as 0 | 1;
  if (char?.archivedAt !== undefined && !isNaN(char.archivedAt))
    base.archivedAt = char.archivedAt;
  return base;
}

async function getStats(char: CharObj) {
  const saves = await db.saves
    .where("charId")
    .equals(char.uuid)
    .and((s) => !s.archived)
    .toArray();
  return {
    saveCount: saves.length,
  };
}

function invalidateRemoteIds() {
  return db.chars.toArray().then((chars) => {
    chars.map((c) => (c.remoteId = null));
    return bulkCommit(chars);
  });
}

//export type charType = z.infer<typeof schema> // can replace types.d.ts
export const Char = {
  createEmptyChar,
  addNew,
  commit,
  bulkCommit,
  validate,
  validateDB,
  schema,
  archive,
  unarchive,
  getStats,
  autofix,
  invalidateRemoteIds,
};

const _global = window as any;
_global.Char = Char;
