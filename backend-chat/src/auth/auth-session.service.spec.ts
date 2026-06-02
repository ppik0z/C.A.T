import { UnauthorizedException } from '@nestjs/common';
import { AuthSessionService } from './auth-session.service';

describe('AuthSessionService', () => {
  const values = jest.fn();
  const where = jest.fn();
  const limit = jest.fn();
  const set = jest.fn(() => ({ where }));
  const db = {
    insert: jest.fn(() => ({ values })),
    select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => ({ limit })) })) })),
    update: jest.fn(() => ({ set })),
  };
  const service = new AuthSessionService({ db } as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores only a hash when creating a session', async () => {
    await service.create(7, 'Browser');

    const inserted = values.mock.calls[0][0] as { refreshTokenHash: string };
    expect(inserted.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(inserted).not.toHaveProperty('refreshToken');
  });

  it('rotates the refresh secret for a valid session', async () => {
    const session = await service.create(7);
    const [id, secret] = session.refreshToken.split('.');
    const inserted = values.mock.calls[0][0] as { refreshTokenHash: string };
    limit.mockResolvedValueOnce([{
      id,
      userId: 7,
      refreshTokenHash: inserted.refreshTokenHash,
    }]);

    const rotated = await service.rotate(`${id}.${secret}`);

    expect(rotated.userId).toBe(7);
    expect(rotated.sessionId).toBe(id);
    expect(rotated.refreshToken).not.toBe(session.refreshToken);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ refreshTokenHash: expect.any(String) }));
  });

  it('rejects a malformed refresh token', async () => {
    await expect(service.rotate('invalid')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
