import { isTrustedAuthOrigin } from './auth-origin.policy';

describe('auth origin policy', () => {
  it.each([
    undefined,
    'http://localhost:5173',
    'https://localhost:5173',
    'http://127.0.0.1:5173',
    'https://dangtuankhai.id.vn',
    'https://api.dangtuankhai.id.vn',
    'https://chat.dangtuankhai.id.vn',
  ])('allows trusted origin %s', (origin) => {
    expect(isTrustedAuthOrigin(origin)).toBe(true);
  });

  it.each([
    'https://example.com',
    'http://dangtuankhai.id.vn',
    'https://dangtuankhai.id.vn.example.com',
    'invalid',
  ])('rejects untrusted origin %s', (origin) => {
    expect(isTrustedAuthOrigin(origin)).toBe(false);
  });
});
