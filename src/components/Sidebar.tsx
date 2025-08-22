import { Check, Copy, Crown, Mic, MicOff, Phone, PhoneOff, Plus, Settings, Users, Video, VideoOff, X } from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import type { user } from "../App";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    connected: boolean;
    selfId: string;
    selfName: string;
    onlineUsers: user[];
    isMain: boolean;
    localStream: MediaStream | null;
    roomId: string;
    haveUserWaitConnection: string[]
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
                                    {isVideoEnabled ? <VideoOff className="text-red-400 h-4 w-4" /> : <Video className="text-white h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant={props.localStream ? "default" : "secondary"}
                                onClick={props.stopCall}
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
                {props.isMain && props.haveUserWaitConnection.length > 0 && (
                    <div className="p-3 border-b border-[#202225]">
                        <h3 className="text-[#dcddde] text-sm mb-2 flex items-center">
                            <Users className="h-4 w-4 mr-2" />
                            Waiting ({props.haveUserWaitConnection.length})
                        </h3>
                        <ScrollArea className="max-h-32">
                            {props.haveUserWaitConnection.map((userId) => (
                                <div key={userId} className="flex items-center justify-between mb-2 text-sm">
                                    <div>
                                        <div className="text-[#b9bbbe]">{props.onlineUsers.find((user,) => { return user.id === userId })?.userName}{"\n"}</div>
                                        <div className="text-[#b9bbbe]">({userId})</div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                props.acceptUser(userId)
                                            }}
                                            className="h-6 w-6 p-0 text-green-400 hover:text-green-300 hover:bg-[#40444b]"
                                        >
                                            <Check className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                props.rejectUser(userId)
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
                )}

                {/* Online Users */}
                <div className="flex-1 p-3">
                    <h3 className="text-[#dcddde] text-sm mb-3 flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        Online — {props.onlineUsers.length + 1}
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
                        {props.onlineUsers.map((user, index) => (
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
                <div className="flex z-50 text-white mb-4 w-full">
                    <a href="https://github.com/F1shez" target="_blank" rel="noopener noreferrer" className="w-full text-center">by notahero</a>
                </div>
            </div>
        </div>
    );
}