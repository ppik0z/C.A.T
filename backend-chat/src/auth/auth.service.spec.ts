import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DrizzleService } from '../database/drizzle.service';
import { AuthService } from './auth.service';
import { AuthSessionService } from './auth-session.service';
import { PasswordHasherService } from './password-hasher.service';
import { PushSubscriptionsService } from '../push-notifications/push-subscriptions.service';
import { AuthRecoveryService } from './auth-recovery.service';

describe('AuthService', () => {
  let service: AuthService;
  const where = jest.fn();
  const createSession = jest.fn();
  const verifyPassword = jest.fn();
  const signAccessToken = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const limit = jest.fn();
    where.mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DrizzleService,
          useValue: { db: { select } },
        },
        {
          provide: JwtService,
          useValue: { signAsync: signAccessToken, verifyAsync: jest.fn() },
        },
        {
          provide: AuthSessionService,
          useValue: {
            create: createSession,
            rotate: jest.fn(),
            revokeSerialized: jest.fn(),
            revokeAllForUser: jest.fn(),
          },
        },
        {
          provide: PasswordHasherService,
          useValue: { hash: jest.fn(), verify: verifyPassword },
        },
        {
          provide: PushSubscriptionsService,
          useValue: {
            revokeForSession: jest.fn(),
            revokeAllForUser: jest.fn(),
          },
        },
        {
          provide: AuthRecoveryService,
          useValue: { requestEmailVerification: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    createSession.mockResolvedValue({
      id: 'session-id',
      refreshToken: 'refresh-token',
    });
    signAccessToken.mockResolvedValue('access-token');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it.each([
    ['username', '  Test.User  '],
    ['email', '  Test.User@Example.COM  '],
  ])('logs in with a normalized %s', async (_kind, identifier) => {
    const limit = where.mock.results[0]?.value.limit as jest.Mock | undefined;
    if (limit) limit.mockResolvedValue([{ id: 42, password: 'hash' }]);
    else {
      where.mockImplementationOnce(() => ({
        limit: jest.fn().mockResolvedValue([{ id: 42, password: 'hash' }]),
      }));
    }
    verifyPassword.mockResolvedValue(true);

    const result = await service.login({
      identifier,
      password: 'valid-password',
    });

    expect(verifyPassword).toHaveBeenCalledWith('valid-password', 'hash');
    expect(createSession).toHaveBeenCalledWith(42, undefined);
    expect(result).toEqual({
      accessToken: 'access-token',
      expiresInSeconds: 900,
      refreshToken: 'refresh-token',
    });
  });
});
