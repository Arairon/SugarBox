import Home from "./Home.tsx"
import Error from "./Error.tsx"
import Debug from "./Debug.tsx"
import Games from "./Games.tsx"
import GameEditor from "./GameEditor.tsx"
import Utils from "./Utils.tsx"

export const pages = {
  home: Home,
  debug: Debug,
  error: Error,
  games: Games,
  gameEditor: GameEditor,
  utils: Utils,
  account: Error,
  login: Error,
  register: Error
} as const
