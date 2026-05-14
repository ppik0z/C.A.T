import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../database/drizzle.service';
import { PresenceService } from '../presence/presence.service';
import { FriendshipsService } from './friendships.service';

describe('FriendshipsService', () => {
  let service: FriendshipsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendshipsService,
        {
          provide: DrizzleService,
          useValue: { db: {} },
        },
        {
          provide: PresenceService,
          useValue: { isUserOnline: jest.fn(), getOnlineUsers: jest.fn() },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<FriendshipsService>(FriendshipsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
