import { Copy, Mic, MicOff, Phone, PhoneOff, Plus, Settings, Video, VideoOff } from "lucide-react";
import { Button } from "./ui/button";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";
import { useStore, } from "../lib/store";
import { OnlineUser } from "./OnlineUsers";
import { WaitingUsers } from "./WaitingUsers";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    connected: boolean;
    selfId: string;
    selfName: string;
    isMain: boolean;
    localStream: MediaStream | null;
    roomId: string;
    acceptUser: (userId: string) => void;
    rejectUser: (userId: string) => void;
    startCall: () => void;
    stopCall: () => void;
    isMuted: boolean;
    toggleMute: () => void;
    startVideo: () => void;
    stopVideo: () => void;
}

export function Sidebar(props: SidebarProps) {
    const [isVideoEnabled, setIsVideoEnabled] = useState(false);

    const { onlineUsers } = useStore();

    function stopCall() {
        setIsVideoEnabled(false);
        props.stopCall();
    }

    useEffect(() => {
        setIsVideoEnabled((props.localStream?.getVideoTracks() && props.localStream?.getVideoTracks().length > 0) !== undefined);
    }, [])

    function toggleVideo() {
        if (props.localStream?.getVideoTracks() && props.localStream?.getVideoTracks().length > 0) {
            setIsVideoEnabled(false);
            props.stopVideo();
        } else {
            setIsVideoEnabled(true);
            props.startVideo()
        }
    }

    return (
        <div>
            {/* Sidebar */}
            <div className="bg-[#2f3136] flex flex-col h-screen">
                {/* Logo Header */}
                <div className="p-4 border-b border-[#202225]">
                    <span className="text-xl text-white line-through decoration-pink-500">transparent</span>
                </div>

                <div className="p-3 border-b border-[#202225]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[#dcddde] text-sm">Room ID</span>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { navigator.clipboard.writeText(window.location.href.split('?')[0] + "?roomId=" + props.roomId); toast.success('Room id copied to clipboard!') }}
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
                </div>

                {/* Voice settings */}
                {props.localStream && (
                    <div className="p-3 bg-[#3c3f45] border-b border-[#202225]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[#dcddde] text-sm">Call Settings</span>
                            <div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={props.toggleMute}
                                    className="hover:text-red-300 hover:bg-[#40444b] h-6 w-6 p-0"
                                >
                                    {props.isMuted ? <MicOff className="h-4 w-4 text-red-400" /> : <Mic className="text-white h-4 w-4" />}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={toggleVideo}
                                    className="hover:text-red-300 hover:bg-[#40444b] h-6 w-6 p-0"
                                >
                                    {isVideoEnabled ? <Video className="text-white h-4 w-4" /> : <VideoOff className="text-red-400 h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant={props.localStream ? "default" : "secondary"}
                                onClick={stopCall}
                                className="flex-1 bg-[#5865f2] hover:bg-[#4752c4] text-white"
                            >
                                <PhoneOff className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Voice Controls (when not in channel) */}
                {!props.localStream && (
                    <div className="p-3 border-b border-[#202225]">
                        <Button
                            disabled={!props.connected}
                            onClick={props.startCall}
                            className="w-full bg-[#3ba55c] hover:bg-[#2d7d32] text-white"
                        >
                            <Phone className="h-4 w-4 mr-2" />
                            Join Voice
                        </Button>
                    </div>
                )}

                {/* Waiting Users (Main User Only) */}
                {props.isMain && onlineUsers.filter(user => user.waitingAccept === true).length > 0 && (
                    <WaitingUsers acceptUser={props.acceptUser} rejectUser={props.rejectUser} />
                )}

                {/* Online Users */}
                <OnlineUser selfId={props.selfId} selfName={props.selfName} isMain={props.isMain} />
                <div className="flex z-50 text-white mb-4 w-full">
                    <a href="https://github.com/F1shez" target="_blank" rel="noopener noreferrer" className="w-full text-center">by notahero</a>
                </div>
            </div>
        </div>
    );
}