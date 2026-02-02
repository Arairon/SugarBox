import { db } from "@/popup/lib/db";
import { useSugarBoxState } from "@/popup/lib/state";
import { Button, DoubleClickButton } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import type { SaveObj } from "@/shared/types";
import { formatTime } from "@/shared/utils";
import { useLiveQuery } from "dexie-react-hooks";
import { DownloadIcon, TrashIcon, UploadIcon } from "lucide-react";


function EmptySaveSlot({ index }: { index: number }) {
  return (
    <div>
      Empty: {index}
    </div>
  )
}

function SaveSlot({ save, index, modifier }: { save: SaveObj, index: number, modifier: undefined | "recent" | "latest" }) {
  let recencyColor = "text-gray-300"
  if (modifier === "latest") recencyColor = "text-cyan-300"
  // Doesn't matter if recencyColor becomes stale
  // eslint-disable-next-line react-hooks/purity 
  else if (modifier === "recent" || Date.now() - save.createdAt < 3600000) recencyColor = "text-cyan-500"

  const saveTime = formatTime(save.createdAt).split(" ")
  return (
    <>
      <div className="flex items-stretch gap-2 px-2 py-1 font-mono transition-colors hover:bg-accent/50">
        <a className="flex flex-col justify-center">{index + 1}</a>
        <div className="flex min-w-0 flex-1 flex-col">
          <a className="truncate">{save.name}</a>
          <a className="truncate text-foreground/70">{save.description}</a>
        </div>
        <div className={"flex flex-col items-center " + recencyColor}>
          <a>{saveTime[0]}</a>
          <a>{saveTime[1]}</a>
        </div>
        <div className="flex w-30 items-center">
          <Button variant={"outline"} className="flex-1 rounded-r-none" size={"icon"}>
            <DownloadIcon />
          </Button>
          <Button variant={"outline"} className="flex-1 rounded-none" size={"icon"}>
            <UploadIcon />
          </Button>
          <DoubleClickButton
            size={"icon"}
            variant={"outline"}
            className="rounded-l-none"
            confirmClassName=""
            onAccept={() => { }}
          >
            <TrashIcon />
          </DoubleClickButton>


        </div>
      </div>
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
    <ScrollArea className="flex-1">
      <div className="divide-y divide-slate-600">
        {saves.map((save, index) => {
          if (!save) return <EmptySaveSlot key={"emptySlot" + index} index={index} />
          return <SaveSlot save={save} index={index} modifier={
            save === latestSave ? "latest" : undefined
          } />
        })}
      </div>
    </ScrollArea>
  )
}
