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
