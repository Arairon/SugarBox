import { db } from "@/db";
import { useLiveQuery } from "dexie-react-hooks";
import { useContext, useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ScrollArea } from "@/components/ui/scroll-area";
import { CharObj, GameObj } from "@/types";
import { Check, ChevronDown, ChevronLeft, ChevronRight, PenIcon, Plus, StepBack, StepForward, Trash, XIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button, DoubleClickButton } from "@/components/ui/button";
import { CharContext, GameContext, UserContext } from "@/App";
// import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Game } from "@/logic/games";
import { Char } from "@/logic/chars";
import { Save } from "@/logic/saves";
import { checkSugarCube, getCurrentBrowserTab } from "@/logic/browser";
import { useNavigate } from "react-router";
import { z } from "zod";
// import { useNavigate } from "react-router";

function Games() {
  const {selectedGame, setSelectedGame} = useContext(GameContext)!;
  const [gameOverriden, setGameOverriden] = useState(false)
  const games = useLiveQuery(()=>db.games.where("archived").equals(0).toArray(), [selectedGame]) ?? []

  const params = new URLSearchParams(window.location.search)
  const startPage = z.coerce.number().default(1).transform(v=>v>=1 ? (v<=3 ? v : 3) : 1).parse(params.get("start"))

  return (
    <ScrollArea className="w-full max-h-full px-2">
    <Table className="w-full">
      <TableHeader>
        <TableRow className="w-full">
          <TableHead className="text-center py-1">
            <div className="flex">
            <Button variant={"ghost"} disabled={!selectedGame} onClick={()=>setSelectedGame(null)} className="flex-1 py-1"><StepBack/></Button>
            <a className="grow text-lg text-center font-semibold align-middle py-1">Games</a>
            <GameLaunchSelectButton game={selectedGame!} gameOverriden={gameOverriden}/>
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {selectedGame && 
        <>
          <GamesListRow game={selectedGame} defaultExpanded={!!params.get("start")} isActive={true} startPage={startPage}/>
        </>
        }
        {games.filter((obj)=>obj.id!==selectedGame?.id).map((game) => (
          <GamesListRow game={game} setGameOverriden={setGameOverriden}/>
        ))}
        {!selectedGame && games.length === 0 && <GamesEmptyNote/>}
        <GamesListRowNew/>
      </TableBody>
    </Table>
    </ScrollArea>
  )
}

function GamesEmptyNote() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col text-left py-2 px-4">
          <p className="text-center self-stretch text-lg font-bold">There are currently no games</p>
          <p className="text-pretty self-stretch text-base">
            You are free to call your games whatever you want, they are just for organizational purposes.
          </p>
        </div>
      </TableCell>
    </TableRow>
  )
}

