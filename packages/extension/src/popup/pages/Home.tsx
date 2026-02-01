import { Button } from "@/shared/components/ui/button";
import { useSugarBoxState } from "../lib/state";

export default function Home() {
  const {setPage} = useSugarBoxState();

  return (
    <>
      Home
      <Button onClick={()=>setPage("debug")}>debug</Button>
    </>
  )
}
