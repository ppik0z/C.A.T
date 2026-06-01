import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from './messages.controller';
import { MediaUploadService } from './media-upload.service';
import { MessagesService } from './messages.service';

describe('MessagesController', () => {
  let controller: MessagesController;
  const sendMessage = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: MessagesService,
          useValue: { sendMessage },
        },
        {
          provide: MediaUploadService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<MessagesController>(MessagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('does not forward a client-provided sender name', async () => {
    sendMessage.mockResolvedValue({ id: 1 });

    await controller.send(
      {
        conversationId: 9,
        content: 'hello',
        clientTempId: 'temp-1',
      },
      { user: { userId: 7 } } as never,
    );

    expect(sendMessage).toHaveBeenCalledWith(
      7,
      9,
      'hello',
      'temp-1',
      {
        type: undefined,
        content: 'hello',
        fileUrl: undefined,
        clientTempId: 'temp-1',
      },
    );
  });
});
