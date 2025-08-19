import { useEffect, useRef, useState } from "react";
import { createPeer, type SignalEnvelope } from "./lib/webrtc";
import randomString from "crypto-random-string";
import { useLogs } from "./components/Logs";
import { Toaster } from "react-hot-toast";
import { Sidebar } from "./components/Sidebar";
import { MainChatArea } from "./components/MainChatArea";
import { Sheet, SheetContent, SheetDescription, SheetTrigger } from "./components/ui/sheet";
import { Menu } from "lucide-react";
import { DialogTitle } from "./components/ui/dialog";

export interface user {
  id: string;
  userName: string;
}

type ServerMsg =
  | { type: "joined"; id: string; roomId: string; userName: string; role: "main" | "peer", users?: user[] }
  | { type: "peer-joined"; id: string, userName: string }
  | { type: "peer-left"; id: string }
  | { type: "signal"; from: string; userName: string; payload: SignalEnvelope }
  | { type: "main-changed"; id: string };

export default function App() {
  const { pushLog, Logs } = useLogs();
  const [messages, setMessages] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [roomId] = useState(
    getPageName() ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : randomString({ length: 32, type: "hex" }))
  );
  const [isMain, setIsMain] = useState(false);
  const [haveUserWaitConnection, setHaveUserWaitConnection] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<user[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());  // Для хранения <audio> для каждого peer

  const wsRef = useRef<WebSocket | null>(null);

  const peersRef = useRef<Map<string, ReturnType<typeof createPeer> | null>>(new Map());

  const myIdRef = useRef<string | null>(null);
  const myNameRef = useRef<string | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    const urlWs = import.meta.env.VITE_URL_WS || prompt("Enter URL WebSocket: ");
    const ws = new WebSocket(urlWs);
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
        myNameRef.current = msg.userName;
        joinedRef.current = true;
        setIsMain(msg.role === "main");

        myNameRef.current = msg.userName;

        if (msg.users) {
          setOnlineUsers(msg.users);
        }

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
        setOnlineUsers(prev => [...prev, { id: msg.id, userName: msg.userName }]);
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
        setOnlineUsers(prev => [...prev.filter(user => user.id !== msg.id)]);
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
            onTrack: (event) => handleTrack(msg.from, event),
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
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('roomId');
  }

  async function startMessage(targetId: string) {
    if (!joinedRef.current || !myIdRef.current) {
      pushLog("Не присоединились к комнате еще");
      return;
    }

    if (peersRef.current.get(targetId)) {
      pushLog("Peer уже создан");
      return;
    }

    setHaveUserWaitConnection(prev => [...prev.filter(id => id !== targetId)]);

    const peer = createPeer(true, {
      onData: (text) => handleData(targetId, text),
      onOpen: () => {
        pushLog("DataChannel open");
        setConnected(true);
      },
      onTrack: (event) => handleTrack(targetId, event),
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
    if (localStream) {
      pushLog("Voice already started");
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
      //TODO remove this?
      remoteAudiosRef.current.forEach((audio, peerId) => {
        audio.play().catch((e) => pushLog(`Deferred audio play error (${peerId}): ${e}`));
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
      setMessages((m) => [...m, `${json.userName} (${json.from}): ${json.text}`]);

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

  async function handleTrack(peerId: string, event: RTCTrackEvent) {
    console.log('handleTrack called with:', { peerId, event });
    const stream = event.streams[0];
    if (stream) {
      pushLog(`Received remote stream from ${peerId}`);
      const audio = new Audio();
      audio.srcObject = stream;
      audio.autoplay = false;
      audio.play().catch((e) => pushLog(`Audio play error: ${e}`));
      remoteAudiosRef.current.set(peerId, audio);
      if (isMain) {
        peersRef.current.forEach((peer, peerId) => {
          if (!peer) return;
          stream.getTracks().forEach((track: any) => {
            peer.pc.addTrack(track, stream);
          });
          pushLog(`Added audio track to peer ${peerId}`);

          renegotiate(peerId);
        });
      }
    }
  }

  async function sendMessage(message: string) {
    if (!myIdRef.current || peersRef.current.size === 0) return;
    const msg = { from: myIdRef.current, userName: myNameRef.current, text: message };
    const json = JSON.stringify(msg);
    peersRef.current.forEach((peer) => {
      if (!peer) return;
      try {
        peer.channel.send(json);
        setMessages((m) => [...m, `Me: ${message}`]);
      } catch (e) {
        console.error(e);
      }
    });
  }

  return (
    <div className="flex w-screen h-screen bg-[#36393f]">
      <Toaster />
      {myIdRef.current
        && myNameRef.current
        && <Sidebar
          className="hidden lg:block"
          connected={connected}
          startVoice={startVoice}
          acceptUser={startMessage}
          rejectUser={(id: string) => { console.log("reject" + id) }}
          selfId={myIdRef.current}
          selfName={myNameRef.current}
          haveUserWaitConnection={haveUserWaitConnection}
          localStream={localStream !== null}
          roomId={roomId}
          onlineUsers={onlineUsers}
          isMain={isMain}
        />}

      <div className="xl:hidden absolute top-2 left-2 z-50">
        <Sheet>
          <DialogTitle>
            <SheetTrigger asChild>
              <button className="p-2 rounded-xl bg-[#202225] text-white shadow-lg">
                <Menu className="h-6 w-6" />
              </button>
            </SheetTrigger>
          </DialogTitle>
          <SheetContent side="left" className="bg-[#2f3136] p-0 w-[280px]">
            <SheetDescription></SheetDescription>
            {myIdRef.current && myNameRef.current && (
              <Sidebar
                className=""
                connected={connected}
                startVoice={startVoice}
                acceptUser={startMessage}
                rejectUser={(id: string) => console.log("reject " + id)}
                selfId={myIdRef.current}
                selfName={myNameRef.current}
                haveUserWaitConnection={haveUserWaitConnection}
                localStream={localStream !== null}
                roomId={roomId}
                onlineUsers={onlineUsers}
                isMain={isMain}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
      <MainChatArea connected={connected} messages={messages} sendMessage={sendMessage} />
      <div className="invisible xl:visible absolute top-1 right-1 z-50"><Logs /></div>
    </div>
  );
}
