import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  getJwtModuleOptions,
} from './auth.constants';

describe('auth JWT configuration', () => {
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it('rejects a weak JWT secret', () => {
    process.env.JWT_SECRET = 'too-short';
    expect(() => getJwtModuleOptions()).toThrow('ít nhất 32 ký tự');
  });

  it('applies consistent signing and verification constraints', () => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    const options = getJwtModuleOptions();

    expect(options.signOptions?.algorithm).toBe('HS256');
    expect(options.signOptions?.audience).toBe(ACCESS_TOKEN_AUDIENCE);
    expect(options.signOptions?.issuer).toBe(ACCESS_TOKEN_ISSUER);
    expect(options.signOptions?.expiresIn).toBe(900);
    expect(options.verifyOptions?.algorithms).toEqual(['HS256']);
    expect(options.verifyOptions?.audience).toBe(ACCESS_TOKEN_AUDIENCE);
    expect(options.verifyOptions?.issuer).toBe(ACCESS_TOKEN_ISSUER);
  });
});
