import { v6 as uuidv6 } from "uuid";
import { z } from "zod";

const syncStatuses = ["created", "updated", "deleted", "synced"] as const

export const SyncStatusSchema = z.union(syncStatuses.map(i => z.literal(i)))
export type SyncStatus = z.infer<typeof SyncStatusSchema>

export const GamePathSchema = z.object({
  name: z.string().nullable().default(null),
  url: z.string().nonempty(),
});

export const GameSchema = z.object({
  id: z.number().int(),
  uuid: z.uuid(),
  remoteId: z.number().int(),
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
  // syncStatus: SyncStatusSchema.default("created"),
  // syncedAt: z.number().default(0),
});

export type GamePathObj = z.infer<typeof GamePathSchema>;
export type GameObj = z.infer<typeof GameSchema>;

export function createEmptyGameObject(): GameObj {
  return {
    id: -1,
    uuid: uuidv6(),
    remoteId: -1,
    name: "",
    shortname: "",
    paths: [],
    archived: 0,
    archivedAt: 0,
    updatedAt: Date.now(),
    createdAt: Date.now(),
    // syncStatus: "created",
    // syncedAt: 0,
  };
}

export const CharSchema = z.object({
  id: z.number().int(),
  uuid: z.uuid(),
  remoteId: z.number().int(),
  name: z.string(),
  gameId: z.string(), //.uuid(),
  slots: z.array(z.union([z.uuid(), z.literal("")])), // Array of save uuids or empty slots
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
  // syncStatus: SyncStatusSchema.default("created"),
  // syncedAt: z.number().default(0),
});

export type CharObj = z.infer<typeof CharSchema>;

export function createEmptyCharObject(): CharObj {
  return {
    id: -1,
    uuid: uuidv6(),
    remoteId: -1,
    name: "",
    gameId: "",
    slots: [],
    archived: 0,
    archivedAt: 0,
    updatedAt: Date.now(),
    createdAt: Date.now(),
    // syncStatus: "created",
    // syncedAt: 0,
  };
}

export const SaveSchema = z.object({
  id: z.number().int(),
  uuid: z.uuid(),
  remoteId: z.number().int(),
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
  // syncStatus: SyncStatusSchema.default("created"),
  // syncedAt: z.number().default(0),
});

export type SaveObj = z.infer<typeof SaveSchema>;

export function createEmptySaveObject(): SaveObj {
  return {
    id: -1,
    uuid: uuidv6(),
    remoteId: -1,
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
    // syncStatus: "created",
    // syncedAt: 0,
  };
}

export const UserSchema = z.object({
  id: z.number().int().nullable().default(null),
  username: z.string().default(""),
  displayname: z.string().default(""),
  email: z.string().default(""),
  emailConfirmed: z.boolean().default(false),
  // accessToken: z.string().nullable().default(null),
  // refreshToken: z.string().nullable().default(null),
  role: z.enum(["user", "admin", "limited"]).default("user"),
  online: z.boolean().default(false),
  offlineReason: z.string().default(""),
  onlineMode: z.boolean().default(true),
  lastSyncedAt: z.number().int().default(0),
  // syncPeriod: z.number().int().default(300), // sync period in seconds. 0 = live
})

export type UserObj = z.infer<typeof UserSchema>;

export function createEmptyUserObject(): UserObj {
  return UserSchema.parse({});
}

export type SugarBoxPageCommand =
  | { cmd: "check_sugarcube" }
  // | { cmd: "reinit", args?: [number] } |
  | { cmd: "get_passage" }
  | { cmd: "save" }
  | { cmd: "load", args: [string] }

export type SugarBoxPageRequest = {
  id?: number;
} & SugarBoxPageCommand

export type SugarBoxPageResponse = {
  id: number,
  data: null
  | string
  | boolean
  | undefined
  | {
    passage: string;
    data: string | null;
    description: string;
    version: string;
  }
}

export type ChromeMessageCommand =
  | { cmd: "ping" }
  | { cmd: "get_state" }


export type ChromeMessageRequest = {
  target: "background" | "popup",
} & ChromeMessageCommand
