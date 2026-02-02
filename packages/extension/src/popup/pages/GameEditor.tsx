import { Button } from "@/shared/components/ui/button";
import { loadBackgroundState, useGameEditorState, useSugarBoxState } from "../lib/state";
import { createEmptyCharObject, type CharObj, type GameObj } from "@/shared/types";
import React, { Activity, useEffect, useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, EditIcon, PlusIcon, SaveIcon, TrashIcon, XIcon } from "lucide-react";
import { sendMessage } from "webext-bridge/popup";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { getCurrentBrowserTab } from "@/shared/browser";
import { toast } from "sonner";
import { db } from "../lib/db";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogCancel, AlertDialogDescription, AlertDialogAction, AlertDialogFooter, AlertDialogTitle, AlertDialogTrigger } from "@/shared/components/ui/alert-dialog";
import { useLiveQuery } from "dexie-react-hooks";


function EditGeneral({ game }: { game: GameObj }) {
  const { game: currentGame, setPage } = useSugarBoxState();
  const { setGame } = useGameEditorState();
  const [isGamePage, setIsGamePage] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [currentPageUrl, setCurrentPageUrl] = useState("")

  useEffect(() => {
    sendMessage("bg_is_page_a_game", undefined, "background").then(res => setIsGamePage(res))
    getCurrentBrowserTab().then(tab => setCurrentPageUrl(tab.url ?? ""))
  }, [])

  async function submitName(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const elements = e.currentTarget.elements
    const name = (elements as typeof elements & { name: { value: string } }).name.value.trim()

    if (!name) {
      toast.error("Name cannot be empty", { duration: 1500 })
      return
    }
    if (name === game.name) {
      toast.error("Name has not changed", { duration: 1500 })
      return
    }
    const games = await db.games.where("archived").equals(0).toArray()
    for (const i of games) {
      if (i.name === name) {
        toast.error("Name already taken by another game", { duration: 1500 })
        return;
      }
    }
    const newGame = Object.assign({}, game, { name })
    const res = await sendMessage("bg_game_edit", newGame)
    if (res.ok) {
      toast("Edited successfully", { duration: 1000 })
      setGame(res.game)
      loadBackgroundState() // TODO: Replace with BG triggered updates
    } else {
      toast.error(res.message, { duration: 2500 })
    }
  }

  async function submitNewPath(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const elements = e.currentTarget.elements
    const url = ((await getCurrentBrowserTab()).url ?? "").trim()
    if (!url) {
      toast.error("Please reload current browser tab")
      return
    }
    const name = (elements as typeof elements & { name: { value: string } }).name.value.trim()
    const games = await db.games.where("archived").equals(0).toArray()
    for (const i of games)
      if (i.paths.map(p => p.url).includes(url)) {
        toast.error("This tab is already registered to another game", { duration: 1500 })
        return
      }

    const newGame = Object.assign({}, game, { paths: game.paths.slice() })
    newGame.paths.push({
      name: name ?? null,
      url: url
    })
    const res = await sendMessage("bg_game_edit", newGame)
    if (res.ok) {
      toast("Edited successfully", { duration: 1000 })
      setGame(res.game)
      loadBackgroundState() // TODO: Replace with BG triggered updates
    } else {
      toast.error(res.message, { duration: 2500 })
    }
  }

  async function submitDeletePath(index: number) {
    const newGame = Object.assign({}, game, { paths: game.paths.slice() })
    newGame.paths.splice(index, 1)
    const res = await sendMessage("bg_game_edit", newGame)
    if (res.ok) {
      toast("Edited successfully", { duration: 1000 })
      setGame(res.game)
      loadBackgroundState() // TODO: Replace with BG triggered updates
    } else {
      toast.error(res.message, { duration: 2500 })
    }
  }

  async function submitDeleteGame() {
    const res = await sendMessage("bg_game_archive", game, "background")
    if (res.ok) {
      toast(`${game.name} deleted!`, { description: `Chars: ${res.affectedChars}\nSaves: ${res.affectedSaves}`, duration: 3000 })
      setDeleteDialogOpen(false)
      loadBackgroundState()
      setTimeout(() => { setPage("games") }, 300)
    } else {
      toast.error(res.message, { duration: 2500 })
    }
  }



  const thisTabAlreadyRegistered = game.paths.findIndex(i => i.url === currentPageUrl) !== -1

  return (
    <div className="flex min-h-0 flex-col items-stretch gap-2 p-2">
      <form onSubmit={submitName} className="flex">
        <Input className="rounded-r-none" id="name"
          placeholder="Name" defaultValue={game.name} autoComplete="off" type="text" />
        <Button type="button" variant={"outline"} className={"rounded-none text-red-400 " + (game.id === -1 ? "hidden" : "")}
          onClick={() => setDeleteDialogOpen(true)}>
          <TrashIcon />
        </Button>
        <Button variant={"outline"} className="rounded-l-none">
          <SaveIcon />
        </Button>
      </form>
      <div className="flex items-center justify-between px-2">
        <a className="">Paths</a>
        <p className="opacity-50">
          URLs to associate with this game
        </p>
      </div>
      <ScrollArea className="max-h-35 max-w-full flex-1" >
        <div className="flex h-full w-full max-w-full flex-col items-stretch gap-2 pb-2">
          {
            game.id === -1 ? (
              <div className="rounded-lg border border-border bg-input/30 p-1 text-center">
                Save the name first
              </div>
            ) :
              currentGame || thisTabAlreadyRegistered ? (
                <></>
              )
                :
                isGamePage ? (
                  <form className="flex" onSubmit={submitNewPath}>
                    <Input className="rounded-r-none" id="name"
                      placeholder="Name (optional)" maxLength={30} />
                    <Button className="rounded-l-none" variant={"outline"}>
                      <PlusIcon />
                    </Button>
                  </form>
                ) : (
                  <Tooltip delayDuration={1500}>
                    <TooltipTrigger className="w-full rounded-lg border border-border bg-input/30 p-1 text-center">
                      Unable to add this page as a path
                    </TooltipTrigger>
                    <TooltipContent className="max-w-85 border border-border text-base">
                      <p className="text-pretty">
                        Failed to find a valid backend on this page
                        You can try refreshing
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )
          }
          {
            game.paths.map((path, index) => (
              <div key={path.url} className={"bg-card/20 flex items-center gap-2 rounded-lg border px-2 py-1 " +
                (currentPageUrl === path.url ? "border-green-400" : "border-border")}>
                <div className="flex max-w-80 flex-1 flex-col truncate">
                  <a>{path.name}</a>
                  <a className="truncate text-sm text-ellipsis opacity-50">{path.url}</a>
                </div>
                <Button variant={"outline"} className="" onClick={() => submitDeletePath(index)}><TrashIcon /></Button>
              </div>
            ))
          }
        </div>
      </ScrollArea>
      <AlertDialog open={deleteDialogOpen}>
        <AlertDialogContent className="max-w-full">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {game.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting a game will delete all characters and saves associated with it.
              The data will stay available until cleared, but will not be easily accessible.
              This action cannot be easily undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction variant={"destructive"} onClick={submitDeleteGame}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


function CharacterCard({ char }: { char: CharObj }) {
  const [saveCount, setSaveCount] = useState(0)
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    db.saves
      .where("charId")
      .equals(char.uuid)
      .and((s) => !s.archived)
      .count()
      .then(setSaveCount)
  }, [char])

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const elements = e.currentTarget.elements
    const name = (elements as typeof elements & { name: { value: string } }).name.value.trim()


    const newChar = Object.assign({}, char, { name })
    const res = await sendMessage("bg_char_edit", newChar)
    if (res.ok) {
      toast("Edited successfully", { duration: 1000 })
      loadBackgroundState() // TODO: Replace with BG triggered updates
      setEditMode(false)
    } else {
      toast.error(res.message, { duration: 2500 })
    }
  }

  async function submitDeleteChar() {
    const res = await sendMessage("bg_char_archive", char, "background")
    if (res.ok) {
      toast(`${char.name} deleted!`, { description: `Saves: ${res.affectedSaves}`, duration: 3000 })
      loadBackgroundState()
    } else {
      toast.error(res.message, { duration: 2500 })
    }
  }

  if (editMode) {
    return (
      <form className="flex items-stretch rounded-lg transition-colors hover:bg-card/80" onSubmit={submit}>
        <Input maxLength={30} defaultValue={char.name} id="name" className="rounded-r-none" />
        <Button variant={"outline"} className="rounded-none" onClick={() => setEditMode(false)} type="button">
          <XIcon />
        </Button>
        <Button variant={"outline"} className="rounded-l-none" >
          <CheckIcon />
        </Button>
      </form>
    )
  }

  return (
    <AlertDialog>
      <div className="flex items-stretch rounded-lg transition-colors hover:bg-card/80">
        <div className="mr-2 flex flex-1 items-center gap-2 truncate px-2 font-mono">
          <a className="flex-1 truncate">{char.name}</a>
          <a className="text-foreground/50">({saveCount})</a>
        </div>
        <Button variant={"outline"} className="rounded-r-none" onClick={() => setEditMode(true)}>
          <EditIcon />
        </Button>
        <AlertDialogTrigger asChild>
          <Button variant={"outline"} className="rounded-l-none">
            <TrashIcon />
          </Button>
        </AlertDialogTrigger>
      </div>
      <AlertDialogContent className="max-w-full">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {char.name.length < 10 ? char.name : "this character"}?</AlertDialogTitle>
          <AlertDialogDescription>
            Deleting a char will delete all saves associated with it.
            The data will stay available until cleared, but will not be easily accessible.
            This action cannot be easily undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction variant={"destructive"} onClick={submitDeleteChar}>
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function CharacterCardNew() {
  const { game } = useGameEditorState();
  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const elements = e.currentTarget.elements
    const name = (elements as typeof elements & { name: { value: string } }).name.value.trim()
    if (!name) {
      toast.error("Name cannot be empty", { duration: 1500 })
      return
    }
    if (!game) {
      toast.error("Please reload the page")
      return
    }
    const char = createEmptyCharObject()
    char.gameId = game.uuid
    char.name = name
    char.slots = ["", "", ""]

    const res = await sendMessage("bg_char_edit", char)
    if (res.ok) {
      toast("Created successfully", { duration: 1000 })
      loadBackgroundState() // TODO: Replace with BG triggered updates
    } else {
      toast.error(res.message, { duration: 2500 })
    }

  }
  return (
    <form className="flex items-stretch"
      onSubmit={submit}>
      <Input id="name" maxLength={30} placeholder="New Character"
        className="rounded-r-none" />
      <Button className="rounded-l-none" variant={"outline"}>
        <PlusIcon />
      </Button>
    </form>
  )
}

function NoCharactersNote() {
  return (
    <div className="flex flex-col items-stretch">
      <p className="text-center font-bold">
        You don't have any characters yet
      </p>
      <p className="text-pretty">
        Characters are used to separate saves from each other between playthoughs.
        They have no actual impact on gameplay.
      </p>
    </div>
  )
}

function EditCharacters({ game }: { game: GameObj }) {
  const pageSize = 2;
  const [searchString, setSearchString] = useState("")
  const [pageNumber, setPageNumber] = useState(0)
  const charsCount = useLiveQuery(() => db.chars.where("gameId").equals(game.uuid).and(char => !char.archived).count(), [game]) ?? 0
  const chars = useLiveQuery(
    () => db.chars
      .where("gameId").equals(game.uuid).and((char) => !char.archived)
      .filter(char => !searchString || char.name.toLowerCase().includes(searchString.toLowerCase()))
      .offset(pageNumber * pageSize).limit(pageSize).toArray(), [game, pageNumber, searchString]
  ) ?? []

  useEffect(() => {
    if (chars.length === 0 && pageNumber) {
      new Promise(() => setPageNumber(0))
    }
  }, [chars.length, pageNumber])

  const pageCount = Math.ceil(charsCount / pageSize)

  return (
    <main className='flex max-h-80 min-h-0 flex-1 flex-col items-stretch justify-start overflow-y-hidden px-2'>
      <div className="flex items-stretch justify-center gap-4 py-2">
        <Input className={"flex-1 " + (searchString ? " text-left" : " text-center")} placeholder="Search"
          value={searchString} onChange={(e) => setSearchString(e.target.value)} />
      </div>
      <div className="flex flex-1 flex-col items-stretch gap-2">
        <CharacterCardNew />
        {chars.length === 0 && <NoCharactersNote />}
        {chars.map(char => <CharacterCard char={char} key={char.uuid} />)}
        {((chars.length === pageSize || pageNumber > 0) && charsCount > pageSize) &&
          <div className="flex flex-row gap-2">
            <Button size="sm" className="flex-1" variant={"outline"}
              onClick={() => setPageNumber(Math.max(0, pageNumber - 1))} disabled={pageNumber === 0}><ArrowLeftIcon /></Button>
            <div className="flex flex-1 items-center justify-center">
              {pageNumber + 1} / {pageCount}
            </div>
            <Button size="sm" className="flex-1" variant={"outline"}
              onClick={() => setPageNumber(Math.min(pageCount - 1, pageNumber + 1))} disabled={pageNumber === pageCount - 1}><ArrowRightIcon /></Button>
          </div>
        }
      </div>
    </main>
  )

}

export default function GameEditor() {
  const { setPage: setGlobalPage } = useSugarBoxState();
  const { game, page, setPage } = useGameEditorState();

  if (!game) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-red-400 bg-red-800/50 p-4 text-pretty">
          <a className="text-center">This was not supposed to happen!</a>
          <p>Game Editor opened without a Game selected...</p>
          <Button onClick={() => setGlobalPage("home")} className="mt-4">Return to safety</Button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col items-stretch">
      <div className="flex text-base">
        <button className={"flex-1 border-b-2 p-2 pb-1 hover:bg-accent/10 disabled:pointer-events-none disabled:opacity-50 " + (page === 1 ? "border-cyan-500" : " border-cyan-700")}
          onClick={() => setPage(1)}>
          General
        </button>
        <button className={"flex-1 border-b-2 p-2 pb-1 hover:bg-accent/10 disabled:pointer-events-none disabled:opacity-50 " + (page === 2 ? "border-cyan-500" : " border-cyan-700")}
          onClick={() => setPage(2)} disabled={game.id === -1}>
          Characters
        </button>
      </div>
      <Activity mode={page === 1 ? "visible" : "hidden"}><EditGeneral game={game} /></Activity>
      <Activity mode={page === 2 ? "visible" : "hidden"}><EditCharacters game={game} /></Activity>
    </main>
  )
}
