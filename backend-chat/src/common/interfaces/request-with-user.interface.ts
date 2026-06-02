import { Request } from 'express';
import type { Socket } from 'socket.io';

export interface AuthenticatedUser {
    userId: number;
    username: string;
    displayName: string | null;
    sessionId?: string;
}
export interface RequestWithUser extends Request {
    user: AuthenticatedUser;
}

export interface AuthenticatedSocket extends Socket {
    user: AuthenticatedUser;
}
