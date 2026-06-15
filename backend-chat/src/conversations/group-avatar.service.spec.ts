import { BadRequestException } from '@nestjs/common';
import { GroupAvatarService } from './group-avatar.service';

describe('GroupAvatarService', () => {
  const service = new GroupAvatarService();

  it('rejects unsupported file types', async () => {
    const file = {
      mimetype: 'image/gif',
      size: 1024,
    } as Express.Multer.File;

    await expect(service.upload(file)).rejects.toThrow(BadRequestException);
  });

  it('rejects files larger than 5MB', async () => {
    const file = {
      mimetype: 'image/png',
      size: 5 * 1024 * 1024 + 1,
    } as Express.Multer.File;

    await expect(service.upload(file)).rejects.toThrow(BadRequestException);
  });
});
