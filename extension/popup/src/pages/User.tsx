import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserContext } from "@/App";
import { Button, DoubleClickButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SessionObj, User, UserPatchSchema } from "@/logic/user";
import { LoaderCircle, LockKeyholeIcon, PenIcon, StepBackIcon, TrashIcon, User2Icon, UserCog2Icon } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { formatZodIssue } from "@/logic/misc";
import { formatTime } from "@/lib/utils";



const UserDataSchema = z.object({
  username: z
    .string({ message: "Username must be a string" })
    .trim()
    .min(3, { message: "Username must be at least 3 characters long" })
    .max(32, { message: "Username cannot exceed 32 characters" }),
  email: z.string({message: "Email must be a string"}).trim().email({message: "Email must be a valid email address"}),
  password: z
    .string({ message: "Password must be a string" })
    .trim()
    .min(3, { message: "Password must be at least 3 characters long" })
    .max(256, { message: "Username cannot exceed 256 characters" }),
});

export function Login() {
  const {currentUser, setCurrentUser} = useContext(UserContext)!
  const [isLoading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (isLoading) return;
    setLoading(true)
    const form = e.currentTarget
    const formElements = form.elements as typeof form.elements & {
      username: {value: string},
      password: {value: string},
    }
    const {success, data, error} = UserDataSchema.omit({email: true}).safeParse({
      username:formElements.username.value,
      password:formElements.password.value
    })
    if (!success) {
      toast.error(error.issues[0].message)
      setLoading(false)
      return
    }
    const {username, password} = data;
    
    const {success: loggedIn, user, message } = await User.login(currentUser, username, password)
    
    if (loggedIn) {
      User.commit(user)
      setCurrentUser(user)
      toast.promise(User.sync(user, new Date(0)), {
        loading: "Logged in",
        description: "Syncing data...",
        duration: 1500,
        success: ({downloaded, uploaded})=>{
            return {
            message: "Complete",
            description: `Downloaded: ${downloaded}. Uploaded: ${uploaded}`,
            duration: 1500
          }}
      })
      navigate("/")
    } else {
      toast.error("Failed to login", {description: message})
    }
  
    setLoading(false)
  }

  return (
  <div className="flex flex-col justify-center items-center px-10 py-10 grow">
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 justify-center items-center
    border-2 border-cyan-600 rounded-lg px-10 py-5">
      <h2 className="text-lg font-bold">Login</h2>
      <Input id="username" placeholder="Username" name="username" minLength={3} maxLength={32}/>
      <Input id="password" placeholder="Password" name="password" minLength={3} maxLength={256} type="password"/>
      <Button type="submit" variant={"outline"} className="self-stretch">{isLoading ? <LoaderCircle className="animate-spin"/> : <>Login</>}</Button>
    </form>
  </div>
  )
}

export function Register() {
  const {currentUser, setCurrentUser} = useContext(UserContext)!
  const [isLoading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (isLoading) return;
    setLoading(true)
    const form = e.currentTarget
    const formElements = form.elements as typeof form.elements & {
      username: {value: string},
      email:    {value: string},
      password: {value: string},
    }
    const {success, data, error} = UserDataSchema.safeParse({
      username:formElements.username.value,
      email:   formElements.email.value,
      password:formElements.password.value
    })
    if (!success) {
      toast.error(error.issues[0].message)
      setLoading(false)
      return
    }
    const {username, email, password} = data;
    
    const {success: loggedIn, user, message } = await User.register(currentUser, username, email, password)
    
    if (loggedIn) {
      User.commit(user)
      setCurrentUser(user)
      toast.promise(User.sync(user, new Date(0)), {
        loading: "Registered and logged in",
        description: "Syncing data...",
        duration: 1500,
        success: ({downloaded, uploaded})=>{
            return {
            message: "Complete",
            description: `Downloaded: ${downloaded}. Uploaded: ${uploaded}`,
            duration: 1500
          }}

      })
      navigate("/")
    } else {
      toast.error("Failed to login", {description: message})
    }
  
    setLoading(false)
  }

  return (
  <div className="flex flex-col justify-center items-center px-10 py-4 grow">
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 justify-center items-center
    border-2 border-cyan-600 rounded-lg px-10 py-4">
      <h2 className="text-lg font-bold">Register</h2>
      <Input id="username" placeholder="Username" name="username" minLength={3} maxLength={32}/>
      <Input id="email"    placeholder="Email"    name="email"    minLength={3} maxLength={256} type="email"/>
      <Input id="password" placeholder="Password" name="password" minLength={3} maxLength={256} type="password"/>
      <Button type="submit" variant={"outline"} className="self-stretch">{isLoading ? <LoaderCircle className="animate-spin"/> : <>Register</>}</Button>
    </form>
  </div>
  )
}

