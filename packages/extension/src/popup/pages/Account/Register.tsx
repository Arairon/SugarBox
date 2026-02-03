import { loadBackgroundState, useSugarBoxState } from "@/popup/lib/state";
import { register, requestSyncNow } from "@/popup/lib/user";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { LoaderCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Register() {
  const { setPage } = useSugarBoxState()
  const [isLoading, setLoading] = useState(false);


  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (isLoading) return;
    setLoading(true)
    const form = e.currentTarget
    const formElements = form.elements as typeof form.elements & {
      email: { value: string },
      username: { value: string },
      password: { value: string },
    }
    const username = formElements.username.value
    const email = formElements.email.value
    const password = formElements.password.value

    const res = await register({ email, username, password })

    if (!res.ok) {
      toast.error("Failed to register", { description: res.message })
    } else {
      toast.promise(requestSyncNow(), {
        loading: "Registered and logged in",
        description: "Syncing data...",
        duration: 1500,
        success: ({ downloaded, uploaded }) => {
          loadBackgroundState()
          return {
            message: "Complete",
            description: `Downloaded: ${downloaded}. Uploaded: ${uploaded}`,
            duration: 1500
          }
        }
      })
      loadBackgroundState()
      setPage("home")
    }
    setLoading(false)
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-10">
      <form onSubmit={handleSubmit} className="flex flex-col items-center justify-center gap-2
rounded-lg border-2 border-cyan-600 px-10 py-5">
        <h2 className="text-lg font-bold">Login</h2>
        <Input id="username" placeholder="Username" name="username" minLength={3} maxLength={32} />
        <Input id="email" placeholder="Email" name="email" minLength={3} maxLength={256} type="email" />
        <Input id="password" placeholder="Password" name="password" minLength={3} maxLength={256} type="password" />
        <Button type="submit" variant={"outline"} className="self-stretch">
          {isLoading ? <LoaderCircleIcon className="animate-spin" /> : <>Register</>}
        </Button>
      </form>
    </main>
  )
}
