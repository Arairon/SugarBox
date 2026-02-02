import { toast } from "sonner";
import { useSugarBoxState } from "../lib/state";
import SaveList from "./Home/SaveList";
import SaveSlots from "./Home/SaveSlots";

export default function Home() {
  const { game, char } = useSugarBoxState();

  if (game) {
    if (char) {
      return <SaveSlots />
    } else {
      return <SaveList />
    }
  }

  return (
    <main className="flex flex-1 grow flex-col items-center justify-center gap-3 p-4">
      <p className="max-w-60 text-center">
        <a className="text-xl font-bold">SugarBox</a>
        <a className="block w-full text-center text-sm">SugarCube Save Manager by Arairon</a>
      </p>
      <p className="rounded-lg border-1 border-cyan-600 bg-slate-900 px-4 py-2 text-base text-pretty">
        You can find a guide <a className="clickable underline" onClick={()=>{
          chrome.tabs.create({url: "https://github.com/arairon/sugarbox"})
        }}>in the repo</a>.
      </p>
      <p className="self-stretch text-right text-sm">
        Feel free to contact me<br/>
        <a className="clickable font-semibold text-cyan-200" onClick={()=>{
          navigator.clipboard.writeText("arairon")
          toast("Copied")
        }}>arairon</a> on discord<br/>
        <a className="text-xs">(or anywhere else tbf)</a>
      </p>
    </main>
  )
}
