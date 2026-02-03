import { Button } from "@/shared/components/ui/button"
import { ClipboardIcon, FileDownIcon } from "lucide-react"
import { toast } from "sonner"
import { exportSaveToFile } from "../lib/save"
import type { SaveObj } from "@/shared/types"
import { formatBytes } from "@/shared/utils"

export function SaveDetails({ save }: { save: SaveObj }) {
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
        <div className="flex flex-col text-right text-foreground/70">
          <div className="flex">
            <Button variant={"outline"} onClick={exportToClipboard} className="rounded-r-none">
              <ClipboardIcon />
            </Button>
            <Button variant={"outline"} onClick={() => exportSaveToFile(save)} className="rounded-l-none">
              <FileDownIcon />
            </Button>
          </div>
          <a className="mr-2">{save.remoteId !== -1 ? "synced" : "local"}</a>
          <a className="mr-2">{formatBytes(save.data.length)}</a>

        </div>
      </div>
    </div>
  )
}
