import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../database/drizzle.service';
import { MessagesService } from './messages.service';
import { ProfilesService } from '../profiles/profiles.service';
import { MediaUploadService } from './media-upload.service';

describe('MessagesService', () => {
  let service: MessagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: DrizzleService,
          useValue: { db: {} },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: ProfilesService,
          useValue: { getPublicSummary: jest.fn() },
        },
        {
          provide: MediaUploadService,
          useValue: { deleteUploadedFile: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('emits message.created only after the transaction commits', async () => {
    const sequence: string[] = [];
    const insert = jest.fn()
      .mockReturnValueOnce({ values: jest.fn().mockResolvedValue([{ insertId: 15 }]) })
      .mockReturnValueOnce({ values: jest.fn().mockResolvedValue(undefined) });
    const update = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    });
    const select = jest.fn()
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            for: jest.fn().mockResolvedValue([{ currentIdx: 2 }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: jest.fn().mockResolvedValue([{ userId: 7 }, { userId: 8 }]),
        }),
      });
    const db = {
      transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
        const result = await callback({ insert, select, update });
        sequence.push('commit');
        return result;
      },
    };
    const eventEmitter = {
      emit: jest.fn(() => {
        sequence.push('emit');
      }),
    };
    const profilesService = {
      getPublicSummary: jest.fn().mockResolvedValue({
        id: 7,
        username: 'sender',
        displayName: 'Sender',
        avatar: null,
      }),
    };
    const mediaUploadService = {
      deleteUploadedFile: jest.fn(),
    };
    const messageService = new MessagesService({ db } as never, eventEmitter as never, profilesService as never, mediaUploadService as never);
    jest.spyOn(messageService, 'validateMember').mockResolvedValue({ isAdmin: false });
    jest.spyOn(messageService as never, 'getSerializedMessage').mockResolvedValue({
      id: 15,
      conversationId: 9,
      conversationIndex: 3,
      senderId: 7,
      senderName: 'Sender',
      previewContent: 'Hello',
    } as never);

    await messageService.sendMessage(7, 9, 'Hello');

    expect(sequence).toEqual(['commit', 'emit']);
    expect(eventEmitter.emit).toHaveBeenCalledWith('message.created', expect.objectContaining({
      id: 15,
      conversationId: 9,
      conversationIndex: 3,
    }));
  });
});
