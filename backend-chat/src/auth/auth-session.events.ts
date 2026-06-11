export const AUTH_SESSION_REVOKED_EVENT = 'auth.session.revoked';
export const AUTH_USER_SESSIONS_REVOKED_EVENT = 'auth.user.sessions-revoked';

export interface AuthSessionRevokedEvent {
  sessionId: string;
}

export interface AuthUserSessionsRevokedEvent {
  userId: number;
}
