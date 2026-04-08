import { io } from "socket.io-client";

const URL = "http://localhost:3000"; // URL Backend NestJS

export const socket = io(URL, {
    autoConnect: false, // Chỉ connect khi có token
    transports: ["websocket"],
});