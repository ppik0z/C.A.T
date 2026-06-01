export interface JwtPayload {
    userId: number;
    username?: string;
    displayName?: string | null;
    iat?: number;
    exp?: number;
}
