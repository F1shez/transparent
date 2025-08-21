import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { user } from "../src/App";

type Msg =
  | { type: "join"; roomId: string, userName: string }
  | { type: "signal"; to: string; payload: any }
  | { type: "ping" };

type Outbound =
  | { type: "joined"; id: string; userName: string; roomId: string; role: "main" | "peer", users: user[] }
  | { type: "peer-joined"; id: string, userName: string }
  | { type: "peer-left"; id: string }
  | { type: "signal"; from: string; userName: string; payload: any }
  | { type: "main-changed"; id: string };

type ClientState = {
  id: string;
  roomId?: string;
  userName?: string;
};

const wss = new WebSocketServer({ host: "0.0.0.0", port: 60764 });

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

function getRandomName(): string {
  const data = readFileSync("./data/randomNames.json", 'utf8');
  const names = JSON.parse(data)
  const name = names[Math.floor(Math.random() * names.length)]
  return name;
}

wss.on("connection", (ws) => {
  const state: ClientState = { id: randomUUID(), userName: getRandomName() || "Anonymous" };
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

      const existingUsers = [...roomSet]
        .filter(client => client !== ws)
        .map(client => {
          const cs = clients.get(client);
          return cs ? { id: cs.id, userName: cs.userName || "Anonymous" } : null;
        })
        .filter((u): u is { id: string; userName: string } => u !== null); // type guard

      send(ws, { type: "joined", id: state.id, userName: state.userName || "Anonymous", roomId, role, users: existingUsers });

      broadcastToRoom(roomId, ws, { type: "peer-joined", id: state.id, userName: state.userName || "Anonymous" });
      return;
    }

    if (msg.type === "signal") {
      const roomId = state.roomId;
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      const { to, payload } = msg;
      for (const client of room) {
        const clientState = clients.get(client);
        if (clientState?.id === to && client.readyState === client.OPEN) {
          client.send(JSON.stringify({ type: "signal", from: state.id, userName: state.userName, payload }));
          break;
        }
      }
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

console.log("Signaling server running on 60764");