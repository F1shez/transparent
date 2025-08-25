import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import { InputMessage } from "./InputMessage";
import { VideoContainer } from "./VideoContainer";
import { useState } from "react";
import { useStore } from "../lib/store";

interface MainChatAreaProps {
    connected: boolean;
    sendMessage: (message: string) => void;
}
export function MainChatArea(props: MainChatAreaProps) {
    const [fullScreenVideo, setFullScreenVideo] = useState(false);
    const { messages, remoteVideos } = useStore();

    return (
        <div className="flex-1 flex flex-col bg-[#36393f] max-w-full overflow-x-auto">

            {/* Video */}
            {remoteVideos.size > 0 && <ScrollArea className={fullScreenVideo ? "w-full h-full" : "p-4"}>
                <div className={fullScreenVideo ? "" : "flex justify-center space-x-4"}>
                    {[...remoteVideos.entries()].map(([id, video]) => (
                        <div key={id}>
                            <VideoContainer video={video} setFullScreenVideo={setFullScreenVideo} />
                        </div>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>}

            {!fullScreenVideo &&
                <>
                    {/* Messages */}
                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-4">
                            {messages.map((message, index) => (
                                <div key={index} className="group">
                                    <div className="flex items-start space-x-3">
                                        <div className="flex-1">
                                            <p className="text-[#dcddde]">{message}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    {/* Message Input */}
                    <InputMessage sendMessage={props.sendMessage} disabled={!props.connected} />
                </>}
        </div >
    );
}