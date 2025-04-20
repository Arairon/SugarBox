import { db } from "@/db";
import { Game } from "./games";
import { Char } from "./chars";
import { ZodError, ZodIssue } from "zod";
import { GameObj, CharObj, SaveObj } from "@/types";
import { Save } from "./saves";

export async function checkGames() {
  const games = await db.games.toArray();
  const errors: [GameObj, ZodError][] = [];
  for (let game of games) {
    const res = Game.validate(game);
    if (res.error) errors.push([game, res.error]);
  }
  return errors;
}
export async function checkChars() {
  const chars = await db.chars.toArray();
  const errors: [CharObj, ZodError][] = [];
  for (let char of chars) {
    const res = await Char.validateDB(char);
    if (res.error) errors.push([char, res.error]);
  }
  return errors;
}
export async function checkSaves() {
  const saves = await db.saves.toArray();
  const errors: [SaveObj, ZodError][] = [];
  for (let save of saves) {
    const res = await Save.validateDB(save);
    if (res.error) errors.push([save, res.error]);
  }
  return errors;
}
export async function globalCheck(
  print = false
): Promise<{ [key: string]: [any, ZodError][] }> {
  const errors = {
    games: await checkGames(),
    chars: await checkChars(),
    saves: await checkSaves(),
  };
  if (print) {
    for (let [k, v] of Object.entries(errors)) {
      for (let [item, error] of v) console.error(`${k}: ${error}`, item);
    }
  }
  return errors;
}

export function formatZodIssue(issue: ZodIssue) {
  return `${issue.path}: ${issue.message}`;
}

const _globals = window as any;
_globals.globalCheck = globalCheck;
