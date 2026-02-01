import { Button } from "@/shared/components/ui/button"
import { request } from "../lib/bg"

export default function Debug() {
  return (
    <>
      Debug
      <Button onClick={()=>request("ping")}>ping bg</Button>
      <Button onClick={()=>request("get_state").then(data=>{
        console.log(data);
      })}>get_state</Button>
    </>
  )
}
