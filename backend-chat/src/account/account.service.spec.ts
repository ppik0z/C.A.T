import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../database/drizzle.service';
import { ProfilesService } from '../profiles/profiles.service';
import { AuthSessionService } from '../auth/auth-session.service';
import { PasswordHasherService } from '../auth/password-hasher.service';
import { AccountService } from './account.service';
import { PushSubscriptionsService } from '../push-notifications/push-subscriptions.service';

describe('AccountService', () => {
  let service: AccountService;
  let findUser: jest.Mock;
  let updateSet: jest.Mock;
  let updateWhere: jest.Mock;
  let verifyPassword: jest.Mock;
  let hashPassword: jest.Mock;
  let revokeSessions: jest.Mock;
  let revokePushSubscriptions: jest.Mock;

  beforeEach(async () => {
    findUser = jest.fn().mockResolvedValue({
      email: 'test@example.com',
      phone: '0123456789',
      isEmailVerified: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    updateWhere = jest.fn().mockResolvedValue(undefined);
    updateSet = jest.fn().mockReturnValue({
      where: updateWhere,
    });
    verifyPassword = jest.fn();
    hashPassword = jest.fn();
    revokeSessions = jest.fn();
    revokePushSubscriptions = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        {
          provide: DrizzleService,
          useValue: {
            db: {
              query: {
                users: {
                  findFirst: findUser,
                },
                userSettings: {
                  findFirst: jest.fn().mockResolvedValue(null),
                },
              },
              update: jest.fn().mockReturnValue({
                set: updateSet,
              }),
            },
          },
        },
        {
          provide: ProfilesService,
          useValue: {
            getPublicProfile: jest.fn().mockResolvedValue({
              id: 7,
              username: 'tester',
              displayName: 'Test User',
              avatar: null,
              banner: null,
              bio: 'Hello',
              customStatus: 'Building',
              presence: 'online',
            }),
          },
        },
        {
          provide: AuthSessionService,
          useValue: { revokeAllForUser: revokeSessions },
        },
        {
          provide: PasswordHasherService,
          useValue: { hash: hashPassword, verify: verifyPassword },
        },
        {
          provide: PushSubscriptionsService,
          useValue: { revokeAllForUser: revokePushSubscriptions },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AccountService>(AccountService);
  });

  it('returns a flattened private account contract', async () => {
    await expect(service.getMe(7)).resolves.toMatchObject({
      id: 7,
      username: 'tester',
      displayName: 'Test User',
      email: 'test@example.com',
      phone: '0123456789',
      isEmailVerified: true,
      bio: 'Hello',
      customStatus: 'Building',
      presence: 'online',
      settings: null,
    });
  });

  it('normalizes a changed email and requires verification again', async () => {
    findUser
      .mockResolvedValueOnce({ email: 'old@example.com' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        email: 'new@example.com',
        phone: '0123456789',
        isEmailVerified: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      });

    await expect(
      service.updateProfile(7, { email: '  New@Example.COM  ' }),
    ).resolves.toMatchObject({
      email: 'new@example.com',
      isEmailVerified: false,
    });

    expect(updateSet).toHaveBeenCalledWith({
      email: 'new@example.com',
      isEmailVerified: false,
    });
  });

  it('rejects an email owned by another account', async () => {
    findUser
      .mockResolvedValueOnce({ email: 'old@example.com' })
      .mockResolvedValueOnce({ id: 9 });

    await expect(
      service.updateProfile(7, { email: 'used@example.com' }),
    ).rejects.toThrow('Email đã được sử dụng.');

    expect(updateSet).not.toHaveBeenCalled();
  });

  it('changes the password and revokes every active session', async () => {
    findUser.mockResolvedValue({ id: 7, password: 'current-hash' });
    verifyPassword.mockResolvedValue(true);
    hashPassword.mockResolvedValue('new-hash');

    await expect(
      service.updatePassword(7, {
        currentPassword: 'current-password',
        newPassword: 'new-password',
      }),
    ).resolves.toEqual({
      message: 'Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại.',
    });

    expect(verifyPassword).toHaveBeenCalledWith(
      'current-password',
      'current-hash',
    );
    expect(hashPassword).toHaveBeenCalledWith('new-password');
    expect(updateWhere).toHaveBeenCalled();
    expect(revokeSessions).toHaveBeenCalledWith(7);
    expect(revokePushSubscriptions).toHaveBeenCalledWith(7);
  });

  it('rejects an incorrect current password without changing sessions', async () => {
    findUser.mockResolvedValue({ id: 7, password: 'current-hash' });
    verifyPassword.mockResolvedValue(false);

    await expect(
      service.updatePassword(7, {
        currentPassword: 'wrong-password',
        newPassword: 'new-password',
      }),
    ).rejects.toThrow('Mật khẩu hiện tại không chính xác.');

    expect(hashPassword).not.toHaveBeenCalled();
    expect(updateWhere).not.toHaveBeenCalled();
    expect(revokeSessions).not.toHaveBeenCalled();
    expect(revokePushSubscriptions).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password', async () => {
    findUser.mockResolvedValue({ id: 7, password: 'current-hash' });
    verifyPassword.mockResolvedValue(true);

    await expect(
      service.updatePassword(7, {
        currentPassword: 'same-password',
        newPassword: 'same-password',
      }),
    ).rejects.toThrow('Mật khẩu mới phải khác mật khẩu hiện tại.');

    expect(hashPassword).not.toHaveBeenCalled();
    expect(updateWhere).not.toHaveBeenCalled();
    expect(revokeSessions).not.toHaveBeenCalled();
    expect(revokePushSubscriptions).not.toHaveBeenCalled();
  });
});
