import { Crown, Users } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { useStore } from "../lib/store";

interface OnlineUserProps {
    selfId: string;
    selfName: string;
    isMain: boolean;
}
export function OnlineUser(props: OnlineUserProps) {
    const { onlineUsers } = useStore();
    return (
        <div className="flex-1 p-3">
            <h3 className="text-[#dcddde] text-sm mb-3 flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Online — {onlineUsers.length + 1}
            </h3>
            <ScrollArea className="h-full">
                <div className="flex items-center mb-2 p-1 rounded hover:bg-[#40444b]">
                    <span title={props.selfId} className="text-[#b9bbbe] text-sm flex items-center">
                        <div className="w-2 h-2 bg-[#3ba55c] rounded-full mr-3"></div>
                        {props.selfName}
                        <span className="text-[#72767d] ml-1">(you)</span>
                        {props.isMain && <Crown className="h-3 w-3 ml-1 text-[#faa61a]" />}
                    </span>
                </div>

                {onlineUsers.map((user, index) => (
                    <div key={user.id} className="flex items-center mb-2 p-1 rounded hover:bg-[#40444b]">
                        <div className="w-2 h-2 bg-[#3ba55c] rounded-full mr-3"></div>
                        <span title={user.id} className="text-[#b9bbbe] text-sm flex items-center">
                            {user.userName}
                            {index === 0 && !props.isMain && <Crown className="h-3 w-3 ml-1 text-[#faa61a]" />}
                        </span>
                    </div>
                ))}

            </ScrollArea>
        </div>
    )
}