function GameLaunchSelectButton({game, gameOverriden}: {game:GameObj|null, gameOverriden:boolean}) {
  if (!game || !gameOverriden || game?.paths?.length===1)
    return (
      <Button variant={"ghost"} disabled={!gameOverriden} className="flex-1 py-1" onClick={()=>{
        chrome.tabs.create({url: game?.paths[0]?.url})
      }}>{gameOverriden&&<>Launch <StepForward/></>}</Button>
    )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={"ghost"} disabled={!gameOverriden} className="flex-1 py-1">{gameOverriden&&<>Launch <StepForward/></>}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {game.paths.map((path)=>
          <DropdownMenuItem onClick={()=>chrome.tabs.create({url: path.url})}>
            {path.name ? (
              <>{path.name}</>
            ) : (
              <>{path.url.length>30 ? path.url.slice(0,27)+"..." : path.url}</>
            )}
          </DropdownMenuItem>
        )}
        {game.paths.length===1 && (
          <DropdownMenuItem>
            No paths found  
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function GamesListRow({game, defaultExpanded=false, isActive=false, setGameOverriden=null, startPage=1}: {game: GameObj, defaultExpanded?:boolean, isActive?:boolean, startPage?:number, setGameOverriden?: React.Dispatch<React.SetStateAction<boolean>>|null}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const {selectedGame, setSelectedGame} = useContext(GameContext)!;

  return (
    <>
    <TableRow key={game.id}>
      <TableCell className="py-1 px-2 text-left">
        <div className="grow flex flex-row gap-2">
          <Button variant="ghost" onClick={()=>{setExpanded(!expanded)}} className="font-normal grow text-left self-start justify-start truncate">
            <ChevronDown className={(expanded ? "rotate-180" : "")} size={14}/>
            <a className="inline-block truncate max-w-50">{game.shortname && <>({game.shortname}) </>}{game.name}</a>
            {isActive && <a className="inline-block text-xs text-gray-400"> (this)</a>}
          </Button>
          <div className="justify-end">
          {selectedGame ? (
            <GameDeleteDialog className="has-[>svg]:px-5" game={game}/>
          ):(
            <>
            <Button variant="outline" className="has-[>svg]:px-3 rounded-r-none" onClick={()=>{setSelectedGame(game);if (setGameOverriden) setGameOverriden(true)}}><StepForward/></Button>
            <GameDeleteDialog className="has-[>svg]:px-5 rounded-l-none" game={game}/>
            </>
          )}
          </div>
        </div>
      </TableCell>
    </TableRow>
    {expanded && <GameEditMenu game={game} startPage={startPage}/>}
    </>
  )
}

function GameDeleteDialog({game, className}: {game: GameObj, className?: string}) {
  const {currentUser: user} = useContext(UserContext)!

  async function handleConfirm() {
    const res = await Game.archive(game);
    const {affectedChars: chars, affectedSaves: saves} = res;
    Game.commit(game, user)
    const commitTimeout = setTimeout(()=>{
      Char.bulkCommit(chars, user)
      Save.bulkCommit(saves, user)
    }, 2750)
    toast.success("Game archived", {position: "bottom-left", duration:2500,
      description: `Will archive ${chars.length} char${(chars.length===1?'':'s')} and ${saves.length} save${(saves.length===1?'':'s')}`,
      cancel: {
      label: 'Undo',
      onClick: ()=>{
        clearTimeout(commitTimeout)
        chars.map(Char.unarchive)
        saves.map(Save.unarchive)
        Game.unarchive(game)
        Game.commit(game, user)
      }}
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {/* <DoubleClickButton variant="outline" onAccept={()=>handleCharDelete(char)} type="button"><Trash/></DoubleClickButton> */}
        <Button variant="outline" type="button" className={className}><Trash/></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete this game?</AlertDialogTitle>
          <AlertDialogDescription>
            This will archive the game, it's character and all their saves.<br/>
            This <i>can</i> be undone, but not easy to do, unless you undo it right away.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function GamesNew() {
  const { currentUser: user } = useContext(UserContext)!;
  const [isGametab, setGametab] = useState(false)
  const navigate = useNavigate();

  useEffect(()=>{
    try {
      checkSugarCube().then(sc=>setGametab(!!sc))
    } catch {}
  }, [])

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formElements = form.elements as typeof form.elements & {
      name: {value: string},
      shortname: {value: string},
      pathname?: {value: string},
      charname?: {value: string},
    }
    const game = Game.createEmptyGame();
    game.name = formElements.name.value
    game.shortname = formElements.shortname.value
    let pathname  = formElements.pathname?.value as string|undefined|null;
    if (typeof pathname !== "undefined") {
      if (typeof pathname === "string" && pathname.length === 0) pathname = null;
      const tab = await getCurrentBrowserTab();
      const path = (tab.url as string).trim();
      const games = await db.games.where("archived").equals(0).toArray()
      let isTaken = false;
      for (const i of games)
        if (i.paths.map(p=>p.url).includes(path)) {
          isTaken = true
          toast.error("This tab is already registered to another game", {duration:1500})
          break
        }
      if (!isTaken)
        game.paths.push({
          name: pathname ?? null,
          url: path
        })
    }
    Game.addNew(game, user).then(()=>{
      const charname = formElements.charname?.value
      if (charname) {
        const char = Char.createEmptyChar()
        char.name = charname;
        char.gameId = game!.uuid;
        Char.addNew(char, user)
      }
    })
    toast.success("Game added")
    navigate("/games")
  } 

  return (
  <ScrollArea className="w-full max-h-full px-2">
    <Table className="w-full">
      <TableHeader>
        <TableRow className="w-full">
          <TableHead className="text-center py-1">
            <div className="flex">
            <Button variant={"ghost"} disabled={true} className="w-20 py-1"></Button>
            <a className="grow text-lg text-center font-semibold align-middle py-1">New game</a>
            <Button variant={"ghost"} disabled={true} className="w-20 py-1"></Button>
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="hover:bg-muted/20">
          <TableCell>
            <form onSubmit={handleSubmit}>
            <div className="grid w-full items-center gap-2">
              <div className="flex">
                <Input
                id="name" placeholder="Name"
                className="rounded-r-none flex-10 px-2"
                autoComplete="off"
                minLength={1}
                />
                <Input
                id="shortname" placeholder="Tag*"
                minLength={1}
                maxLength={5}
                className="rounded-l-none flex-2"
                autoComplete="off"
                />
              </div>
              {isGametab ? 
              <>
              <Input id="pathname" placeholder="Path name for this tab (opional)" autoComplete="off" maxLength={30} className="grow"/>
              <Input id="charname" placeholder="Character name (opional)" autoComplete="off" maxLength={30} className="grow"/>
              </>
              :
              <div className="flex flex-col gap-1 text-center items-stretch justify-center border-1 border-slate-800 rounded-lg bg-input/30 py-2 text-gray-300">
                <a>This tab cannot be added as a game</a>
                <a>Game will be created without paths</a>
              </div>
              }
              <Button variant="outline" type="submit">Submit</Button>
            </div>
            </form>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
    </ScrollArea>
  )
}

function GamesListRowNew() {
  const navigate = useNavigate();
  return (
  <>
    <TableRow key={"new-game"} className="w-full">
      <TableCell className="p-1 px-2 text-left">
        <div className="flex grow">
        <Button variant="ghost" onClick={()=>{navigate("/games-new")}} className="font-normal grow justify-start">
          <ChevronRight size={14}/>
          <a>Create a new game</a>
        </Button>
        </div>
      </TableCell>
    </TableRow>
  </>)
}

function GameEditMenu({game, startPage=1}: {game:GameObj|null, startPage?: number}) {
  const [currentPage, setPage] = useState(startPage);
  // const [requiresPageConfirmation, setPageConfirmation] = useState(false);
  const pages = {
    1: "Main info",
    2: "Paths",
    3: "Characters"
  }

  let newGame=false;
  if (!game) {
    game = Game.createEmptyGame()
    newGame = true
  }

  let page;
  if (currentPage === 1) page = <GameEditMenuMain game={game} newGame={newGame}/>
  else if (currentPage === 2) page = <GameEditMenuPaths gameId={game.id}/>
  else if (currentPage === 3) page = <GameEditMenuCharacters game={game}/>
  return (
    <TableRow key={(game?.id ?? "newgame") + "-edit"}>
      <TableCell className="text-left">
        <div className="flex">
          <Button variant={"ghost"} disabled={currentPage===1} onClick={()=>setPage(currentPage-1)} className="w-30 py-1"><ChevronLeft/> Prev</Button>
          <a className="grow text-lg text-center font-semibold align-middle py-1 hover:bg-muted/20">{pages[currentPage as 1|2|3]}</a>
          <Button variant={"ghost"} disabled={currentPage===3 || game?.id === null || game.id === -1} onClick={()=>setPage(currentPage+1)} className="w-30 py-1">Next <ChevronRight/></Button>
        </div>
        <Separator className="my-1 mb-2"/>
        {page}
      </TableCell>
    </TableRow>
  )
}

function GameEditMenuMain({game, newGame=false}: {game: GameObj, newGame?: boolean}) {
  const { currentUser: user } = useContext(UserContext)!;
  const navigate = useNavigate();

  function handleMainInfoSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formElements = form.elements as typeof form.elements & {
      name: {value: string},
      shortname: {value: string},
    }
    if (!game) {
      console.error("Game object is null when editing a game...")
      return;
    }
    game.name = formElements.name.value
    game.shortname = formElements.shortname.value
    if (game.id === -1) {
      Game.addNew(game, user)
    } else {
      Game.commit(game, user)
    }
    if (newGame) {
      toast.success("Game added")
      navigate("/games")
    }
    else toast.success("Game updated")
  } 

  return (
    <form onSubmit={handleMainInfoSubmit}>
    <div className="grid w-full items-center gap-2">
      <div className="flex">
        <Input defaultValue={game.name} 
        id="name" placeholder="Name"
        className="rounded-r-none flex-10 px-2"
        autoComplete="off"
        minLength={1}
        />
        <Input defaultValue={game.shortname ?? ""}
        id="shortname" placeholder="Tag*"
        minLength={1}
        maxLength={5}
        className="rounded-l-none flex-2"
        autoComplete="off"
        />
      </div>
      {/* <div>
        <Textarea id="description" placeholder="Description* (optional)"
        defaultValue={game.description}/>
      </div> */}
      <Button variant="outline" type="submit">Submit</Button>
    </div>
    </form>
  )
}

function GameEditMenuPaths({gameId}: {gameId: number}) {
  const { currentUser: user } = useContext(UserContext)!;
  const {selectedGame, setSelectedGame} = useContext(GameContext)!
  const game = useLiveQuery(()=>db.games.get(gameId))
  //const [paths, setPaths] = useState(game?.paths ?? []);
  if (!game) return

  async function handlePathSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    if (!game) return;
    e.preventDefault()
    const form = e.currentTarget
    const formElements = form.elements as typeof form.elements & {
      name: {value: string},
    }
    const name = formElements.name.value.trim();
    let sc: boolean|null = null;
    try {
      sc = await checkSugarCube()
    } catch {
      toast.error("Failed to contact the page", {description: "This page cannot be added as a game", duration: 2000})
      return;
    }
    if (!sc) {
      toast.error("Failed to access SugarCube object", {description: "This page is either not a SugarCube game or it hides the SugarCube object. See guide for more info"})
      return;
    }
    const tab = await getCurrentBrowserTab();
    if (!tab?.url) return null;
    const path = (tab.url as string).trim();
    if (game.paths.map(p=>p.url).includes(path)) {
      toast.error("This tab is already registered to this game", {duration:2000})
      return
    }
    const games = await db.games.where("archived").equals(0).toArray()
    for (const i of games)
      if (i.paths.map(p=>p.url).includes(path)) {
        toast.error("This tab is already registered to another game", {duration:2000})
        return
      }
    game.paths.push({name: name.length ? name : null, url: path})
    Game.commit(game, user)
    toast.success("Successfully added a new path", {duration:1500})
    formElements.name.value=""
    if (!selectedGame) setSelectedGame(game)
  }

  function handlePathDelete(index: number) {
    if (!game) return;
    const deletedPath = game.paths.splice(index,1)[0]
    Game.commit(game, user)
    toast.success("Successfully removed a path", {duration:1500,
      cancel: {
      label: 'Undo',
      onClick: ()=>{
        game.paths.push(deletedPath);
        Game.commit(game, user)
        //setPaths(game.paths)
      }}
    })
  }
  
  return (
    <div className="grid w-full items-center gap-2 justify-center">
      <div className="w-80 grid items-center">
        <form onSubmit={handlePathSubmit}>
        <Table className="w-full grow">
          {game.paths.map((path, index)=>
            <TableRow>
              <TableCell className="grow px-4">
                <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger type="button">
                    {path.name ? (
                      <>
                      <a className="text-left block w-full truncate max-w-56">{path.name}</a>
                      <a className="text-left block w-full text-gray-400 text-xs truncate max-w-56">{path.url}</a>
                      </>
                    ) : (
                      <a className="text-left block w-full truncate max-w-56">{path.url}</a>
                    )}
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-1">
                    <p>{path.url}</p>
                  </TooltipContent>
                </Tooltip>
                </TooltipProvider>
              </TableCell>
              <TableCell className="w-10">
                <DoubleClickButton variant="outline" type="button" onAccept={()=>handlePathDelete(index)}><Trash/></DoubleClickButton>
              </TableCell>
            </TableRow>
          )}
          {!game.paths.length && <GameEditMenuPathsEmptyNote/>}
          <TableRow>
            <TableCell className="grow">
              <Input id="name" placeholder="New path name (optional)" autoComplete="off" maxLength={30}/>
            </TableCell>
            <TableCell className="w-10">
              <Button variant="outline" type="submit"><Plus/></Button>
            </TableCell>
          </TableRow>
        </Table>
        </form>
      </div>
      {/* <Button variant="outline" onClick={()=>{/*Game.commit(game)*}}>Submit</Button> */}
    </div>
  )
}

function GameEditMenuPathsEmptyNote(){
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col text-center py-2">
          <p className="self-stretch text-lg font-bold">There are currently no paths</p>
          <p className="self-stretch text-base">
            You can add the current tab as a path below
          </p>
          <p className="text-sm">
            You may name this tab however you want<br/>
            or just leave it empty
          </p>
        </div>
      </TableCell>
    </TableRow>
  )
}

function GameEditMenuCharacters({game}: {game: GameObj}) {
  const { currentUser: user } = useContext(UserContext)!;
  const gameChars = useLiveQuery(()=>db.chars.where("gameId").equals(game?.uuid ?? "").and((char)=>!char.archived).toArray()) ?? []

  function handleCharSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formElements = form.elements as typeof form.elements & {
      name: {value: string},
    }
    const name = formElements.name.value.trim();
    if (name.length===0) {
      toast.error("Character's name must cannot be empty", {duration:1000})
      return;
    }

    const char = Char.createEmptyChar()
    char.name = name;
    char.gameId = game!.uuid;
    Char.addNew(char, user)
    toast.success("Character added")
    formElements.name.value=""
    //Game.commit(game)
  }

  return (
    <div className="grid w-full items-center gap-2 justify-center">
      <div className="w-80 grid items-center">
        <Table>
          {gameChars.map((char)=>
            <GameEditMenuCharactersRow char={char}/>
          )}
          {!gameChars.length && <GameEditMenuCharsEmptyNote/>}
          <TableRow>
            <TableCell className="">
              <form onSubmit={handleCharSubmit} className="flex flex-row gap-2">
                <Input id="name" placeholder="New character" autoComplete="off" maxLength={30} className="grow"/>
                <Button variant="outline"><Plus/></Button>
              </form>
            </TableCell>
          </TableRow>
        </Table>
      </div>
      {/* <Button variant="outline" onClick={()=>{/*Game.commit(game)*}}>Submit</Button> */}
    </div>
  )
}

function GameEditMenuCharactersRow({char}: {char: CharObj}) {
  const { currentUser: user } = useContext(UserContext)!;
  const {selectedChar, setSelectedChar} = useContext(CharContext)!;
  const [editMode, setEditMode] = useState(false)

  async function handleCharDelete(char: CharObj) {
    const res = await Char.archive(char);
    Char.commit(char, user)
    const saves = res.affectedSaves;
    const saveCommitTimeout = setTimeout(()=>{
      Save.bulkCommit(saves, user)
    }, 2750)
    if (selectedChar?.id === char.id) setSelectedChar(null)
    toast.success("Character archived", {position: "bottom-left", duration:2500,
      description: `Will archive ${saves.length} save` + (saves.length===1?'':'s'),
      cancel: {
      label: 'Undo',
      onClick: ()=>{
        clearTimeout(saveCommitTimeout)
        saves.map(Save.unarchive)
        Char.unarchive(char)
        Char.commit(char, user)
      }}
    })
  }

  function handleRenameCancel(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setEditMode(false)
  }
  
  function handleRenameSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formElements = form.elements as typeof form.elements & {
      name: {value: string},
    }
    const name = formElements.name.value.trim();
    if (char.name !== name) {
      char.name = name
      Char.commit(char)
      toast.success("Name changed", {duration:1000})
    }
    setEditMode(false)
  }

  if (editMode) {
    return (
      <TableRow>
        <TableCell onClick={()=>setEditMode(true)}>
          <form className="flex flex-row gap-2" onReset={handleRenameCancel} onSubmit={handleRenameSubmit}>
            <Input name="name" id="name" placeholder="Name" className="grow" defaultValue={char.name}/>
            <div className="self-end">
              <Button variant={"outline"} className="rounded-r-none" type="submit"><Check/></Button>
              <Button variant={"outline"} className="rounded-l-none" type="reset"><XIcon/></Button>
            </div>
          </form>
        </TableCell>
      </TableRow>
    )
  }
  
  return (
  <TableRow>
    <TableCell>
      <div className="flex flex-row gap-2">
        <div className="grow">
          <a className="text-left block w-full">{char.name}</a>
          <a className="text-left block w-full text-gray-400 text-xs">
            <CharStatsLine char={char}/>
          </a>
        </div>
        <div className="self-end">
          <Button variant={"outline"} className="rounded-r-none" onClick={()=>setEditMode(true)}><PenIcon/></Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              {/* <DoubleClickButton variant="outline" onAccept={()=>handleCharDelete(char)} type="button"><Trash/></DoubleClickButton> */}
              <Button variant="outline" type="button" className="rounded-l-none"><Trash/></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to delete a character?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will archive the character and all it's saves.<br/>
                  This <i>can</i> be undone, but not easy to do, unless you undo it right away.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={()=>handleCharDelete(char)}>Continue</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </TableCell>
  </TableRow>
  )
}

function GameEditMenuCharsEmptyNote(){
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col text-center py-2 px-4">
          <p className="self-stretch text-lg font-bold">There are currently no characters</p>
          <p className="self-stretch text-base">
            You can add one below
          </p>
          <p className="text-sm">
            These are only for organizational purposes<br/>
            and do not affect gameplay
          </p>
        </div>
      </TableCell>
    </TableRow>
  )
}

