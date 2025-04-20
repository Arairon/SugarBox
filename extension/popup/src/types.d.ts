import { schema as GameSchema, GamePathSchema } from "./logic/games";
import { schema as CharSchema } from "./logic/chars";
import { schema as SaveSchema } from "./logic/saves";
import { schema as UserSchema } from "./logic/user";
import { z } from "zod";

export type GameObj = z.infer<typeof GameSchema>;
export type CharObj = z.infer<typeof CharSchema>;
export type SaveObj = z.infer<typeof SaveSchema>;
export type UserObj = z.infer<typeof UserSchema>;
export { GameSchema, CharSchema, SaveSchema, UserSchema };

export type StateType = {
  last_char: number;
};

export type GamePathObj = z.infer<typeof GamePathSchema>;

// export type UserObj = {
//   id: number;
//   name: string;
//   token: string;
//   role: string;
//   online: boolean;
// };

// export type CharObj = {
//   id: number;
//   uuid: string;
//   remoteId: number | null;
//   gameId: number;
//   name: string;
//   slots: number[];
//   archived: 0 | 1;
//   archivedAt: number;
// };

// export type GameObj = {
//   id: number;
//   uuid: string;
//   remoteId: number | null;
//   name: string;
//   shortname: string | null;
//   description: string;
//   pending_upload?: boolean;
//   paths: string[];
//   archived: 0 | 1;
//   archivedAt: number;
// };

// export type SaveObj = {
//   id: number;
//   uuid: string;
//   remoteId: number | null;
//   name: string;
//   description: string;
//   gameVersion: string;
//   createdAt: number;
//   gameId: number;
//   charId: number;
//   data: string;
//   hash: string;
//   archived: 0 | 1;
//   archivedAt: number;
// };
