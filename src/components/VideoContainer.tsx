import { Maximize, Minimize } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";

interface VideoContainerProps {
    video: HTMLVideoElement;
    setFullScreenVideo: (isFullScreen: boolean) => void;
}
export function VideoContainer(props: VideoContainerProps) {
    const [fullScreen, setFullScreen] = useState(false);

    useEffect(() => {
        props.setFullScreenVideo(fullScreen);
    }, [fullScreen]);

    return (
        <div className={fullScreen ? "absolute w-full h-full bg-black" : "relative w-96 h-72 rounded-lg bg-black"}>
            <video
                ref={(el) => {
                    if (el) el.srcObject = props.video.srcObject;
                }}
                autoPlay
                playsInline
                className={fullScreen ? "absolute w-full h-full" : "relative w-96 h-72 rounded-lg"}
            />
            <Button
                onClick={() => setFullScreen(prev => !prev)}
                className="absolute bottom-0 right-0"
            >
                {!fullScreen && <Maximize className="text-white backdrop-blur-xs rounded-xs" />}
                {fullScreen && <Minimize className="text-white backdrop-blur-xs rounded-xs" />}
            </Button>
        </div>
    );
}