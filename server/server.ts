import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";

type Msg =
  | { type: "join"; roomId: string }
  | { type: "signal"; roomId: string; payload: any }
  | { type: "ping" };

type Outbound =
  | { type: "joined"; id: string; roomId: string; role: "main" | "peer" }
  | { type: "peer-joined"; id: string }
  | { type: "peer-left"; id: string }
  | { type: "signal"; from: string; payload: any }
  | { type: "main-changed"; id: string };

type ClientState = {
  id: string;
  roomId?: string;
};

const wss = new WebSocketServer({ port: 3001 });

const rooms = new Map<string, Set<WebSocket>>();
const clients = new WeakMap<WebSocket, ClientState>();
const roomMain = new Map<string, string>(); // roomId -> mainId

function send(ws: WebSocket, data: Outbound) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));
}

function broadcastToRoom(roomId: string, from: WebSocket | null, data: Outbound) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const client of room) {
    if (from && client === from) continue;
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(data));
    }
  }
}

wss.on("connection", (ws) => {
  const state: ClientState = { id: randomUUID() };
  clients.set(ws, state);

  ws.on("message", async (raw) => {
    let text: string;
    if (raw instanceof Buffer) text = raw.toString("utf8");
    else if (typeof raw === "string") text = raw;
    else text = String(raw);

    let msg: Msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }

    if (msg.type === "join") {
      const { roomId } = msg;
      state.roomId = roomId;
      if (!rooms.has(roomId)) rooms.set(roomId, new Set());
      const roomSet = rooms.get(roomId)!;
      roomSet.add(ws);

      // Определяем роль
      let role: "main" | "peer";
      if (!roomMain.has(roomId)) {
        roomMain.set(roomId, state.id);
        role = "main";
      } else {
        role = "peer";
      }

      send(ws, { type: "joined", id: state.id, roomId, role });
      broadcastToRoom(roomId, ws, { type: "peer-joined", id: state.id });
      return;
    }

    if (msg.type === "signal") {
      const roomId = state.roomId;
      if (!roomId) return;
      broadcastToRoom(roomId, ws, {
        type: "signal",
        from: state.id,
        payload: msg.payload,
      });
      return;
    }
  });

  ws.on("close", () => {
    const st = clients.get(ws);
    if (!st?.roomId) return;
    const roomId = st.roomId;
    const set = rooms.get(roomId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) {
        rooms.delete(roomId);
        roomMain.delete(roomId);
      } else {
        broadcastToRoom(roomId, ws, { type: "peer-left", id: st.id });

        // Если вышел главный — назначаем нового
        if (roomMain.get(roomId) === st.id) {
          const newMainWs = [...set][0];
          const newMainId = clients.get(newMainWs)?.id;
          if (newMainId) {
            roomMain.set(roomId, newMainId);
            broadcastToRoom(roomId, null, { type: "main-changed", id: newMainId });
          }
        }
      }
    }
  });
});

console.log("Signaling server running on ws://localhost:3001");