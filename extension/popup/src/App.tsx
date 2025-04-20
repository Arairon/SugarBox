import './App.css'
import { Route, Routes, useLocation, useNavigate } from 'react-router'
import { Home } from './pages/Home'
import Test from './pages/Test'
import { db } from './db'
import { useLiveQuery } from 'dexie-react-hooks'
import { Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectGroup,
  SelectLabel,
  SelectValue, } from './components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "./components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { SideBorderButton } from './components/ui/button'
import { Toaster } from "./components/ui/sonner"
import React, { createContext, useContext, useEffect, useState } from 'react'
import { GameObj, CharObj, UserObj } from './types'
import { getCurrentBrowserTab } from './logic/browser'
import { User } from './logic/user'
import { Games, GamesNew } from './pages/Games'
import { ChevronLeft, CloudOff, Globe, GlobeLock, HardDrive, LoaderCircleIcon, LogOut, User2Icon, UserPlus2Icon, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { Utils } from './pages/Utils'
import { Switch } from './components/ui/switch'
import { Account, AccountInfo, Login, Register } from './pages/User'

// import { authClient } from './auth-client'
// const { useSession } = authClient;

type classNameArgs = {className?: string}

function CharList({className}: classNameArgs) {
  const {selectedGame} = useContext(GameContext)!;
  const {selectedChar, setSelectedChar} = useContext(CharContext)!;
  const chars = useLiveQuery(() => db.chars.where("gameId").equals(selectedGame?.uuid ?? -1).and(c=>!c.archived).toArray(), [selectedGame]) ?? [];
  const navigate = useNavigate();

  //const charIds = chars.map((c)=>c.id)
  //if (selectedChar && !charIds.includes(selectedChar.id)) setSelectedChar(null)

  return (
    <Select 
    disabled={!selectedGame}
    value={selectedChar !== null ? selectedChar.id.toString() : "-1"}
    onValueChange={async (value)=>{
      if (value == "-2") {
        //toast.info("You can create characters by clicking on the game and switching to 3rd page", {duration:3000})
        navigate("/games?start=3")
        return;
      }
      const char = await db.chars.get(Number(value)) ?? null
      if (char && ((char?.gameId !== selectedGame?.uuid) || char?.archived)) {
        setSelectedChar(null)
        return;
      }
      setSelectedChar(char)
      if (selectedGame) {
        chrome.storage.local.get("latestChars").then((obj)=>{
          let latestChars = obj?.latestChars ?? {};
          latestChars[selectedGame.id] = char?.id;
          chrome.storage.local.set({latestChars})
        })
        navigate("/")
      }
      }}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Any"/>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Character</SelectLabel>
          <SelectItem value="-1">Any</SelectItem>
          {chars.map((char)=>(
            <SelectItem value={char.id.toString()}>{char.name}</SelectItem>
          ))}
          <SelectItem value="-2">New character</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}



function SelectedGameButton() {
  const {selectedGame} = useContext(GameContext)!;
  const navigate = useNavigate();
  const location = useLocation();

  let gameName;
  if (selectedGame) {
    gameName = <>{selectedGame.name}</>
  } else {
    gameName = <>No game found</>
  }

  const handleClick = async () => {
    if (location.pathname === "/games") navigate("/")
    else navigate("/games")
  }

  return (
    <SideBorderButton variant="ghost" onClick={handleClick} 
    className="self-start flex-3 clickable border-r-1"
    >
      <a className="inline-block truncate">{gameName}</a>
    </SideBorderButton>
  )
}

type LatestGameType = {
  url: string;
  id: number;
}
async function getCurrentGame(currentGame:GameObj|null=null): Promise<GameObj|null> {
  const tab = await getCurrentBrowserTab();
  if (!tab?.url) return null;
  const path = tab.url as string;
  const latestGame: LatestGameType|null = (await chrome.storage.local.get("latestGame"))?.latestGame
  if (latestGame &&
    latestGame.id != -1 &&
    latestGame.url == path
  ) {
    const game = await db.games.get(latestGame.id) ?? null;
    if (game && !game.archived && game.paths.map(p=>p.url).includes(path)) return game
    return null
  }
  if (
    currentGame &&
    currentGame.paths.map(p=>p.url).includes(path)
  )
    return currentGame;
  const games = await db.games.where("archived").equals(0).sortBy("createdAt");
  for (const game of await games) {
    if (game.paths.map(p=>p.url).includes(path)) {
      chrome.storage.local.set({
        latestGame: {
          url: path,
          id: game.id
        }
      })
      return game;
    }
  }
  chrome.storage.local.set({
    latestGame: {
      url: path,
      id: -1
    }
  })
  return null;
}

function Header() {
  const gamecontext = useContext(GameContext);
  const charcontext = useContext(CharContext);
  if (!gamecontext || !charcontext) return;
  // useEffect(()=>{
  //   init(gamecontext, charcontext)
  // }, [])

  return (
    <header className="content-center grow-0 ">
      <div className="flex flex-row ml-2 mr-2">
        <SelectedGameButton/>
        <CharList className={"clickable flex-2 flex content-center bg-transparent border-2 border-l-1 border-l-cyan-700 border-r-cyan-700 hover:border-l-cyan-600 hover:border-r-cyan-600 border-t-0 border-b-0 rounded-none dark:hover:bg-accent/50"}/>
      </div>
    </header>
  )
}

function UserMenu({className}: classNameArgs) {
  const {currentUser, setCurrentUser} = useContext(UserContext)!;
  const location = useLocation();
  //const {onlineMode} = useState(currentUser.onlineMode)
  const navigate = useNavigate()

  const username = currentUser.id ? currentUser.displayname : "Not logged in"
  let statusIcon;
  let statusDescription;
  let statusDescriptionExtra;
  if (currentUser.id && currentUser.onlineMode) {
    if (User.online(currentUser)) {
      if (User.online(currentUser, true)) {
        statusIcon = <Globe/>
        statusDescription = "Online"
      }else {
        statusIcon = <GlobeLock/>
        statusDescription = "Online (limited)"
        statusDescriptionExtra="Your account is unable to use cloud functionality"
      }
    } else {
      statusIcon = <CloudOff/>
      statusDescription = "Offline (unable to connect)"
      statusDescriptionExtra = currentUser.offlineReason
    }
  } else {
    statusIcon = <HardDrive/>
    statusDescription = currentUser.onlineMode ? "Offline" : "Offline mode (manual)"
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={className} asChild>
        <div className="flex flex-row gap-2 justify-center items-center">
        <a className="grow self-stretch inline-block truncate max-w-32">{username}</a>
        <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            {statusIcon}
          </TooltipTrigger>
          <TooltipContent className="bg-slate-900 text-white border-1">
            <p>{statusDescription}</p>
            {statusDescriptionExtra && <p className='text-xs text-gray-400'>{statusDescriptionExtra}</p>}
          </TooltipContent>
        </Tooltip>
        </TooltipProvider>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={(e)=>{
          e.preventDefault()
          const newuser = User.copy(currentUser)
          newuser.onlineMode = !newuser.onlineMode
          User.commit(newuser)
          if (newuser.onlineMode && newuser.id) {
            User.updateSelf(newuser).then(async u=>{
              setCurrentUser(u.user)
              User.commit(u.user)
              User.sync(u.user, new Date(await User.getLastCommitTime() ?? 0))
            })
          }
          setCurrentUser(newuser)
          }}><a className='grow'>Online</a> <Switch checked={currentUser.onlineMode}/></DropdownMenuItem>
        {currentUser.id ? (
          <>
          <DropdownMenuItem onClick={()=>{navigate("/account")}}><User2Icon/> Account</DropdownMenuItem>
          <DropdownMenuItem onClick={()=>{
            const user = User.logout(currentUser)
            setCurrentUser(user)
            if (location.pathname.startsWith("/account")) navigate("/")
          }
          }><LogOut className='rotate-180'/> Log Out</DropdownMenuItem>
          </>
        ) : (
          <>
          <DropdownMenuItem onClick={()=>navigate("/login")}><LogOut/> Log In</DropdownMenuItem>
          <DropdownMenuItem onClick={()=>navigate("/register")}><UserPlus2Icon/> Register</DropdownMenuItem>
          </>
        )}
        </DropdownMenuContent>
    </DropdownMenu>
  )
}
function HomeButton() {
  const navigate = useNavigate();

  return (
    <SideBorderButton variant="ghost" onClick={()=>navigate("/")}
    className='w-10 clickable hover:bg-transparent border-r-1'
    ><ChevronLeft/></SideBorderButton>
  )
}

function UtilsButton() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = () => {
    if (location.pathname === "/utils") navigate("/")
    else navigate("/utils")
  }

  return (
    <SideBorderButton variant="ghost" onClick={handleClick}
    className='w-10 clickable hover:bg-transparent border-l-1'
    ><Wrench/></SideBorderButton>
  )
}

// function BugReportButton() {
//   const navigate = useNavigate();
//   const location = useLocation();

//   const handleClick = () => {
//     if (location.pathname === "/bugreport") navigate("/")
//     else navigate("/bugreport")
//   }

//   return (
//     <SideBorderButton variant="ghost" onClick={handleClick}
//     className='w-10 clickable hover:bg-transparent border-l-1'
//     ><BugIcon className="hover:text-red-300"/></SideBorderButton>
//   )
// }

function Footer() {
  return (
    <footer className="content-center grow-0 ">
      <div className="mx-2 flex flex-row justify-start items-stretch ">
        <div className="flex-3 flex flex-row justify-start items-stretch">
        <HomeButton/>
        <UtilsButton/>
        {/* <BugReportButton/> */}
        </div>
        <UserMenu
        className="flex-2 clickable border-2 border-l-cyan-700 border-r-cyan-700 hover:border-l-cyan-600 hover:border-r-cyan-600
        border-t-0 border-b-0 rounded-none dark:hover:bg-accent/50 h-9 px-4 py-2 text-sm font-medium"
        />
      </div>
    </footer>
  )
}

const GameContext = createContext<{selectedGame: GameObj | null, setSelectedGame: React.Dispatch<React.SetStateAction<GameObj|null>>} | null>(null)
const CharContext = createContext<{selectedChar: CharObj | null, setSelectedChar: React.Dispatch<React.SetStateAction<CharObj|null>>} | null>(null)
const UserContext = createContext<{currentUser: UserObj, setCurrentUser: React.Dispatch<React.SetStateAction<UserObj>>} | null>(null)

export {GameContext, CharContext, UserContext}

async function init({setSelectedGame, setSelectedChar, setCurrentUser, setInit}: 
  {setSelectedGame: React.Dispatch<React.SetStateAction<null|GameObj>>,
    setSelectedChar: React.Dispatch<React.SetStateAction<null|CharObj>>,
    setCurrentUser: React.Dispatch<React.SetStateAction<UserObj>>,
    setInit: React.Dispatch<React.SetStateAction<boolean>>}) {
  const loadTimeoutWarning = setTimeout(()=>{
    toast.info("Something might have went wrong", {
      description: "Please head to the utilities menu in the bottom left and run checks or try the 'fix db' function",
    })
  }, 2000)
  User.loadUser().then(async storedUser=>{
    setCurrentUser(storedUser)
    if (!storedUser.onlineMode || !storedUser.id) {
      return;
    }
    const user = await User.init(storedUser)
    setCurrentUser(user)
    User.commit(user)
  })
  const game = await getCurrentGame()
  setSelectedGame(game)
  if (game) {
    const lastChars = (await chrome.storage.local.get("latestChars"))?.latestChars ?? {};
    const char = await db.chars.get(lastChars[game.id] ?? -1);
    if (char && !char.archived) setSelectedChar(char)
  }
  //setSelectedGame(await db.games.get(1) ?? null)
  setInit(true)
  clearTimeout(loadTimeoutWarning)
  

}

export function App() {
  const [selectedGame, setSelectedGame]: [GameObj | null, React.Dispatch<React.SetStateAction<GameObj|null>>]  = useState(null) as [null | GameObj, React.Dispatch<React.SetStateAction<null|GameObj>>]
  const [selectedChar, setSelectedChar]: [CharObj | null, React.Dispatch<React.SetStateAction<CharObj|null>>]  = useState(null) as [null | CharObj, React.Dispatch<React.SetStateAction<null|CharObj>>]
  const [currentUser, setCurrentUser]: [UserObj, React.Dispatch<React.SetStateAction<UserObj>> ] = useState(User.createEmptyUser())
  const [initialized, setInit] = useState(false)
  useEffect(()=>{
    init({setSelectedGame, setSelectedChar, setCurrentUser, setInit})
  }, [])


  return (
    <>
      <Toaster closeButton />
      <GameContext.Provider value={{selectedGame, setSelectedGame}}>
      <CharContext.Provider value={{selectedChar, setSelectedChar}}>
      <UserContext.Provider value={{currentUser, setCurrentUser}}>
        <div className="flex flex-col h-full">
        <Header/>
        <div className="grow flex flex-col items-center px-1 max-h-[270px]">
        <Routes>
        {initialized ? (
          <>
          <Route index element={<Home/>}></Route>
          <Route path="/test" element={<Test/>}></Route>
          <Route path="/games" element={<Games/>}></Route>
          <Route path="/games-new" element={<GamesNew/>}></Route>
          <Route path="/utils" element={<Utils/>}></Route>
          <Route path="/login" element={<Login/>}></Route>
          <Route path="/register" element={<Register/>}></Route>
          <Route path="/account" element={<Account/>}></Route>
          <Route path="/accountinfo" element={<AccountInfo/>}></Route>
          </>
        ) : (
          <>
          <Route index element={<Loading/>}></Route>
          <Route path="/utils" element={<Utils/>}></Route>
          </>
        )}
        </Routes>
        </div>
        <Footer/>
        </div>
      </UserContext.Provider>
      </CharContext.Provider>
      </GameContext.Provider>
    </>
  )
}

function Loading() {
  return (
    <div className="flex flex-col justify-center content-center items-center grow">
      <a className="animate-spin text-cyan-950"><LoaderCircleIcon size={72}/></a>
    </div>
  )
}