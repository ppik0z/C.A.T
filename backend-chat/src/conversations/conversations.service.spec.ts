import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../database/drizzle.service';
import { PresenceService } from '../presence/presence.service';
import { ConversationsService } from './conversations.service';
import { GroupAvatarService } from './group-avatar.service';

describe('ConversationsService', () => {
  let service: ConversationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        {
          provide: DrizzleService,
          useValue: { db: {} },
        },
        {
          provide: PresenceService,
          useValue: { isUserOnline: jest.fn() },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: GroupAvatarService,
          useValue: {
            upload: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
