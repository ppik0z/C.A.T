import { ForbiddenException } from '@nestjs/common';
import { AuthCookieService } from './auth-cookie.service';

describe('AuthCookieService', () => {
  const service = new AuthCookieService();

  it('accepts the configured frontend origin', () => {
    expect(() => service.assertTrustedOrigin({
      headers: { origin: 'http://localhost:5173' },
    } as never)).not.toThrow();
  });

  it('rejects an untrusted browser origin', () => {
    expect(() => service.assertTrustedOrigin({
      headers: { origin: 'https://example.invalid' },
    } as never)).toThrow(ForbiddenException);
  });
});