export function Account() {
  const {currentUser: user} = useContext(UserContext)!;
  const navigate = useNavigate();
  const statusIcons = {
    user: <User2Icon/>,
    admin: <UserCog2Icon/>,
    limited: <LockKeyholeIcon/>
  }
  return (
    <ScrollArea className="w-full max-h-full px-2">
    <Table className="w-full">
      <TableHeader>
        <TableRow className="w-full">
          <TableHead className="text-center py-1">
            <a className="text-lg font-semibold py-1">Account</a>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="hover:bg-muted/20">
          <div className="flex-row content-center py-2 px-4 flex items-center gap-2">
            {statusIcons[user.role]}
            <div className="grow flex flex-col text-left">
              <span className="flex flex-row gap-2">
                <a>{user.displayname}</a>
                <a className="text-gray-300">({user.username})</a>
              </span>
              <a className="text-gray-200">Email: {user.email}</a>
              <a className="text-gray-400">Password: *********</a>
            </div>
            <Button variant={"outline"} onClick={()=>navigate("/accountinfo")}><PenIcon/></Button>
          </div>
        </TableRow>
        <TableRow className="hover:bg-muted/20 text-center">
          <a className="text-lg font-semibold py-1">Sessions</a>
        </TableRow>
        <SessionsList/>
      </TableBody>
    </Table>
  </ScrollArea>
  )
}

