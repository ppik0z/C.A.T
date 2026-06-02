import { io } from "socket.io-client";
import { socketBaseUrl } from "./config/api";

export const socket = io(socketBaseUrl, {
    autoConnect: false, // Chỉ connect khi có token
    transports: ["websocket"],
});
