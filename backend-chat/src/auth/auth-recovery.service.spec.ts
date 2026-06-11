import { DrizzleService } from '../database/drizzle.service';
import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import type { EmailSender } from '../email/email-sender';
import { PushSubscriptionsService } from '../push-notifications/push-subscriptions.service';
import { AuthActionTokenService } from './auth-action-token.service';
import { AuthRecoveryService } from './auth-recovery.service';
import { AuthSessionService } from './auth-session.service';
import { PasswordHasherService } from './password-hasher.service';

const createDrizzleMock = (user: unknown) => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn().mockResolvedValue(user ? [user] : []),
        })),
      })),
    })),
  },
});

describe('AuthRecoveryService', () => {
  const actionTokens = {
    wasIssuedRecently: jest.fn().mockResolvedValue(false),
    hasReachedIssueLimit: jest.fn().mockResolvedValue(false),
    issue: jest.fn().mockResolvedValue({
      id: '8a845e9d-10ab-4c16-b8a7-0fc60e313514',
      rawToken: 'A'.repeat(43),
    }),
    discard: jest.fn().mockResolvedValue(undefined),
    consumeEmailVerification: jest.fn(),
    consumePasswordReset: jest.fn(),
  };
  const passwordHasher = { hash: jest.fn().mockResolvedValue('password-hash') };
  const sessions = { revokeAllForUser: jest.fn() };
  const pushSubscriptions = { revokeAllForUser: jest.fn() };
  const emailSender = { send: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PUBLIC_APP_URL = 'https://chat.example.com';
  });

  const createService = (user: unknown) =>
    new AuthRecoveryService(
      createDrizzleMock(user) as unknown as DrizzleService,
      actionTokens as unknown as AuthActionTokenService,
      passwordHasher as unknown as PasswordHasherService,
      sessions as unknown as AuthSessionService,
      pushSubscriptions as unknown as PushSubscriptionsService,
      emailSender as EmailSender,
    );

  it('does not send for an unknown email', async () => {
    await createService(null).requestPasswordReset('missing@example.com');

    expect(actionTokens.issue).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it('issues a reset link only for a verified email', async () => {
    await createService({
      id: 7,
      email: 'user@example.com',
      isEmailVerified: true,
    }).requestPasswordReset('USER@example.com');

    expect(actionTokens.issue).toHaveBeenCalledWith(
      7,
      'user@example.com',
      'reset_password',
      15 * 60 * 1000,
    );
    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        html: expect.stringContaining(
          'https://chat.example.com/reset-password?token=',
        ),
      }),
    );
  });

  it('rate limits repeated verification emails per account', async () => {
    actionTokens.wasIssuedRecently.mockResolvedValueOnce(true);

    await expect(
      createService({
        email: 'user@example.com',
        isEmailVerified: false,
      }).requestEmailVerification(7),
    ).rejects.toMatchObject<HttpException>({
      status: 429,
    });

    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it('discards the token when verification delivery fails', async () => {
    emailSender.send.mockRejectedValueOnce(new Error('provider unavailable'));

    await expect(
      createService({
        email: 'user@example.com',
        isEmailVerified: false,
      }).requestEmailVerification(7),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(actionTokens.discard).toHaveBeenCalledWith(
      '8a845e9d-10ab-4c16-b8a7-0fc60e313514',
    );
  });

  it('changes the password and revokes every active session', async () => {
    actionTokens.consumePasswordReset.mockResolvedValueOnce({
      userId: 7,
      email: 'user@example.com',
    });

    await createService(null).resetPassword('A'.repeat(43), 'new-password');

    expect(passwordHasher.hash).toHaveBeenCalledWith('new-password');
    expect(actionTokens.consumePasswordReset).toHaveBeenCalledWith(
      'A'.repeat(43),
      'password-hash',
    );
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(7);
    expect(pushSubscriptions.revokeAllForUser).toHaveBeenCalledWith(7);
  });
});
