// client/src/lib/webrtc.ts
export type SignalEnvelope =
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "candidate"; candidate: RTCIceCandidateInit };

export type PeerHandlers = {
  onData: (text: string) => void;
  onOpen?: () => void;
  onSignalingStateChange?: (s: RTCSignalingState) => void;
};

export function createPeer(handlers: PeerHandlers) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  // Очередь ICE-кандидатов до установки remoteDescription
  const pendingCandidates: RTCIceCandidateInit[] = [];
  let remoteDescSet = false;

  // DataChannel для чата
  let channel: RTCDataChannel | null = null;
  channel = pc.createDataChannel("chat");
  channel.onopen = () => handlers.onOpen?.();
  channel.onmessage = (e) => handlers.onData(e.data);

  // Если вы «ответчик», канал придёт с ondatachannel
  pc.ondatachannel = (e) => {
    channel = e.channel;
    channel.onopen = () => handlers.onOpen?.();
    channel.onmessage = (ev) => handlers.onData(ev.data);
  };

  pc.onicecandidate = (e) => {
    // Отправка кандидата происходит снаружи, здесь только сбор
  };

  pc.onsignalingstatechange = () =>
    handlers.onSignalingStateChange?.(pc.signalingState);

  async function applyRemoteDescription(desc: RTCSessionDescriptionInit) {
    // защита от «двойного answer» и некорректных состояний
    if (desc.type === "answer" && pc.signalingState !== "have-local-offer") {
      // игнорируем поздний/повторный answer
      return;
    }
    if (desc.type === "offer" && pc.signalingState !== "stable") {
      // простая анти-glare логика: если уже есть локальный offer — откатываемся
      await pc.setLocalDescription({ type: "rollback" } as any);
    }
    await pc.setRemoteDescription(desc);
    remoteDescSet = true;

    // Добавляем накопленные кандидаты
    while (pendingCandidates.length) {
      const c = pendingCandidates.shift()!;
      try {
        await pc.addIceCandidate(c);
      } catch {
        // пропускаем ошибочные кандидаты
      }
    }
  }

  async function addIceCandidate(c: RTCIceCandidateInit) {
    if (!remoteDescSet) {
      pendingCandidates.push(c);
      return;
    }
    try {
      await pc.addIceCandidate(c);
    } catch {
      // пропускаем ошибочные кандидаты
    }
  }

  return {
    pc,
    get channel() {
      return channel!;
    },
    applyRemoteDescription,
    addIceCandidate,
  };
}
