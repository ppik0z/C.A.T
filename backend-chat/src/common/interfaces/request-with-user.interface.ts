import { Request } from 'express';

export interface AuthenticatedUser {
    userId: number;
    username: string;
}
export interface RequestWithUser extends Request {
    user: AuthenticatedUser;
}