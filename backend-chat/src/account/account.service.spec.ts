import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../database/drizzle.service';
import { ProfilesService } from '../profiles/profiles.service';
import { AuthSessionService } from '../auth/auth-session.service';
import { PasswordHasherService } from '../auth/password-hasher.service';
import { AccountService } from './account.service';

describe('AccountService', () => {
  let service: AccountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        {
          provide: DrizzleService,
          useValue: {
            db: {
              query: {
                users: {
                  findFirst: jest.fn().mockResolvedValue({
                    email: 'test@example.com',
                    phone: '0123456789',
                    isEmailVerified: true,
                    createdAt: new Date('2026-01-01T00:00:00.000Z'),
                    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
                  }),
                },
                userSettings: {
                  findFirst: jest.fn().mockResolvedValue(null),
                },
              },
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
          useValue: { revokeAllForUser: jest.fn() },
        },
        {
          provide: PasswordHasherService,
          useValue: { hash: jest.fn(), verify: jest.fn() },
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
});
