import Home from "./Home.tsx"
import Error from "./Error.tsx"
import Debug from "./Debug.tsx"
import Games from "./Games.tsx"
import GameEditor from "./GameEditor.tsx"
import Utils from "./Utils.tsx"
import Account from "./Account/Account.tsx"
import Login from "./Account/Login.tsx"
import Register from "./Account/Register.tsx"
import Trash from "./Trash.tsx"

export const pages = {
  home: Home,
  debug: Debug,
  games: Games,
} as const

export const nonActivityPages = {
  utils: Utils,
  gameEditor: GameEditor,
  account: Account,
  login: Login,
  register: Register,
  error: Error,
  trash: Trash,
} as const
