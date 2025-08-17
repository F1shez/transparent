import { useEffect, useRef, useState } from "react";
import { createPeer, type SignalEnvelope } from "./lib/webrtc";
import randomString from "crypto-random-string";
import { useLogs } from "./components/Logs";

type ServerMsg =
  | { type: "joined"; id: string; roomId: string; role: "main" | "peer" }
  | { type: "peer-joined"; id: string }
  | { type: "peer-left"; id: string }
  | { type: "signal"; from: string; payload: SignalEnvelope }
  | { type: "main-changed"; id: string };

export default function App() {
  const { pushLog, Logs } = useLogs();
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
  const [haveUserWaitConnection, setHaveUserWaitConnection] = useState<string[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());  // Для хранения <audio> для каждого peer

  const wsRef = useRef<WebSocket | null>(null);

  const peersRef = useRef<Map<string, ReturnType<typeof createPeer> | null>>(new Map());

  const myIdRef = useRef<string | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    const ws = new WebSocket("ws://213.176.112.194:60764");
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
        setHaveUserWaitConnection(prev => [...prev, msg.id]);
        return;
      }

      if (msg.type === "peer-left") {
        pushLog(`Peer left: ${msg.id}`);
        if (peersRef.current) {
          const peer = peersRef.current.get(msg.id)
          if (peer) {
            peer.pc.close();
            peersRef.current.delete(msg.id);
            pushLog('delete peer')
          }
          const audio = remoteAudiosRef.current.get(msg.id);
          if (audio && audio.srcObject) {
            (audio.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
            remoteAudiosRef.current.delete(msg.id);
          }
        }
        setHaveUserWaitConnection(prev => [...prev.filter(id => id !== msg.id)]);
        setConnected(false);
        return;
      }

      if (msg.type === "signal" && myIdRef.current) {
        const payload = msg.payload;

        // Create peer if not exist
        if (!peersRef.current.has(msg.from)) {
          const peer = createPeer(false, {
            onData: (text) => handleData(msg.from, text),
            onOpen: () => {
              pushLog("DataChannel open");
              setConnected(true);
            },
            onTrack: (event) => {
              const stream = event.streams[0];
              if (stream) {
                pushLog(`Received remote stream from ${msg.from}`);
                const audio = new Audio();
                audio.srcObject = stream;
                audio.autoplay = true;
                audio.play().catch((e) => pushLog(`Audio play error: ${e}`));
                remoteAudiosRef.current.set(msg.from, audio);
              }
            },
            onSignalingStateChange: (s) => pushLog(`Signaling: ${s}`),
          });
          peersRef.current.set(msg.from, peer);

          peer.pc.onicecandidate = (e) => {
            if (!e.candidate) return;
            sendSignal(msg.from, { type: "candidate", candidate: e.candidate.toJSON() });
          };
        }
        const peer = peersRef.current.get(msg.from);
        if (peer) {
          if (payload.type === "offer") {
            await peer.applyRemoteDescription(payload.sdp);
            const answer = await peer.pc.createAnswer();
            await peer.pc.setLocalDescription(answer);
            sendSignal(msg.from, { type: "answer", sdp: answer });
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

    return () => {
      ws.close();
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      remoteAudiosRef.current.forEach((audio) => {
        if (audio.srcObject) {
          (audio.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
        }
      });
    };
  }, []);


  function sendSignal(to: string, payload: SignalEnvelope) {
    wsRef.current?.send(JSON.stringify({ type: "signal", to, payload }));
  }

  function getPageName() {
    const cleanPath = window.location.pathname.split("?")[0].split("#")[0];
    return cleanPath.substring(cleanPath.lastIndexOf("/") + 1);
  }

  async function startMessage(targetId: string) {
    setHaveUserWaitConnection(prev => [...prev.filter(id => id !== targetId)]);
    if (!joinedRef.current || !myIdRef.current) {
      pushLog("Не присоединились к комнате еще");
      return;
    }

    if (peersRef.current.get(targetId)) {
      pushLog("Peer уже создан");
      return;
    }
    const peer = createPeer(true, {
      onData: (text) => handleData(targetId, text),
      onOpen: () => {
        pushLog("DataChannel open");
        setConnected(true);
      },
      onTrack: (event) => {
        const stream = event.streams[0];
        if (stream) {
          pushLog(`Received remote stream from ${targetId}`);
          const audio = new Audio();
          audio.srcObject = stream;
          audio.autoplay = true;
          audio.play().catch((e) => pushLog(`Audio play error: ${e}`));
          remoteAudiosRef.current.set(targetId, audio);
        }
      },
      onSignalingStateChange: (s) => pushLog(`Signaling: ${s}`),
    });

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peer.pc.addTrack(track, localStream);
      });
      pushLog(`Added existing audio track to new peer ${targetId}`);
    }

    peersRef.current.set(targetId, peer);

    peer.pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      sendSignal(targetId, { type: "candidate", candidate: e.candidate.toJSON() });
    };

    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    sendSignal(targetId, { type: "offer", sdp: offer });
    pushLog("Offer sent");
  }

  async function startVoice() {
    if (!isMain || localStream) {
      pushLog("Voice already started or not main");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      pushLog("Audio stream acquired");

      // Добавляем треки в все существующие peer connections (и renegotiate, если нужно)
      peersRef.current.forEach((peer, peerId) => {
        if (!peer) return;
        stream.getTracks().forEach((track) => {
          peer.pc.addTrack(track, stream);
        });
        pushLog(`Added audio track to peer ${peerId}`);

        // Renegotiate: Создаем новый offer и отправляем
        renegotiate(peerId);
      });
    } catch (e) {
      pushLog(`Error getting audio: ${e}`);
    }
  }

  async function renegotiate(targetId: string) {
    const peer = peersRef.current.get(targetId);
    if (!peer) return;

    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    sendSignal(targetId, { type: "offer", sdp: offer });
    pushLog(`Renegotiated offer sent to ${targetId}`);
  }

  async function handleData(peerId: string, data: string) {
    try {
      const json = JSON.parse(data);
      setMessages((m) => [...m, `${json.from}: ${json.text}`]);

      if (isMain) {
        // Forward to all other peers
        const forward = JSON.stringify(json);
        peersRef.current.forEach((p, id) => {
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

  async function sendMessage() {
    if (!myIdRef.current || peersRef.current.size === 0) return;
    const msg = { from: myIdRef.current, text: input };
    const json = JSON.stringify(msg);
    peersRef.current.forEach((peer) => {
      if (!peer) return;
      try {
        peer.channel.send(json);
        setMessages((m) => [...m, `Me (${myIdRef.current}): ${input}`]);
        setInput("");
      } catch (e) {
        console.error(e);
      }
    });
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>P2P Messenger</h1>
      <span>{roomId}</span>
      <div>Role: {isMain ? "Main" : "Peer"}</div>

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          {haveUserWaitConnection.length > 0 && isMain && <>
            {haveUserWaitConnection.map((userId, index) =>
              <li>
                <button onClick={() => startMessage(userId)}>{index}: Разрешить подключение {userId}</button>
              </li>)
            }
          </>}
          {isMain && (
            <button onClick={startVoice} disabled={!!localStream}>
              Start Voice
            </button>
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

        <Logs />
      </div>
    </div>
  );
}