function SessionsList() {
  const {currentUser: user} = useContext(UserContext)!;
  const [sessions, setSessions] = useState([] as SessionObj[]);
  const [timeLeft, setTimeLeft] = useState(Math.floor((user.session.accessExpiresAt - Date.now())/1000))

  useEffect(()=>{
    if (!user.online) return
    User.fetchSessions(user).then(sessions=>{
      if (sessions.length > 0) {
        setSessions(sessions)
      } else {
        let timer = setInterval(() => {
          setTimeLeft((timeLeft) => {
            if (timeLeft === 0) {
              clearInterval(timer);
              return 0;
            } else return timeLeft - 1;
          });
        }, 1000);
      }
    })
  }, [])

  if (!user.onlineMode) {
    return (
      <TableRow className="hover:bg-muted/20">
        <div className="flex-col content-center py-2 px-4 flex items-stretch gap-1">
          <a>No session info</a>
          <a>You are currently offline</a>
        </div>
      </TableRow>
    )
  }

  if (sessions.length === 0) {
    return (
      <TableRow className="hover:bg-muted/20">
        <div className="flex-col content-center py-2 px-4 flex items-stretch gap-1">
          <a>No session info</a>
          <a>You will probably get logged out soon... :(</a>
          {timeLeft > 0 ?
          <a>You actually have about {timeLeft} seconds left.</a>
          :
          <a>Goodbye!</a>
          }
        </div>
      </TableRow>
    )
  }

  function handleSessionDelete(sessionId: number, index: number) {
    User.dropSession(user, sessionId).then(success=>{
      if (success) {
        const newSessions = sessions.slice()
        newSessions.splice(index, 1)
        setSessions(newSessions)
        toast.success("Invalidated the session")
      } else {
        toast.error("Failed to invalidate the session")
      }
    })
  }
  
  return (
    <>
      {sessions.map((session, index)=>(
        <TableRow className="hover:bg-muted/20">
          <div className="flex flex-row items-center gap-2 px-2">
            <a>{index+1}</a>
            <div className="flex flex-col grow text-left">
              <a>{session.name}</a>
              <a>{session.description}</a>
            </div>
            <div className="flex flex-col text-left text-gray-400 text-xs">
              <a>R: {formatTime(session.tokens.at(-1)?.createdAt ?? 0)}</a>
              <a>C: {formatTime(session.createdAt)}</a>
            </div>
            <DoubleClickButton variant="outline" type="button" onAccept={()=>handleSessionDelete(session.id, index)}><TrashIcon/></DoubleClickButton>
          </div>
        </TableRow>
      ))}
    </>
  )
}

export function AccountInfo() {
  const {currentUser: user, setCurrentUser} = useContext(UserContext)!;
  const [username, setUsername] = useState(user.username);
  const navigate = useNavigate();

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formElements = form.elements as typeof form.elements & {
      displayname: {value: string},
      email: {value: string},
      password: {value: string}
    }
    const rawdata = {
      username: username || undefined,
      displayname: formElements.displayname.value || undefined,
      email: formElements.email.value || undefined,
      password: formElements.password.value || undefined
    }
    const {success: parseSuccess, data, error} = UserPatchSchema.safeParse(rawdata);
    if (!parseSuccess) {
      toast.error("Input error", {description: formatZodIssue(error.errors[0]), duration: 2000})
      return;
    }
    if ((!rawdata.username || rawdata.username === user.username)
      && (!rawdata.displayname || rawdata.displayname === user.displayname)
      && (!rawdata.email || rawdata.email === user.email) && !rawdata.password
    ) return; // No changes made
    const {success, user: newuser, message } = await User.updateAccount(user, data)
    if (!success) {
      toast.error("Update error", {description: message || "Unknown error", duration: 2000})
      return;
    }
    setCurrentUser(newuser)
    User.commit(newuser)
    formElements.password.value=""
    toast.success("Information updated", {duration: 1500})
  }

  return (
    <ScrollArea className="w-full max-h-full px-2">
    <form onSubmit={handleSubmit}>
    <Table className="w-full">
      <TableHeader>
        <TableRow className="w-full">
          <TableHead className="text-center py-1">
            <div className="flex">
              <Button variant={"outline"} className="flex-1" type="button" onClick={()=>navigate("/account")}><StepBackIcon/></Button>
              <a className="grow text-lg text-center font-semibold align-middle py-1">Account info</a>
              <Button variant={"outline"} className="flex-1" type="submit">Save</Button>
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="hover:bg-muted/20">
          <div className="flex-row content-center py-2 px-4 flex items-center gap-2">
            <a className="text-left w-30 font-semibold">Display name</a>
            <Input className="grow" id="displayname" name="displayname" placeholder="Display name" defaultValue={user.displayname}/>
          </div>
        </TableRow>
        <TableRow className="hover:bg-muted/20">
          <div className="flex-row content-center py-2 px-4 flex items-center gap-2">
            <a className="text-left w-30 font-semibold">Username</a>
            <Input className="grow" id="username" name="username" placeholder="Username" value={username} autoCapitalize="none"
            onChange={(e)=>{
              setUsername(e.target.value.toLowerCase())
            }}
            />
          </div>
        </TableRow>
        <TableRow className="hover:bg-muted/20">
          <div className="flex-row content-center py-2 px-4 flex items-center gap-2">
            <a className="text-left w-30 font-semibold">Email</a>
            <Input className="grow" id="email" name="email" placeholder="Email" defaultValue={user.email} type="email"/>
          </div>
        </TableRow>
        <TableRow className="hover:bg-muted/20">
          <div className="flex-row content-center py-2 px-4 flex items-center gap-2">
            <a className="text-left w-30 font-semibold">Password</a>
            <Input className="grow" id="password" name="password" placeholder="New password (optional)" type="password"/>
          </div>
        </TableRow>
      </TableBody>
    </Table>
    </form>
  </ScrollArea>
  )
}
