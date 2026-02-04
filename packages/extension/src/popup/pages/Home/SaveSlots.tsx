import { SaveDetails } from "@/popup/components/SaveDetails";
import { db } from "@/popup/lib/db";
import { loadBackgroundState, useSugarBoxState } from "@/popup/lib/state";
import { Button, DoubleClickButton } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Spinner } from "@/shared/components/ui/spinner";
import type { SaveObj } from "@/shared/types";
import { formatTime } from "@/shared/utils";
import { useLiveQuery } from "dexie-react-hooks";
import { DownloadIcon, TrashIcon, UploadIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { sendMessage } from "webext-bridge/popup";


function EmptySaveSlot({ index }: { index: number }) {
  const [isLoading, setLoading] = useState(false)
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
    setLoading(true)
    const res = await sendMessage("bg_save_new", index, "background")
    if (!res.ok) {
      toast.error("Error", { description: res.message })
    }
    loadBackgroundState()
    setLoading(false)
  }

  return (
    <div className="flex items-stretch gap-2 px-2 py-1 font-mono transition-colors hover:bg-accent/50">
      <a className="flex flex-col justify-center">{index + 1}</a>
      <Button variant={"ghost"} onClick={save} className="flex flex-1 flex-col items-center justify-center text-foreground/50">
        <a>[ Empty slot ]</a>
      </Button>
      <div className="flex w-30 items-center">
        {isLoading ? (
          <Button variant={"outline"} className="flex-1" size={"icon"}>
            <Spinner />
          </Button>
        ) : (
          <>
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
          </>
        )
        }
      </div >
    </div >
  )
}


function NewSaveSlot() {
  const [isLoading, setLoading] = useState(false)
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
    setLoading(true)
    const res = await sendMessage("bg_save_new", -1, "background")
    if (!res.ok) {
      toast.error("Error", { description: res.message })
    }
    loadBackgroundState()
    setLoading(false)
  }

  return (
    <div className="flex items-stretch gap-2 px-2 py-1 font-mono transition-colors hover:bg-accent/50">
      <a className="flex flex-col justify-center">+</a>
      <Button variant={"ghost"} onClick={addSlot} className="flex flex-1 flex-col items-center justify-center text-foreground/50">
        New save slot
      </Button>
      <div className="flex w-30 items-center">
        {isLoading ? (
          <Button variant={"outline"} className="flex-1" size={"icon"}>
            <Spinner />
          </Button>

        ) : (
          <Button variant={"outline"} onClick={save} className="flex-1" size={"icon"}>
            <DownloadIcon />
          </Button>
        )}
      </div>
    </div >
  )
}



function SaveSlot({ save, index, modifier }: { save: SaveObj, index: number, modifier: undefined | "recent" | "latest" }) {
  const [isLoading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  let recencyColor = "text-gray-300"
  if (modifier === "latest") recencyColor = "text-cyan-300"
  // Doesn't matter if recencyColor becomes stale
  // eslint-disable-next-line react-hooks/purity
  else if (modifier === "recent" || Date.now() - save.createdAt < 3600000) recencyColor = "text-cyan-500"

  async function overwriteSave() {
    setLoading(true)
    const res = await sendMessage("bg_save_new", index, "background")
    if (!res.ok) {
      toast.error("Error", { description: res.message })
    }
    loadBackgroundState()
    setLoading(false)
  }

  async function loadSave() {
    setLoading(true)
    const res = await sendMessage("bg_save_load", save, "background")
    if (!res.ok) {
      toast.error("Error", { description: res.message })
    }
    loadBackgroundState()
    setLoading(false)
  }

  async function deleteSave() {
    setLoading(true)
    const res = await sendMessage("bg_save_archive", save, "background")
    if (!res.ok) {
      toast.error("Error", { description: res.message })
    }
    loadBackgroundState()
    setLoading(false)
  }

  const saveTime = formatTime(save.createdAt).split(" ")
  return (
    <>
      <div key={save.uuid} className="flex items-stretch gap-2 px-2 py-1 font-mono transition-colors hover:bg-accent/50">
        <a className="flex flex-col justify-center">{index + 1}</a>
        <div className="flex min-w-0 flex-1 cursor-pointer flex-col justify-center gap-1" onClick={() => setExpanded(!expanded)}>
          <a className="truncate leading-none">{save.name}</a>
          <a className="truncate leading-none text-foreground/70">{save.description}</a>
        </div>
        <div className={"flex flex-col items-center justify-center gap-1 cursor-pointer " + recencyColor} onClick={() => setExpanded(!expanded)}>
          <a className="leading-none">{saveTime[0]}</a>
          <a className="leading-none">{saveTime[1]}</a>
        </div>
        <div className="flex w-30 items-center">
          {isLoading ? (
            <Button variant={"outline"} className="flex-1" size={"icon"}>
              <Spinner />
            </Button>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
      {expanded && <SaveDetails key={save.uuid + "-details"} save={save} />}
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
    [char])

  if (rawsaves === undefined) {
    return (
      <main className="flex-1"></main>
    )
  }

  const saves: (SaveObj | null)[] = []
  for (const saveId of char.slots) saves.push(rawsaves.find((obj) => obj.uuid === saveId) ?? null)
  const latestSave = saves.reduce((prev, current) => ((prev?.createdAt ?? 0) > (current?.createdAt ?? 0)) ? prev : current, null)

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="divide-y divide-slate-600">
        {saves.map((save, index) => {
          if (!save) return <EmptySaveSlot key={"emptySlot" + index} index={index} />
          return <SaveSlot key={save.uuid + "-component"} save={save} index={index} modifier={
            save === latestSave ? "latest" : undefined
          } />
        })}
        <NewSaveSlot key={"saveSlotNew"} />
      </div>
    </ScrollArea>
  )
}
