import { Test, TestingModule } from '@nestjs/testing';
import { DrizzleService } from '../database/drizzle.service';
import { PresenceService } from '../presence/presence.service';
import { ProfilesService } from './profiles.service';

describe('ProfilesService', () => {
  let service: ProfilesService;
  const profileRow = {
    id: 7,
    username: 'tester',
    displayName: 'Test User',
    avatar: 'avatar.webp',
    banner: null,
    bio: 'Hello',
    customStatus: 'Building',
  };

  beforeEach(async () => {
    const limit = jest.fn().mockResolvedValue([profileRow]);
    const where = jest.fn().mockReturnValue({ limit });
    const leftJoin = jest.fn().mockReturnValue({ where });
    const from = jest.fn().mockReturnValue({ leftJoin });
    const select = jest.fn().mockReturnValue({ from });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        {
          provide: DrizzleService,
          useValue: { db: { select } },
        },
        {
          provide: PresenceService,
          useValue: { isUserOnline: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  it('returns only public profile fields with presence', async () => {
    await expect(service.getPublicProfile(7)).resolves.toEqual({
      ...profileRow,
      presence: 'online',
    });
  });
});
