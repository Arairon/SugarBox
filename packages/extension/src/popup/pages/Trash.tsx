import { ScrollArea } from "@/shared/components/ui/scroll-area"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "../lib/db"
import type { SaveObj } from "@/shared/types"
import { formatTime } from "@/shared/utils"
import { SaveDetails } from "../components/SaveDetails"
import { Fragment, useState } from "react"
import { Button } from "@/shared/components/ui/button"
import { ArrowLeftIcon, ArrowRightIcon, UploadIcon } from "lucide-react"
import { toast } from "sonner"
import { sendMessage } from "webext-bridge/popup"
import { loadBackgroundState } from "../lib/state"

function SaveItem({ save, index }: { save: SaveObj, index: number }) {
  const [expanded, setExpanded] = useState(false)
  const saveTime = formatTime(save.createdAt).split(" ")

  async function restore() {
    const res = await sendMessage("bg_save_restore", save, "background")
    if (res.ok) {
      toast.success("Save restored", { duration: 1500 })
      loadBackgroundState()
    } else {
      toast.error("Restore failed", { description: res.message })
    }
  }

  return (
    <>
      <div key={save.uuid} className="flex items-stretch gap-2 px-2 py-1 font-mono transition-colors hover:bg-accent/50">
        <a className="flex flex-col justify-center">{index + 1}</a>
        <div className="flex min-w-0 flex-1 cursor-pointer flex-col" onClick={() => setExpanded(!expanded)}>
          <a className="truncate">{save.name}</a>
          <a className="truncate text-foreground/70">{save.description}</a>
        </div>
        <div className="flex cursor-pointer flex-col items-center" onClick={() => setExpanded(!expanded)}>
          <a>{saveTime[0]}</a>
          <a>{saveTime[1]}</a>
        </div>
        <div className="flex items-center">
          <Button variant={"outline"} onClick={restore} className="flex-1" size={"icon"}>
            <UploadIcon />
          </Button>
        </div>
      </div>
      {expanded && <SaveDetails key={save.uuid + "details"} save={save} />}
    </>
  )
}

export default function Trash() {
  const gracePeriod = 7 * 86400_000 // 7d
  const pageSize = 30;
  const [pageNumber, setPageNumber] = useState(0)
  const savesCount = useLiveQuery(() => db.saves.where("archivedAt").aboveOrEqual(gracePeriod).count(), []) ?? 0
  const saves = useLiveQuery(() =>
    db.saves
      .where("archivedAt").aboveOrEqual(Date.now() - 7 * 86400_000) // 7 days
      .reverse()
      .offset(pageNumber * pageSize).limit(pageSize).toArray()
    , [pageNumber]) ?? []
  const pageCount = Math.ceil(savesCount / pageSize)

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col items-stretch divide-y divide-slate-700">
        <div className="flex flex-col items-center justify-center border-b-2 border-cyan-700 p-2 pb-1 font-bold">
          Trash
        </div>
        {saves.map((save, index) => (
          <Fragment key={save.uuid + "-fragment"}>
            <SaveItem save={save} index={index + pageNumber*pageSize} />
          </Fragment>
        ))}
        {((saves.length === pageSize || pageNumber > 0) && savesCount > pageSize) &&
          <div className="flex flex-row gap-2 p-2">
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
    </ScrollArea>
  )
}
