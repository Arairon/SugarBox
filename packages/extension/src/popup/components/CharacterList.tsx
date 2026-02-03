
import { Button } from "@/shared/components/ui/button";
import { loadBackgroundState } from "../lib/state";
import { createEmptyCharObject, type CharObj, type GameObj } from "@/shared/types";
import React, { useEffect, useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, EditIcon, PlusIcon, StepForwardIcon, TrashIcon, XIcon } from "lucide-react";
import { sendMessage } from "webext-bridge/popup";
import { toast } from "sonner";
import { db } from "../lib/db";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogCancel, AlertDialogDescription, AlertDialogAction, AlertDialogFooter, AlertDialogTitle, AlertDialogTrigger } from "@/shared/components/ui/alert-dialog";
import { useLiveQuery } from "dexie-react-hooks";

function CharacterCard({ char, availableAction = "delete" }: { char: CharObj, availableAction: "delete" | "select" }) {
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

  if (availableAction === "delete") {
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
  return (
    <div className="flex items-stretch rounded-lg transition-colors hover:bg-card/80">
      <div className="mr-2 flex flex-1 items-center gap-2 truncate px-2 font-mono">
        <a className="flex-1 truncate">{char.name}</a>
        <a className="text-foreground/50">({saveCount})</a>
      </div>
      <Button variant={"outline"} className="rounded-r-none" onClick={() => setEditMode(true)}>
        <EditIcon />
      </Button>
      <Button variant={"outline"} className="rounded-l-none" onClick={() => sendMessage("bg_change_char", char, "background").then(() => loadBackgroundState())}>
        <StepForwardIcon />
      </Button>
    </div>
  )


}

function CharacterCardNew({ game }: { game: GameObj }) {
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
    <div className="flex flex-col items-stretch text-center">
      <p className="font-bold">
        You don't have any characters yet
      </p>
      <p>
        Characters are used to separate saves from each other between playthoughs.
      </p>
      <p>
        They have no actual impact on gameplay.
      </p>
    </div>
  )
}

export function CharacterList({ game, availableAction = "delete", allowCreation, basePageSize = 3 }:
  { game: GameObj, availableAction?: "delete" | "select", allowCreation?: boolean, basePageSize?: number }) {
  const [searchString, setSearchString] = useState("")
  const [pageNumber, setPageNumber] = useState(0)
  const charsCount = useLiveQuery(() => db.chars.where("gameId").equals(game.uuid).and(char => !char.archived).count(), [game]) ?? 0
  const pageSize = charsCount > basePageSize ? (basePageSize - 1) : basePageSize;
  const chars = useLiveQuery(
    () => db.chars
      .where("gameId").equals(game.uuid).and((char) => !char.archived)
      .filter(char => !searchString || char.name.toLowerCase().includes(searchString.toLowerCase()))
      .offset(pageNumber * pageSize).limit(pageSize).toArray(), [game, pageNumber, searchString, pageSize]
  ) ?? []

  useEffect(() => {
    if (chars.length === 0 && pageNumber > 0) {
      new Promise(() => setPageNumber(pageNumber - 1))
    }
  }, [chars.length, pageNumber, pageSize])

  const pageCount = Math.ceil(charsCount / pageSize)

  return (
    <main className='flex max-h-80 min-h-0 flex-1 flex-col items-stretch justify-start overflow-y-hidden px-2'>
      <div className="flex items-stretch justify-center gap-4 py-2">
        <Input className={"flex-1 " + (searchString ? " text-left" : " text-center")} placeholder="Search"
          value={searchString} onChange={(e) => setSearchString(e.target.value)} />
      </div>
      <div className="flex flex-1 flex-col items-stretch gap-2">
        {allowCreation && <CharacterCardNew game={game} />}
        {chars.length === 0 && <NoCharactersNote />}
        {chars.map(char => <CharacterCard char={char} key={char.uuid} availableAction={availableAction} />)}
        {((chars.length >= pageSize || pageNumber > 0) && charsCount > pageSize) &&
          <>
            <div className="flex-1"></div>
            <div className="mb-2 flex flex-row gap-2">
              <Button size="sm" className="flex-1" variant={"outline"}
                onClick={() => setPageNumber(Math.max(0, pageNumber - 1))} disabled={pageNumber === 0}><ArrowLeftIcon /></Button>
              <div className="flex flex-1 items-center justify-center">
                {pageNumber + 1} / {pageCount}
              </div>
              <Button size="sm" className="flex-1" variant={"outline"}
                onClick={() => setPageNumber(Math.min(pageCount - 1, pageNumber + 1))} disabled={pageNumber === pageCount - 1}><ArrowRightIcon /></Button>
            </div>
          </>
        }
      </div>
    </main>
  )
}
