import { Button } from "@/shared/components/ui/button";
import { useSugarBoxState } from "../lib/state";

export default function Error() {
  const { setPage } = useSugarBoxState()
  return (
    <main className="flex flex-1 flex-col items-center justify-center">
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-red-400 bg-red-800/50 p-4 text-pretty">
        <a className="text-center">This was not supposed to happen!</a>
        <p>This page is not implemented yet!</p>
        <Button onClick={() => setPage("home")} className="mt-4">Return to safety</Button>
      </div>
    </main>
  )
}
