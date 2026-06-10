import type { Request, Response } from 'express';
import { AuthCookieService } from './auth-cookie.service';

describe('AuthCookieService', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCookieSecure = process.env.AUTH_COOKIE_SECURE;
  const service = new AuthCookieService();

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.AUTH_COOKIE_SECURE = originalCookieSecure;
  });

  it('uses the secure host-only cookie in production', () => {
    process.env.NODE_ENV = 'production';
    const cookie = jest.fn();
    const response = { cookie } as unknown as Response;

    service.setRefreshToken(
      { headers: { origin: 'https://chat.dangtuankhai.id.vn' } } as Request,
      response,
      'refresh-token',
    );

    expect(cookie).toHaveBeenCalledWith(
      '__Host-chatchoi_refresh',
      'refresh-token',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
  });

  it('prefers the secure cookie when both cookie names exist', () => {
    process.env.NODE_ENV = 'production';
    const request = {
      headers: {
        cookie: 'chatchoi_refresh=development; __Host-chatchoi_refresh=production',
      },
    } as Request;

    expect(service.getRefreshToken(request)).toBe('production');
  });

  it('treats a malformed encoded cookie as missing', () => {
    process.env.NODE_ENV = 'development';
    process.env.AUTH_COOKIE_SECURE = 'false';
    const request = {
      headers: { cookie: 'chatchoi_refresh=%E0%A4%A' },
    } as Request;

    expect(service.getRefreshToken(request)).toBeNull();
  });
});
