import { useEffect, useRef, useState } from "react";
import { createPeer, type SignalEnvelope } from "./lib/webrtc";
import randomString from "crypto-random-string";

type ServerMsg =
  | { type: "joined"; id: string; roomId: string; role: "main" | "peer" }
  | { type: "peer-joined"; id: string }
  | { type: "peer-left"; id: string }
  | { type: "signal"; from: string; payload: SignalEnvelope }
  | { type: "main-changed"; id: string };

export default function App() {
  const [log, setLog] = useState<string[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [roomId] = useState(
    getPageName() ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : randomString({ length: 32, type: "hex" }))
  );
  const [isMain, setIsMain] = useState(false);
  const [haveUserWaitConnection, setHaveUserWaitConnection] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const peersRef = useRef<Map<string, ReturnType<typeof createPeer> | null>>(new Map());

  const myIdRef = useRef<string | null>(null);
  const joinedRef = useRef(false);

  const pushLog = (s: string) => setLog((L) => [...L, s]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001");
    wsRef.current = ws;

    ws.onopen = () => {
      pushLog("WS open");
      ws.send(JSON.stringify({ type: "join", roomId }));
    };

    ws.onmessage = async (event) => {
      const text =
        event.data instanceof Blob ? await event.data.text() : String(event.data);
      let msg: ServerMsg;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }

      if (msg.type === "joined") {
        pushLog(`Joined room ${msg.roomId} as ${msg.id}, role=${msg.role}`);
        myIdRef.current = msg.id;
        joinedRef.current = true;
        setIsMain(msg.role === "main");
        return;
      }

      if (msg.type === "main-changed") {
        pushLog(`New main is ${msg.id}`);
        setIsMain(msg.id === myIdRef.current);
        return;
      }

      if (msg.type === "peer-joined") {
        pushLog(`Peer joined: ${msg.id}.`);
        setHaveUserWaitConnection(true);
        return;
      }

      if (msg.type === "peer-left") {
        pushLog(`Peer left: ${msg.id}`);
        if (peersRef.current) {
          const peer = peersRef.current.get(msg.id)
          if (peer) {
            peer.pc.close();
            peersRef.current.delete(msg.id);
          }
        }
        setHaveUserWaitConnection(false);
        setConnected(false);
        return;
      }

      // create peer in peer side (client)
      if (msg.type === "signal" && myIdRef.current) {
        const payload = msg.payload;

        //create peer if not exist
        if (peersRef.current && peersRef.current.size === 0) {
          const peer = createPeer({
            onData: handleData,
            onOpen: () => {
              pushLog("DataChannel open");
              setConnected(true);
            },
            onSignalingStateChange: (s) => pushLog(`Signaling: ${s}`),
          })
          peersRef.current.set(myIdRef.current, peer);

          peer.pc.onicecandidate = (e) => {
            if (!e.candidate) return;
            sendSignal({ type: "candidate", candidate: e.candidate.toJSON() });
          };
        }
        const peer = peersRef.current.get(myIdRef.current);
        if (peer) {
          if (payload.type === "offer") {
            await peer.applyRemoteDescription(payload.sdp);
            const answer = await peer.pc.createAnswer();
            await peer.pc.setLocalDescription(answer);
            sendSignal({ type: "answer", sdp: answer });
          } else if (payload.type === "answer") {
            await peer.applyRemoteDescription(payload.sdp);
          } else if (payload.type === "candidate") {
            await peer.addIceCandidate(payload.candidate);
          }
        }
      }
    };

    ws.onerror = () => pushLog("WS error");
    ws.onclose = () => pushLog("WS closed");

    return () => ws.close();
  }, []);


  function sendSignal(payload: SignalEnvelope) {
    wsRef.current?.send(JSON.stringify({ type: "signal", roomId, payload }));
  }

  function getPageName() {
    const cleanPath = window.location.pathname.split("?")[0].split("#")[0];
    return cleanPath.substring(cleanPath.lastIndexOf("/") + 1);
  }

  async function startMessage() {
    setHaveUserWaitConnection(false);
    if (!joinedRef.current || !myIdRef.current) {
      pushLog("Не присоединились к комнате еще");
      return;
    }

    if (peersRef.current.get(myIdRef.current)) {
      pushLog("Peer уже создан");
      return;
    }

    const peer = createPeer({
      onData: handleData,
      onOpen: () => {
        pushLog("DataChannel open");
        setConnected(true);
      },
      onSignalingStateChange: (s) => pushLog(`Signaling: ${s}`),
    });

    peersRef.current.set(myIdRef.current, peer);

    peer.pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      sendSignal({ type: "candidate", candidate: e.candidate.toJSON() });
    };

    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    sendSignal({ type: "offer", sdp: offer });
    pushLog("Offer sent");
  }

  async function handleData(data: string) {
    setMessages((m) => [...m, "Peer: " + data]);
  }

  async function sendMessage() {
    if (!myIdRef.current) return;
    const peer = peersRef.current.get(myIdRef.current);
    if (!peer) return;
    peer.channel.send(input);
    setMessages((m) => [...m, "Me: " + input]);
    setInput("");
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>P2P Messenger</h1>
      <span>{roomId}</span>
      <div>Role: {isMain ? "Main" : "Peer"}</div>

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          {haveUserWaitConnection && isMain && (
            <button onClick={startMessage}>Разрешить подключение</button>
          )}

          <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd" }}>
            <div>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message…"
                style={{ width: "70%" }}
              />
              <button onClick={sendMessage} disabled={!connected || !input}>
                Send
              </button>
            </div>

            <h3>Messages</h3>
            {messages.map((m, i) => (
              <div key={i}>{m}</div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <h3>Log</h3>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: 12,
              border: "1px solid #ddd",
              padding: 12,
              height: 300,
              overflow: "auto",
            }}
          >
            {log.join("\n")}
          </pre>
        </div>
      </div>
    </div>
  );
}
