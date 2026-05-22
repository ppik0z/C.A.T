import { io } from "socket.io-client";
import { apiBaseUrl } from "./config/api";

export const socket = io(apiBaseUrl, {
    autoConnect: false, // Chỉ connect khi có token
    transports: ["websocket"],
});
