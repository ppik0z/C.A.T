import { BadRequestException, Injectable } from '@nestjs/common';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

const MAX_GROUP_AVATAR_BYTES = 5 * 1024 * 1024;
const SUPPORTED_GROUP_AVATAR_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export interface UploadedGroupAvatar {
  url: string;
  publicId: string;
}

@Injectable()
export class GroupAvatarService {
  constructor() {
    cloudinary.config({ secure: true });
  }

  async upload(file: Express.Multer.File): Promise<UploadedGroupAvatar> {
    this.validate(file);

    const result = await new Promise<UploadApiResponse>(
      (resolveUpload, rejectUpload) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'chat/groups',
            resource_type: 'image',
            format: 'webp',
            transformation: [
              {
                width: 512,
                height: 512,
                crop: 'fill',
                gravity: 'auto',
                quality: 'auto',
              },
            ],
          },
          (error, uploadResult) => {
            if (error || !uploadResult) {
              rejectUpload(
                new Error(error?.message || 'Không thể tải ảnh nhóm lên.'),
              );
              return;
            }
            resolveUpload(uploadResult);
          },
        );

        Readable.from(file.buffer).pipe(uploadStream);
      },
    );

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }

  async remove(publicId: string | null | undefined) {
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true,
    });
  }

  private validate(file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Vui lòng chọn ảnh đại diện nhóm.');
    if (!SUPPORTED_GROUP_AVATAR_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Ảnh nhóm chỉ hỗ trợ JPEG, PNG hoặc WebP.');
    }
    if (file.size > MAX_GROUP_AVATAR_BYTES) {
      throw new BadRequestException('Ảnh nhóm không được vượt quá 5MB.');
    }
  }
}
