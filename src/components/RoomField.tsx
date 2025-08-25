import { Copy, Plus, Settings } from "lucide-react"
import { Button } from "./ui/button"
import toast from "react-hot-toast";

interface RoomFieldProps {
    roomId: string;
}
export function RoomField(props: RoomFieldProps) {
    return (
        <>
            <div className="flex items-center justify-between mb-2">
                <span className="text-[#dcddde] text-sm">Room ID</span>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                        navigator.clipboard.writeText(window.location.href.split('?')[0] + "?roomId=" + props.roomId);
                        toast.success('Room id copied to clipboard!')
                    }}
                    className="text-[#b9bbbe] hover:text-[#dcddde] hover:bg-[#40444b] h-6 w-6 p-0"
                >
                    <Copy className="h-3 w-3" />
                </Button>
            </div>
            <div className="text-[#72767d] text-xs font-mono break-all">
                {props.roomId}
            </div>

            <div className="flex gap-2 mt-2">
                <Button
                    onClick={() => { window.location.href = window.location.href.split('?')[0] }}
                    size="sm"
                    className="flex-1 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs h-7"
                >
                    <Plus className="h-3 w-3 mr-1" />
                    New Room
                </Button>
                <Button
                    disabled={true}
                    onClick={() => { }}
                    size="sm"
                    variant="secondary"
                    className="flex-1 bg-[#40444b] hover:bg-[#4a4e55] text-[#dcddde] text-xs h-7"
                >
                    <Settings className="h-3 w-3 mr-1" />
                    Config
                </Button>
            </div>
        </>
    )
}