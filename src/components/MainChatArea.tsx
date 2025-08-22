import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import { InputMessage } from "./InputMessage";
import { VideoContainer } from "./VideoContainer";
import { useState } from "react";

interface MainChatAreaProps {
    connected: boolean;
    messages: string[];
    sendMessage: (message: string) => void;
    remoteVideosRef: Map<string, HTMLVideoElement>;
}
export function MainChatArea(props: MainChatAreaProps) {
    const [fullScreenVideo, setFullScreenVideo] = useState(false);

    return (
        <div className="flex-1 flex flex-col bg-[#36393f] max-w-full overflow-x-auto">

            {/* Video */}
            {props.remoteVideosRef.size > 0 && <ScrollArea className={fullScreenVideo ? "w-full h-full" : "p-4"}>
                <div className={fullScreenVideo ? "" : "flex justify-center space-x-4"}>
                    {[...props.remoteVideosRef.entries()].map(([id, video]) => (
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
                            {props.messages.map((message, index) => (
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