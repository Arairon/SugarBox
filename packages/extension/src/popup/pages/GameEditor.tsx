import { Button } from "@/shared/components/ui/button";
import { loadBackgroundState, useGameEditorState, useSugarBoxState } from "../lib/state";
import { type GameObj } from "@/shared/types";
import React, { Activity, useEffect, useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { PlusIcon, SaveIcon, TrashIcon, } from "lucide-react";
import { sendMessage } from "webext-bridge/popup";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { getCurrentBrowserTab } from "@/shared/browser";
import { toast } from "sonner";
import { db } from "../lib/db";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogCancel, AlertDialogDescription, AlertDialogAction, AlertDialogFooter, AlertDialogTitle } from "@/shared/components/ui/alert-dialog";
import { CharacterList } from "../components/CharacterList";


function EditGeneral({ game }: { game: GameObj }) {
  const { game: currentGame, setPage } = useSugarBoxState();
  const { setGame, detectedGameName } = useGameEditorState();
  const [isGamePage, setIsGamePage] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [currentPageUrl, setCurrentPageUrl] = useState("")

  useEffect(() => {
    sendMessage("bg_is_page_a_game", undefined, "background").then(res => {
      setIsGamePage(res)
    })
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
      toast("Edited successfully", { duration: 1500 })
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
          placeholder="Name" defaultValue={game.name || detectedGameName || ""} autoComplete="off" type="text" />
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
                (currentPageUrl === path.url ? "border-cyan-600" : "border-border")}>
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
      <Activity mode={page === 2 ? "visible" : "hidden"}><CharacterList game={game} availableAction="delete" allowCreation /></Activity>
    </main>
  )
}
