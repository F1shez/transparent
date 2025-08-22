import { Maximize, Minimize } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

interface VideoContainerProps {
    video: HTMLVideoElement;
    setFullScreenVideo: (isFullScreen: boolean) => void;
}
export function VideoContainer(props: VideoContainerProps) {
    const [fullScreen, setFullScreen] = useState(false);

    return (
        <div className={fullScreen ? "z-40 absolute w-full h-full bg-black" : "relative w-48 h-36 rounded-lg bg-black"}>
            <video
                ref={(el) => {
                    if (el) el.srcObject = props.video.srcObject;
                }}
                autoPlay
                playsInline
                className={fullScreen ? "absolute w-full h-full bg-black" : "relative w-48 h-36 rounded-lg bg-black"}
            />
            <Button
                onClick={() => {
                    setFullScreen(prev => {
                        const next = !prev;
                        props.setFullScreenVideo(next);
                        return next;
                    });
                }}
                className="absolute bottom-0 right-0">
                {!fullScreen && <Maximize className="text-white backdrop-blur-xs rounded-xs" />}
                {fullScreen && <Minimize className="text-white backdrop-blur-xs rounded-xs" />}
            </Button>
        </div>
    )
}