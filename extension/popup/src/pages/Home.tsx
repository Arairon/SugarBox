//import { NavLink, useLocation } from "react-router";
import { GameContext } from "@/App";
import { useContext } from "react";
import { SavesPage } from "./Saves";
import { toast } from "sonner";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";


function Home() {
  //const navigate = useNavigate();
  const {selectedGame} = useContext(GameContext)!;
  if (!selectedGame) {
    return (<WelcomePage/>)
  }
  return (<SavesPage/>)
}
export { Home };

function WelcomePage() {
  return (
    <div className="flex flex-col justify-center content-center items-center grow gap-3 w-90">
      <p className="max-w-60">
        <h1 className="text-xl font-bold">SugarBox</h1>
        <a className="w-full text-center block">SugarCube Save Manager by Arairon</a>
      </p>
      <p className="text-pretty text-base px-4 py-2 border-1 border-cyan-600 rounded-lg bg-slate-900">
        {/* href="https://git.arai.icu/arairon/twine-saves" */}
        <Dialog>
        You can find a guide <DialogTrigger asChild><a className="underline clickable">here</a></DialogTrigger><br/>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick start guide</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-50">
          <ol className="text-pretty text-base list-decimal list-inside">
            <li>Make sure the current browser tab is a twine game</li>
            <li>Click on "No game found" in the top-left corner</li>
            <li>Register a new game / select an existing one</li>
            <li>Register current tab as a suitable path for the game</li>
            <li>Create a character (These will not affect the actual game)</li>
            <li>Select the new character in the top-right corner</li>
            <li>Enjoy!</li>
            <li>(optional) Connect to a server in the bottom-right corner to sync saves to cloud</li>
          </ol>
          </ScrollArea>
        </DialogContent>
        </Dialog>
        and a more detailed one <a className="underline clickable" onClick={()=>{toast("or not...", {description: "I haven't made a public one yet :)"})}}>in the repo</a>.
      </p>
      <p className="text-sm text-right self-stretch">
        Feel free to contact me<br/>
        <a className="font-semibold text-cyan-200 clickable" onClick={()=>{
          navigator.clipboard.writeText("arairon")
          toast("Copied")
        }}>arairon</a> on discord<br/>
        <a className="text-xs">(or anywhere else tbf)</a>
      </p>
    </div>
  )
}