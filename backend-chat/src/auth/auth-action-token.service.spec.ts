import { BadRequestException } from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { AuthActionTokenService } from './auth-action-token.service';
import { AUTH_ACTION_PURPOSE } from './auth-action-token.types';

describe('AuthActionTokenService', () => {
  it('stores only a hash when issuing a token', async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    const transaction = jest.fn((callback: (tx: unknown) => unknown) =>
      callback({
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn().mockResolvedValue(undefined),
          })),
        })),
        insert: jest.fn(() => ({ values })),
      }),
    );
    const service = new AuthActionTokenService({
      db: { transaction },
    } as unknown as DrizzleService);

    const result = await service.issue(
      7,
      'User@Example.com',
      AUTH_ACTION_PURPOSE.RESET_PASSWORD,
      15 * 60 * 1000,
    );
    const inserted = values.mock.calls[0][0] as {
      tokenHash: string;
      targetEmail: string;
    };

    expect(result.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(inserted.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(inserted.tokenHash).not.toBe(result.rawToken);
    expect(inserted.targetEmail).toBe('user@example.com');
  });

  it('rejects malformed tokens before querying the database', async () => {
    const transaction = jest.fn();
    const service = new AuthActionTokenService({
      db: { transaction },
    } as unknown as DrizzleService);

    await expect(
      service.consumeEmailVerification('invalid'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('discards a token that could not be delivered', async () => {
    const where = jest.fn().mockResolvedValue(undefined);
    const service = new AuthActionTokenService({
      db: {
        delete: jest.fn(() => ({
          where,
        })),
      },
    } as unknown as DrizzleService);

    await service.discard('8a845e9d-10ab-4c16-b8a7-0fc60e313514');

    expect(where).toHaveBeenCalled();
  });
});
