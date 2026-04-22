import { type UserObj, type GameObj, type CharObj, createEmptyUserObject } from "@/shared/types"
import {onMessage} from "webext-bridge/background"

export type SugarBoxState = {
  user: UserObj
  game: GameObj | null
  char: CharObj | null
  tabId: number
}

export const state: SugarBoxState = {
  user: createEmptyUserObject(),
  game: null,
  char: null,
  tabId: 0
}

onMessage("bg_get_state", ()=>state)
