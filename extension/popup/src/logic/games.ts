import { GameObj, GamePathObj, SaveObj, UserObj } from "@/types";
import { v6 as uuidv6 } from "uuid";
import { db } from "@/db";
import { z } from "zod";
import { Char } from "./chars";
import { authHeader, jsonHeaders, ServerResSchema, User } from "./user";
import { config } from "@/config";
import { toast } from "sonner";

export const GamePathSchema = z.object({
  name: z.string().nullable().default(null),
  url: z.string().nonempty(),
});

export const schema = z.object({
  id: z.number().int(),
  uuid: z.string().uuid(),
  remoteId: z.number().int().nullable(),
  name: z.string(),
  shortname: z.string(),
  paths: z.array(GamePathSchema),
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

function createEmptyGame(): GameObj {
  return {
    id: -1,
    uuid: uuidv6(),
    remoteId: null,
    name: "",
    shortname: "",
    paths: [],
    archived: 0,
    archivedAt: 0,
    updatedAt: Date.now(),
    createdAt: Date.now(),
  };
}

function commit(game: GameObj, user: UserObj | null = null, localonly = false) {
  game.updatedAt = Date.now();
  const promise = db.games.put(game);
  if (localonly || !user) return promise;
  User.updLastCommit(user);
  promise.then((id) => {
    if (User.online(user, true)) {
      db.games.get(id).then((g) => {
        if (g) upload(g, user);
      });
    }
  });
}

function validate(game: any) {
  return schema.safeParse(game);
}

function addNew(game: GameObj, user: UserObj | null = null, localonly = false) {
  const gameToAdd: any = game;
  if (game.id === -1) delete gameToAdd.id;
  const promise = db.games.add(gameToAdd as GameObj);
  if (localonly || !user) return promise;
  return promise.then((id) => {
    if (User.online(user, true)) {
      return db.games.get(id).then((g) => {
        if (g) uploadNew(g, user);
      });
    }
  });
}

export const GameUploadSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string(),
  shortname: z.string().default(""),
  paths: z.array(GamePathSchema).transform((p) => JSON.stringify(p)),
  archived: z.boolean({ coerce: true }),
  archivedAt: z.date({ coerce: true }).default(new Date(0)),
  updatedAt: z.date({ coerce: true }).default(() => new Date()),
  createdAt: z.date({ coerce: true }).default(() => new Date()),
});

export const GameDownloadSchema = z
  .object({
    id: z.number().optional(),
    uuid: z.string().uuid(),
    remoteId: z.any().transform(() => null as number | null),
    name: z.string(),
    shortname: z.string().default(""),
    paths: z
      .string()
      .transform((p) => z.array(GamePathSchema).parse(JSON.parse(p))),
    archived: z.boolean().transform((v) => Number(v)),
    archivedAt: z.date({ coerce: true }).transform((v) => v.getTime()),
    updatedAt: z.date({ coerce: true }).transform((v) => v.getTime()),
    createdAt: z.date({ coerce: true }).transform((v) => v.getTime()),
  })
  .transform((g) => parseRemoteId(g as GameObj));

function parseRemoteId(game: Omit<GameObj, "id"> & { id?: number }) {
  game.remoteId = game.id!;
  delete game.id;
  return game as GameObj;
}

async function upload(game: GameObj, user: UserObj) {
  user = await User.checkSession(user);
  let res;
  try {
    res = await fetch(config.baseURL + "api/games/uuid/" + game.uuid, {
      method: "PATCH",
      headers: Object.assign(jsonHeaders(), authHeader(user)),
      body: JSON.stringify(GameUploadSchema.parse(game)),
    });
  } catch {}
  if (!res) {
    toast.error("Failed to upload the game", {
      description: "You can try again later",
    });
    return;
  }
  const {
    data: gameData,
    status,
    message,
  } = ServerResSchema.parse(await res.json());
  if (status !== "ok") {
    toast.error("Error when uploading the game", { description: message });
    return;
  }
  const gameParse = GameDownloadSchema.safeParse(gameData);
  if (!gameParse.success) {
    toast.error("Server sent incorrect game object", {
      description: gameParse.error.message,
    });
    return;
  }
  Object.assign(game, gameParse.data);
  commit(game, null, true);
}

async function uploadNew(game: GameObj, user: UserObj) {
  user = await User.checkSession(user);
  let res;
  try {
    res = await fetch(config.baseURL + "api/games/new", {
      method: "POST",
      headers: Object.assign(jsonHeaders(), authHeader(user)),
      body: JSON.stringify(GameUploadSchema.parse(game)),
    });
  } catch {}
  if (!res) {
    toast.error("Failed to upload the game", {
      description: "You can try again later",
    });
    return;
  }
  const {
    data: gameData,
    status,
    message,
  } = ServerResSchema.parse(await res.json());
  if (status !== "ok") {
    toast.error("Error when uploading the game", { description: message });
    return;
  }
  const gameParse = GameDownloadSchema.safeParse(gameData);
  if (!gameParse.success) {
    toast.error("Server sent incorrect game object", {
      description: gameParse.error.message,
    });
    return;
  }
  Object.assign(game, gameParse.data);
  commit(game, null, true);
}

async function archive(game: GameObj) {
  game.archived = 1;
  game.archivedAt = Date.now();
  let saves = [] as SaveObj[];
  const chars = await db.chars
    .where("gameId")
    .equals(game.uuid)
    .and((c) => !c.archived)
    .toArray();
  for (const char of chars) {
    const res = await Char.archive(char);
    saves = saves.concat(res.affectedSaves);
  }
  return {
    affectedChars: chars,
    affectedSaves: saves,
  };
}

function unarchive(game: GameObj) {
  game.archived = 0;
  game.archivedAt = 0;
}

function autofix(game: GameObj) {
  const base = createEmptyGame();
  if (game?.id !== undefined) base.id = game.id;
  if (game?.uuid && game?.uuid !== undefined) base.uuid = game.uuid;
  if (game?.remoteId !== undefined) base.remoteId = game.remoteId;
  if (game?.name !== undefined) base.name = game.name;
  if (game?.shortname !== undefined) base.shortname = game.shortname;
  for (let path of game?.paths ?? []) {
    let newpath = {} as GamePathObj;
    if (typeof path === "string") newpath.url = path;
    else if (typeof path === "object") {
      if (path?.url) newpath.url = path.url;
      if (path?.name) newpath.name = path.name;
    }
    if (newpath.url) base.paths.push(newpath);
  }
  if (game?.archived !== undefined)
    base.archived = Number(!!game.archived) as 0 | 1;
  if (game?.archivedAt !== undefined && !isNaN(game.archivedAt))
    base.archivedAt = game.archivedAt;
  return base;
}

function invalidateRemoteIds() {
  return db.games.toArray().then((games) => {
    games.map((g) => (g.remoteId = null));
    return db.games.bulkPut(games);
  });
}

//export type gameType = z.infer<typeof schema> // can replace types.d.ts
export const Game = {
  createEmptyGame,
  addNew,
  commit,
  validate,
  schema,
  archive,
  unarchive,
  autofix,
  invalidateRemoteIds,
};

const _global = window as any;
_global.Game = Game;
