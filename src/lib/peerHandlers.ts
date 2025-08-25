import { useStore } from "./store";


export async function handleData(peerId: string, data: string) {
    try {
        const { myInfo, addMessage, peers } = useStore.getState();
        const json = JSON.parse(data);
        addMessage(`${json.userName} (${json.from}): ${json.text}`);

        if (myInfo?.isMain) {
            // Forward to all other peers
            const forward = JSON.stringify(json);
            peers.forEach((p, id) => {
                if (id !== peerId && p) {
                    try {
                        p.channel.send(forward);
                    } catch (e) {
                        console.error(`Failed to forward to ${id}:`, e);
                    }
                }
            });
        }
    } catch (e) {
        console.error("Invalid message data:", e);
    }
}

export async function handleTrack(fromId: string, event: RTCTrackEvent) {

    console.log('handleTrack called with:', { fromId, event });
    const stream = event.streams[0];
    if (!stream) return;

    const { remoteVideos } = useStore.getState();

    stream.onremovetrack = (ev) => {
        if (ev.track.kind === "video") {
            // pushLog("Remote peer turned off video");
            useStore.setState((prev) => {
                const newMap = new Map(prev.remoteVideos);
                newMap.delete(fromId);
                return { remoteVideos: newMap };
            });
        }
    };

    // pushLog(`Received remote stream from ${fromId}`);

    // Проверка аудио
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
        const audio = new Audio();
        audio.srcObject = new MediaStream(audioTracks);
        audio.autoplay = true;
        useStore.setState((prev) => ({
            remoteAudios: new Map(prev.remoteAudios).set(fromId, audio!)
        }));
        // pushLog(`Audio track received from ${fromId}`);
    }

    // Проверка видео
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length > 0) {
        // Создаем или используем существующий <video> элемент
        let videoEl = remoteVideos.get(fromId);
        if (!videoEl) {
            videoEl = document.createElement("video");
            videoEl.autoplay = true;
            videoEl.playsInline = true;
            useStore.setState((prev) => ({
                remoteVideos: new Map(prev.remoteVideos).set(fromId, videoEl!)
            }));
        }
        videoEl.srcObject = new MediaStream(videoTracks);
        // pushLog(`Video track received from ${fromId}`);
    }
}