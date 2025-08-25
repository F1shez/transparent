import { create } from "zustand";
import { getPageName } from "./utils";
import type { createPeer } from "./webrtc";

export interface user {
    id: string;
    userName: string;
    waitingAccept?: boolean;
    isMain?: boolean;
}

interface Store {
    roomId: string;

    myInfo: user | null;
    setMyInfo: (user: user) => void;

    ws: WebSocket | null;
    setWs: (ws: WebSocket) => void;

    peers: Map<string, ReturnType<typeof createPeer> | null>,
    remoteAudios: Map<string, HTMLAudioElement>,
    remoteVideos: Map<string, HTMLVideoElement>,

    messages: string[],
    addMessage: (message: string) => void;

    onlineUsers: user[];
    setOnlineUsers: (onlineUsers: user[]) => void;
    addUserToOnline: (user: user) => void;
    removeUserFromOnline: (userId: string) => void;
};

export const useStore = create<Store>()((set) => ({
    roomId: getPageName(),

    myInfo: null,
    setMyInfo: (user) => {
        set(() => ({
            myInfo: user
        }))
    },

    ws: null,
    setWs: (ws) => {
        set(() => ({
            ws
        }))
    },

    peers: new Map(),
    remoteAudios: new Map(),
    remoteVideos: new Map(),

    messages: [],
    addMessage: (message) => {
        set((state) => ({
            messages: [...state.messages, message],
        }));
    },

    onlineUsers: [],
    setOnlineUsers: (onlineUsers) => {
        set(() => ({
            onlineUsers,
        }));
    },
    addUserToOnline: (user) => {
        set((state) => ({
            onlineUsers: [...state.onlineUsers, user]
        }));
    },
    removeUserFromOnline: (userId) => {
        set((state) => ({
            onlineUsers: state.onlineUsers.filter(user => user.id !== userId)
        }));
    }
}));
