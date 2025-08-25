import { Check, Users, X } from "lucide-react"
import { ScrollArea } from "./ui/scroll-area"
import { Button } from "./ui/button"
import { useStore, type user } from "../lib/store";
import { useEffect, useState } from "react";

interface WaitingUsersProps {
    acceptUser: (userId: string) => void
    rejectUser: (userId: string) => void
}
export function WaitingUsers(props: WaitingUsersProps) {

    const { onlineUsers } = useStore();
    const [waitingUsers, setWaitingUsers] = useState<user[]>([]);

    useEffect(() => {
        setWaitingUsers(onlineUsers.filter((user) => user.waitingAccept))
    }, [onlineUsers])

    return (
        <div className="p-3 border-b border-[#202225]">
            <h3 className="text-[#dcddde] text-sm mb-2 flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Waiting ({waitingUsers.length})
            </h3>
            <ScrollArea className="max-h-32">
                {waitingUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between mb-2 text-sm">
                        <div>
                            <div className="text-[#b9bbbe]">{user.userName}</div>
                            <div className="text-[#b9bbbe]">({user.id})</div>
                        </div>
                        <div className="flex gap-1">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    props.acceptUser(user.id)
                                }}
                                className="h-6 w-6 p-0 text-green-400 hover:text-green-300 hover:bg-[#40444b]"
                            >
                                <Check className="h-3 w-3" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    props.rejectUser(user.id)
                                }}
                                className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-[#40444b]"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                ))}
            </ScrollArea>
        </div>
    )
}