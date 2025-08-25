import { useEffect, useRef, useState } from "react";
import { createPeer, type SignalEnvelope } from "./lib/webrtc";
import { useLogs } from "./components/Logs";
import { Toaster } from "react-hot-toast";
import { Sidebar } from "./components/Sidebar";
import { MainChatArea } from "./components/MainChatArea";
import { Sheet, SheetContent, SheetDescription, SheetTrigger } from "./components/ui/sheet";
import { Menu } from "lucide-react";
import { DialogTitle } from "./components/ui/dialog";
import { useStore, type user } from "./lib/store";
import { silentAudioHack } from "./lib/utils";
import { handleData, handleTrack } from "./lib/peerHandlers";

type ServerMsg =
  | { type: "joined"; id: string; roomId: string; userName: string; role: "main" | "peer", users?: user[] }
  | { type: "peer-joined"; id: string, userName: string }
  | { type: "peer-left"; id: string }
  | { type: "signal"; from: string; userName: string; payload: SignalEnvelope }
  | { type: "main-changed"; id: string }
  | { type: "sync"; users: user[] };

export default function App() {
  const { pushLog, Logs } = useLogs();
  const [connected, setConnected] = useState(false);

  const {
    roomId,
    remoteAudios,
    remoteVideos,
    addMessage,
    setWs,
    onlineUsers,
    setOnlineUsers,
    addUserToOnline,
    removeUserFromOnline
  } = useStore();

  const [isMain, setIsMain] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const peersRef = useRef<Map<string, ReturnType<typeof createPeer> | null>>(new Map());

  const myIdRef = useRef<string | null>(null);
  const myNameRef = useRef<string | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        wsRef.current?.send(JSON.stringify({ type: "sync" }));
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    silentAudioHack();

    const urlWs = import.meta.env.VITE_URL_WS || prompt("Enter URL WebSocket: ");
    const ws = new WebSocket(urlWs);
    wsRef.current = ws;
    setWs(wsRef.current)

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
        addUserToOnline({ id: msg.id, userName: msg.userName, waitingAccept: true });
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
          const audio = remoteAudios.get(msg.id);
          if (audio && audio.srcObject) {
            (audio.srcObject as MediaStream).getAudioTracks().forEach((track) => track.stop());
            useStore.setState((prev) => {
              const newMap = new Map(prev.remoteAudios);
              newMap.delete(msg.id);
              return { remoteAudios: newMap };
            });
          }

          const video = remoteVideos.get(msg.id);
          if (video && video.srcObject) {
            (video.srcObject as MediaStream).getVideoTracks().forEach((track) => track.stop());
            useStore.setState((prev) => {
              const newMap = new Map(prev.remoteVideos);
              newMap.delete(msg.id);
              return { remoteVideos: newMap };
            });
          }
        }
        removeUserFromOnline(msg.id);
        setConnected(false);
        return;
      }

      if (msg.type === "sync") {
        setOnlineUsers(msg.users);
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
              if (!stream) return;
              handleTrack(msg.from, event);
              // Если main — ретрансляция треков другим пирами
              if (isMain) {
                peersRef.current.forEach((peer, id) => {
                  if (!peer || msg.from === id) return;
                  stream.getTracks().forEach(track => {
                    const alreadyAdded = peer.pc.getSenders().some(s => s.track === track);
                    if (!alreadyAdded) peer.pc.addTrack(track, stream);
                  });
                  // pushLog(`Forwarded tracks to peer ${id}`);
                  renegotiate(id);
                });
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
      remoteAudios.forEach((audio) => {
        if (audio.srcObject) {
          (audio.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
        }
      });
      remoteVideos.forEach((video) => {
        if (video.srcObject) {
          (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
        }
      });
    };
  }, []);

  useEffect(() => {
    if (localStream)
      remoteAudios.forEach((audio, peerId) => {
        audio.play().catch((e) => pushLog(`Deferred audio play error (${peerId}): ${e}`));
      });
  }, [localStream, pushLog, remoteAudios])


  function sendSignal(to: string, payload: SignalEnvelope) {
    wsRef.current?.send(JSON.stringify({ type: "signal", to, payload }));
  }

  async function acceptUser(targetId: string) {
    if (!joinedRef.current || !myIdRef.current) {
      pushLog("Не присоединились к комнате еще");
      return;
    }

    if (peersRef.current.get(targetId)) {
      pushLog("Peer уже создан");
      return;
    }

    const updatedUsers: user[] = onlineUsers.map(user =>
      user.id === targetId
        ? { ...user, waitingAccept: false }
        : user
    );
    setOnlineUsers(updatedUsers);

    const peer = createPeer(true, {
      onData: (text) => handleData(targetId, text),
      onOpen: () => {
        pushLog("DataChannel open");
        setConnected(true);
      },
      onTrack: (event) => {
        const stream = event.streams[0];
        if (!stream) return;
        handleTrack(targetId, event);
        // Если main — ретрансляция треков другим пирами
        if (isMain) {
          peersRef.current.forEach((peer, id) => {
            if (!peer || targetId === id) return;
            stream.getTracks().forEach(track => {
              const alreadyAdded = peer.pc.getSenders().some(s => s.track === track);
              if (!alreadyAdded) peer.pc.addTrack(track, stream);
            });
            // pushLog(`Forwarded tracks to peer ${id}`);
            renegotiate(id);
          });
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

  async function rejectUser(targetId: string) {
    removeUserFromOnline(targetId);
  }

  async function startCall() {
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

      remoteAudios.forEach((audio, peerId) => {
        if (audio.srcObject) {
          (audio.srcObject as MediaStream).getTracks().forEach((track) => track.enabled = true);
        }
        audio.play();
        pushLog(`Stopped remote audio from ${peerId}`);
      });

      remoteVideos.forEach((video, peerId) => {
        if (video.srcObject) {
          (video.srcObject as MediaStream).getVideoTracks().forEach((track) => track.enabled = true);
        }
        video.play();
        pushLog(`Stopped remote audio from ${peerId}`);
      });
    } catch (e) {
      pushLog(`Error getting audio: ${e}`);
    }
  }

  async function stopCall() {
    if (!localStream) {
      pushLog("Voice not started");
      return;
    }

    const stream = localStream;
    stream.getTracks().forEach((track) => {
      track.stop();
    })
    setLocalStream(null);
    pushLog("Local audio stopped");

    // Останавливаем все удалённые аудио (чтобы я никого не слышал)
    remoteAudios.forEach((audio, peerId) => {
      if (audio.srcObject) {
        (audio.srcObject as MediaStream).getAudioTracks().forEach((track) => track.enabled = false);
      }
      audio.pause();
      pushLog(`Stopped remote audio from ${peerId}`);
    });

    remoteVideos.forEach((video, peerId) => {
      if (video.srcObject) {
        (video.srcObject as MediaStream).getVideoTracks().forEach((track) => track.enabled = false);
      }
      video.pause();
      pushLog(`Stopped remote audio from ${peerId}`);
    });

    // Удаляем треки из всех peer connections
    peersRef.current.forEach((peer, peerId) => {
      if (!peer) return;
      peer.pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === "audio") {
          peer.pc.removeTrack(sender);
          pushLog(`Removed audio track from peer ${peerId}`);
        }
      });

      // Ренеготиация, чтобы все знали, что аудио больше нет
      renegotiate(peerId);
    });
  }

  function toggleMute() {
    if (!localStream) return;

    setIsMuted(!isMuted);

    localStream.getAudioTracks().forEach(track => {
      track.enabled = !!isMuted;
    });

    pushLog(!isMuted ? "Microphone muted" : "Microphone unmuted");
  }

  async function startVideo() {
    if (!localStream) {
      pushLog("for start video need audio started!")
      return;
    }

    const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
    const videoTrack = videoStream.getVideoTracks()[0];

    localStream.addTrack(videoTrack);
    pushLog("video added to localstream");

    peersRef.current.forEach((peer, peerId) => {
      if (!peer) return;

      // Проверяем, что трек ещё не добавлен (во избежание дубликатов)
      const alreadyAdded = peer.pc.getSenders().some(s => s.track === videoTrack);
      if (!alreadyAdded) {
        peer.pc.addTrack(videoTrack, localStream);
        pushLog(`Видео-трек добавлен к peer ${peerId}`);
        renegotiate(peerId);
      }
    });
  }

  async function renegotiate(targetId: string) {
    const peer = peersRef.current.get(targetId);
    if (!peer) return;

    // разрешаем оффер только если idle или stable
    if (peer.pc.signalingState !== "stable") {
      pushLog(`Skip renegotiation for ${targetId}, state=${peer.pc.signalingState}`);
      return;
    }

    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    sendSignal(targetId, { type: "offer", sdp: offer });
    pushLog(`Renegotiated offer sent to ${targetId}`);
  }

  async function stopVideo() {
    if (!localStream?.getVideoTracks() || localStream?.getVideoTracks().length === 0) {
      pushLog("Video not started");
      return;
    }

    const stream = localStream;
    stream.getVideoTracks().forEach((track) => {
      track.stop();
      stream.removeTrack(track);
    })
    setLocalStream(stream);
    pushLog("video stopped");

    // Remove all track from peer connections
    peersRef.current.forEach((peer, peerId) => {
      if (!peer) return;
      peer.pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === "video") {
          peer.pc.removeTrack(sender);
          pushLog(`Removed video track from peer ${peerId}`);
        }
      });
      // Renegotiation, so everyone knows that the video is no longer available.
      renegotiate(peerId);
    });
  }

  async function sendMessage(message: string) {
    if (!myIdRef.current || peersRef.current.size === 0) return;
    const msg = { from: myIdRef.current, userName: myNameRef.current, text: message };
    const json = JSON.stringify(msg);
    peersRef.current.forEach((peer) => {
      if (!peer) return;
      try {
        peer.channel.send(json);
        addMessage(`Me: ${message}`);
      } catch (e) {
        console.error(e);
      }
    });
  }

  const sidebar = (
    <Sidebar
      className=""
      connected={connected}
      startCall={startCall}
      stopCall={stopCall}
      acceptUser={acceptUser}
      rejectUser={rejectUser}
      selfId={myIdRef.current!}
      selfName={myNameRef.current!}
      localStream={localStream}
      roomId={roomId}
      isMain={isMain}
      isMuted={isMuted}
      toggleMute={toggleMute}
      startVideo={startVideo}
      stopVideo={stopVideo}
    />
  );

  return (
    <div className="flex w-screen h-screen bg-[#36393f]">
      <Toaster />
      {myIdRef.current
        && myNameRef.current
        &&
        <div className="hidden lg:block">
          {sidebar}
        </div>
      }

      <div className="lg:hidden absolute top-2 left-2 z-50">
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
            {myIdRef.current && myNameRef.current && <div>{sidebar}</div>}
          </SheetContent>
        </Sheet>
      </div>
      <MainChatArea connected={connected} sendMessage={sendMessage} />
      {import.meta.env.VITE_environment === "development" && <div className="invisible xl:visible absolute top-1 right-1 z-50"><Logs /></div>}
    </div>
  );
}
