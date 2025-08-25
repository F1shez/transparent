import randomString from "crypto-random-string";

export function getPageName() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('roomId');
    if (roomId) {
        return roomId;
    } else {
        const url = new URL(window.location.href);

        const newRoomId = typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : randomString({ length: 32, type: "hex" })

        url.searchParams.set('roomId', newRoomId); // если параметр уже есть — заменит

        window.history.replaceState({}, '', url);
        return newRoomId;
    }
}

//for turn page to off (ram saver)
export function silentAudioHack() {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0; // без звука
    osc.connect(gain).connect(ctx.destination);
    osc.start();
}