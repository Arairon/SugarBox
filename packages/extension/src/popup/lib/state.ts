import type { CharObj, GameObj, UserObj } from "@/shared/types";
import { create } from "zustand";
import { pages } from "../pages/pagesIndex";
import { sendMessage } from "webext-bridge/popup";

interface SugarBoxState {
  page: keyof typeof pages;
  user: UserObj | null
  game: GameObj | null
  char: CharObj | null

  setPage: (page: keyof typeof pages) => void
  setUser: (user: UserObj | null) => void
  setGame: (game: GameObj | null) => void
  setChar: (char: CharObj | null) => void
  set: (user: UserObj | null, game: GameObj | null, char: CharObj | null) => void
}

export const useSugarBoxState = create<SugarBoxState>()((set) => ({
  page: "home",
  user: null,
  game: null,
  char: null,

  setPage: (page) => set({ page }),
  setUser: (user) => set({ user }),
  setGame: (game) => set({ game }),
  setChar: (char) => set({ char }),
  set: (user, game, char) => set({ user, game, char })
}))


export async function loadBackgroundState() {
  const state = await sendMessage("bg_get_state", undefined, "background")
  console.log("Received BG state:", state)
  useSugarBoxState.getState().set(state.user, state.game, state.char)
  console.log(useSugarBoxState.getState())
}

interface GameEditorState {
  game: GameObj | null
  setGame: (game: GameObj | null) => void,
  open: (game: GameObj) => void,
}

export const useGameEditorState = create<GameEditorState>()((set) => ({
  game: null,
  setGame: (game) => set({ game }),
  open: (game) => {
    console.log("1", game)
    useSugarBoxState.getState().setPage("gameEditor")
    set({ game })
    console.log("2", game)
  }
}))
