import { db } from "@/popup/lib/db";
import { exportSaveToFile } from "@/popup/lib/save";
import { loadBackgroundState, useSugarBoxState } from "@/popup/lib/state";
import { Button, DoubleClickButton } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import type { SaveObj } from "@/shared/types";
import { formatTime } from "@/shared/utils";
import { useLiveQuery } from "dexie-react-hooks";
import { ClipboardIcon, DownloadIcon, FileDownIcon, TrashIcon, UploadIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { sendMessage } from "webext-bridge/popup";


function EmptySaveSlot({ index }: { index: number }) {
  const { char } = useSugarBoxState();

  async function removeSlot() {
    if (!char) return
    const newSlots = char.slots.slice()
    newSlots.splice(index, 1)
    const res = await sendMessage("bg_char_edit", Object.assign(char, { slots: newSlots }, "background"))
    if (!res.ok) {
      toast.error("Error", { description: res.message })
    }
    loadBackgroundState()
  }

  async function save() {
    const res = await sendMessage("bg_save_new", index, "background")
    if (!res.ok) {
      toast.error("Error", { description: res.message })
    }
    loadBackgroundState()
  }

  return (
    <div className="flex items-stretch gap-2 px-2 py-1 font-mono transition-colors hover:bg-accent/50">
      <a className="flex flex-col justify-center">{index + 1}</a>
      <Button variant={"ghost"} onClick={save} className="flex flex-1 flex-col items-center justify-center text-foreground/50">
        <a>[ Empty slot ]</a>
      </Button>
      <div className="flex w-30 items-center">
        <Button variant={"outline"} onClick={save} className="flex-1 rounded-r-none" size={"icon"}>
          <DownloadIcon />
        </Button>
        <DoubleClickButton
          size={"icon"}
          variant={"outline"}
          className="rounded-l-none"
          confirmClassName=""
          onAccept={removeSlot}
        >
          <TrashIcon />
        </DoubleClickButton>
      </div>
    </div>
  )
}


function NewSaveSlot() {
  const { char } = useSugarBoxState();

  async function addSlot() {
    if (!char) return
    const newSlots = char.slots.slice()
    newSlots.push("")
    const res = await sendMessage("bg_char_edit", Object.assign(char, { slots: newSlots }, "background"))
    if (!res.ok) {
      toast.error("Error", { description: res.message })
    }
    loadBackgroundState()
  }

  async function save() {
    const res = await sendMessage("bg_save_new", -1, "background")
    if (!res.ok) {
      toast.error("Error", { description: res.message })
    }
    loadBackgroundState()
  }

  return (
    <div className="flex items-stretch gap-2 px-2 py-1 font-mono transition-colors hover:bg-accent/50">
      <a className="flex flex-col justify-center">+</a>
      <Button variant={"ghost"} onClick={addSlot} className="flex flex-1 flex-col items-center justify-center text-foreground/50">
        New save slot
      </Button>
      <div className="flex w-30 items-center">
        <Button variant={"outline"} onClick={save} className="flex-1" size={"icon"}>
          <DownloadIcon />
        </Button>
      </div>
    </div>
  )
}



function SaveDetails({ save }: { save: SaveObj }) {
  function exportToClipboard() {
    navigator.clipboard.writeText(save.data)
    toast("Save data copied to clipboard!", { duration: 1500 })
  }

  return (
    <div className="flex flex-col items-stretch divide-y divide-slate-800 px-2 py-1 font-mono">
      <div className="flex items-start">
        <div className="mr-4 flex flex-col">
          <a className="font-semibold">{save.name}</a>
          <p className="text-sm text-pretty text-foreground/70">{save.description}</p>
          <a className="text-foreground/70">Game version: {save.gameVersion}</a>
        </div>
        <Button variant={"outline"} onClick={exportToClipboard} className="rounded-r-none">
          <ClipboardIcon />
        </Button>
        <Button variant={"outline"} onClick={() => exportSaveToFile(save)} className="rounded-l-none">
          <FileDownIcon />
        </Button>
      </div>
    </div>
  )
}

function SaveSlot({ save, index, modifier }: { save: SaveObj, index: number, modifier: undefined | "recent" | "latest" }) {
  const [expanded, setExpanded] = useState(false);

  let recencyColor = "text-gray-300"
  if (modifier === "latest") recencyColor = "text-cyan-300"
  // Doesn't matter if recencyColor becomes stale
  // eslint-disable-next-line react-hooks/purity
  else if (modifier === "recent" || Date.now() - save.createdAt < 3600000) recencyColor = "text-cyan-500"

  async function overwriteSave() {
    const res = await sendMessage("bg_save_new", index, "background")
    if (!res.ok) {
      toast.error("Error", { description: res.message })
    }
    loadBackgroundState()
  }

  async function loadSave() {
    const res = await sendMessage("bg_save_load", save, "background")
    if (!res.ok) {
      toast.error("Error", { description: res.message })
    }
    loadBackgroundState()
  }

  async function deleteSave() {
    const res = await sendMessage("bg_save_archive", save, "background")
    if (!res.ok) {
      toast.error("Error", { description: res.message })
    }
    loadBackgroundState()
  }

  const saveTime = formatTime(save.createdAt).split(" ")
  return (
    <>
      <div key={save.uuid} className="flex items-stretch gap-2 px-2 py-1 font-mono transition-colors hover:bg-accent/50">
        <a className="flex flex-col justify-center">{index + 1}</a>
        <div className="flex min-w-0 flex-1 cursor-pointer flex-col" onClick={() => setExpanded(!expanded)}>
          <a className="truncate">{save.name}</a>
          <a className="truncate text-foreground/70">{save.description}</a>
        </div>
        <div className={"flex flex-col items-center cursor-pointer " + recencyColor} onClick={() => setExpanded(!expanded)}>
          <a>{saveTime[0]}</a>
          <a>{saveTime[1]}</a>
        </div>
        <div className="flex w-30 items-center">
          <Button variant={"outline"} onClick={overwriteSave} className="flex-1 rounded-r-none" size={"icon"}>
            <DownloadIcon />
          </Button>
          <Button variant={"outline"} onClick={loadSave} className="flex-1 rounded-none" size={"icon"}>
            <UploadIcon />
          </Button>
          <DoubleClickButton
            size={"icon"}
            variant={"outline"}
            className="rounded-l-none"
            confirmClassName=""
            onAccept={deleteSave}
          >
            <TrashIcon />
          </DoubleClickButton>
        </div>
      </div>
      {expanded && <SaveDetails key={save.uuid + "details"} save={save} />}
    </>
  )
}


export default function SaveSlots() {
  const { game, char } = useSugarBoxState()
  if (!game || !char) throw new Error("SaveSlots used without game&char")

  const rawsaves = useLiveQuery(
    () => db.saves
      .where("uuid").anyOf(char.slots)
      .and((save) => !save.archived).toArray(),
    [char]) ?? []
  const saves: (SaveObj | null)[] = []
  for (const saveId of char.slots) saves.push(rawsaves.find((obj) => obj.uuid === saveId) ?? null)
  const latestSave = saves.reduce((prev, current) => ((prev?.createdAt ?? 0) > (current?.createdAt ?? 0)) ? prev : current, null)

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="divide-y divide-slate-600">
        {saves.map((save, index) => {
          if (!save) return <EmptySaveSlot key={"emptySlot" + index} index={index} />
          return <SaveSlot save={save} index={index} modifier={
            save === latestSave ? "latest" : undefined
          } />
        })}
        <NewSaveSlot />
      </div>
    </ScrollArea>
  )
}
