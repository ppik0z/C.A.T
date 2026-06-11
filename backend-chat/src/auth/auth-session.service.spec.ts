/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { UnauthorizedException } from '@nestjs/common';
import { AuthSessionService } from './auth-session.service';

describe('AuthSessionService', () => {
  const values = jest.fn();
  const where = jest.fn();
  const forUpdate = jest.fn();
  const limit = jest.fn(() => ({ for: forUpdate }));
  const set = jest.fn(() => ({ where }));
  const db = {
    insert: jest.fn(() => ({ values })),
    select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => ({ limit })) })) })),
    update: jest.fn(() => ({ set })),
    transaction: jest.fn((callback: (tx: unknown) => unknown) => Promise.resolve(callback(db))),
  };
  const events = { emit: jest.fn() };
  const service = new AuthSessionService({ db } as never, events as never);

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
    forUpdate.mockResolvedValueOnce([{
      id,
      userId: 7,
      refreshTokenHash: inserted.refreshTokenHash,
      previousRefreshTokenHash: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
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

  it('revokes the session when a rotated refresh token is replayed', async () => {
    const session = await service.create(7);
    const [id] = session.refreshToken.split('.');
    const inserted = values.mock.calls[0][0] as { refreshTokenHash: string };
    forUpdate.mockResolvedValueOnce([{
      id,
      userId: 7,
      refreshTokenHash: '0'.repeat(64),
      previousRefreshTokenHash: inserted.refreshTokenHash,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    }]);

    await expect(service.rotate(session.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ revokedAt: expect.any(Date) }));
    expect(events.emit).toHaveBeenCalledWith(
      'auth.session.revoked',
      { sessionId: id },
    );
  });

  it('does not revoke a session when logout receives the wrong secret', async () => {
    const session = await service.create(7);
    const [id] = session.refreshToken.split('.');
    forUpdate.mockResolvedValueOnce([{
      id,
      refreshTokenHash: '0'.repeat(64),
      revokedAt: null,
    }]);

    await expect(service.revokeSerialized(session.refreshToken)).resolves.toBeNull();

    expect(set).not.toHaveBeenCalledWith(expect.objectContaining({ revokedAt: expect.any(Date) }));
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('does not revoke a session for a random refresh secret', async () => {
    const session = await service.create(7);
    const [id] = session.refreshToken.split('.');
    forUpdate.mockResolvedValueOnce([{
      id,
      userId: 7,
      refreshTokenHash: '0'.repeat(64),
      previousRefreshTokenHash: '1'.repeat(64),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    }]);

    await expect(service.rotate(session.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(set).not.toHaveBeenCalledWith(expect.objectContaining({ revokedAt: expect.any(Date) }));
    expect(events.emit).not.toHaveBeenCalled();
  });
});
