import { createEmptyUserObject, type CharObj, type GameObj, type UserObj } from "@/shared/types";
import { create } from "zustand";
import { pages } from "../pages/pagesIndex";
import { sendMessage } from "webext-bridge/popup";

interface SugarBoxState {
  page: keyof typeof pages;
  user: UserObj
  game: GameObj | null
  char: CharObj | null

  setPage: (page: keyof typeof pages) => void
  setUser: (user: UserObj) => void
  setGame: (game: GameObj | null) => void
  setChar: (char: CharObj | null) => void
  set: (user: UserObj, game: GameObj | null, char: CharObj | null) => void
}

export const useSugarBoxState = create<SugarBoxState>()((set) => ({
  page: "home",
  user: createEmptyUserObject(),
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
  const editorState = useSugarBoxState.getState()
  if (editorState.game && editorState.game.id === state.game?.id) {
    editorState.setGame(state.game)
  }
  console.log(useSugarBoxState.getState())
}

interface GameEditorState {
  game: GameObj | null
  page: number
  setGame: (game: GameObj | null) => void,
  setPage: (page: number) => void,
  open: (game: GameObj, page?: number) => void,
}

export const useGameEditorState = create<GameEditorState>()((set) => ({
  game: null,
  page: 1,
  setGame: (game) => set({ game }),
  setPage: (page) => set({ page }),
  open: (game, page = 1) => {
    useSugarBoxState.getState().setPage("gameEditor")
    set({ game, page })
  }
}))