function CharStatsLine({char} : {char: CharObj}) {
  const [stats, setStats] = useState({saveCount:-1})
  useEffect(()=>{
    Char.getStats(char).then(stats=>setStats(stats))
  }, [])
  if (stats.saveCount===-1) return <>Loading...</>
  return <>Save count: {stats.saveCount}</>
}
// function GamesListRowDetails({game, colSpan=2}: {game: GameObj, colSpan?: number}) {
//   let remoteStatusIcon;
//   let remoteStatusDescription;
//   if (game.remoteId) {
//     remoteStatusIcon=(<Globe/>)
//     remoteStatusDescription = "Saved remotely"
//   } else {
//     remoteStatusIcon=(<HardDrive/>)
//     remoteStatusDescription = "Local only"
//   }

//   return (
//     <TableRow key={game.id + "-details"}>
//       <TableCell colSpan={colSpan} className="text-left">
//         <p>Name: {game.name} {game.shortname && <>({game.shortname})</>}</p>
//         <p>Description: {game.description}</p>
//         <Separator className="my-1"/>
//         <p className="text-gray-400">
//           <p className="float-left">
//             info
//           </p>
//           <p className="float-right px-4 mt-5">
//             <TooltipProvider delayDuration={300} disableHoverableContent={true}>
//               <Tooltip>
//                 <TooltipTrigger asChild>
//                   {remoteStatusIcon}
//                 </TooltipTrigger>
//                 <TooltipContent className="bg-slate-900 text-white border-1">
//                   <p>{remoteStatusDescription}</p>
//                 </TooltipContent>
//               </Tooltip>
//             </TooltipProvider>
//           </p>
//         </p>
//       </TableCell>
//     </TableRow>
//   )
// }

export { Games }