import type { CharObj, GameObj, UserObj } from "@/shared/types";
import { create } from "zustand";
import { pages } from "../pages/pagesIndex";

interface SugarBoxState {
  page: keyof typeof pages;
  user: UserObj | null
  game: GameObj | null
  char: CharObj | null

  setPage: (page: keyof typeof pages) => void
  setUser: (user: UserObj | null) => void
  setGame: (game: GameObj | null) => void
  setChar: (char: CharObj | null) => void
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
}))
