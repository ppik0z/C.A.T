import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { isTrustedAuthOrigin } from './auth-origin.policy';

const REFRESH_COOKIE_NAME = '__Host-chatchoi_refresh';
const DEVELOPMENT_REFRESH_COOKIE_NAME = 'chatchoi_refresh';
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
};

@Injectable()
export class AuthCookieService {
  getRefreshToken(request: Request): string | null {
    const parsedCookies = new Map<string, string>();
    const cookies = request.headers.cookie?.split(';') ?? [];
    for (const cookie of cookies) {
      const separatorIndex = cookie.indexOf('=');
      if (separatorIndex === -1) continue;
      const name = cookie.slice(0, separatorIndex).trim();
      if (!this.getCookieNames().includes(name)) continue;
      try {
        parsedCookies.set(name, decodeURIComponent(cookie.slice(separatorIndex + 1)));
      } catch {
        return null;
      }
    }

    const preferredCookieName = this.getCookieName(this.shouldUseSecureCookie(request));
    return parsedCookies.get(preferredCookieName)
      ?? this.getCookieNames().map((name) => parsedCookies.get(name)).find(Boolean)
      ?? null;
  }

  assertTrustedOrigin(request: Request) {
    const origin = request.headers.origin;
    if (!origin) return;

    if (!isTrustedAuthOrigin(origin)) {
      throw new ForbiddenException('Origin không được phép.');
    }
  }

  setRefreshToken(request: Request, response: Response, refreshToken: string) {
    const secure = this.shouldUseSecureCookie(request);
    response.cookie(this.getCookieName(secure), refreshToken, {
      ...COOKIE_OPTIONS,
      secure,
      maxAge: REFRESH_MAX_AGE_MS,
    });
  }

  clearRefreshToken(response: Response) {
    for (const cookieName of this.getCookieNames()) {
      response.clearCookie(cookieName, {
        ...COOKIE_OPTIONS,
        secure: cookieName === REFRESH_COOKIE_NAME,
      });
    }
  }

  private shouldUseSecureCookie(request: Request) {
    if (process.env.NODE_ENV === 'production') return true;
    if (process.env.AUTH_COOKIE_SECURE === 'true') return true;
    if (process.env.AUTH_COOKIE_SECURE === 'false') return false;

    const origin = request.headers.origin;
    if (!origin) return request.secure || request.headers['x-forwarded-proto'] === 'https';
    try {
      return !['localhost', '127.0.0.1'].includes(new URL(origin).hostname);
    } catch {
      return true;
    }
  }

  private getCookieName(secure: boolean) {
    return secure ? REFRESH_COOKIE_NAME : DEVELOPMENT_REFRESH_COOKIE_NAME;
  }

  private getCookieNames() {
    return [REFRESH_COOKIE_NAME, DEVELOPMENT_REFRESH_COOKIE_NAME];
  }
}
