export interface JwtPayload {
    userId: number;
    sid?: string;
    username?: string;
    displayName?: string | null;
    iat?: number;
    exp?: number;
}
