import { BadRequestException, Injectable } from '@nestjs/common';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

export type ChatMessageType = 'image' | 'video' | 'document';

export interface UploadedMedia {
    type: ChatMessageType;
    fileUrl: string;
    filePublicId: string;
    fileResourceType: string;
    fileName: string;
    fileMimeType: string;
    fileSizeBytes: number;
    fileFormat: string | null;
    fileWidth: number | null;
    fileHeight: number | null;
    fileThumbnailUrl: string | null;
    fileDurationSeconds: number | null;
}

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const DOCUMENT_MIME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
]);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

@Injectable()
export class MediaUploadService {
    constructor() {
        cloudinary.config({ secure: true });
    }

    async uploadChatFile(file: Express.Multer.File, conversationId: number): Promise<UploadedMedia> {
        if (!file) {
            throw new BadRequestException('Vui lòng chọn file để gửi.');
        }

        const type = this.resolveMessageType(file.mimetype);
        this.assertFileSize(file, type);

        const result = await this.uploadBuffer(file, conversationId);
        const isVideo = type === 'video';

        return {
            type,
            fileUrl: result.secure_url,
            filePublicId: result.public_id,
            fileResourceType: result.resource_type,
            fileName: file.originalname,
            fileMimeType: file.mimetype,
            fileSizeBytes: result.bytes ?? file.size,
            fileFormat: result.format ?? null,
            fileWidth: result.width ?? null,
            fileHeight: result.height ?? null,
            fileThumbnailUrl: isVideo ? this.buildVideoThumbnailUrl(result.public_id) : null,
            fileDurationSeconds: isVideo ? this.normalizeDuration(result.duration) : null,
        };
    }

    async deleteUploadedFile(publicId: string, resourceType: string) {
        await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType || 'image',
            invalidate: true,
        });
    }

    private resolveMessageType(mimeType: string): ChatMessageType {
        if (IMAGE_MIME_TYPES.has(mimeType)) return 'image';
        if (VIDEO_MIME_TYPES.has(mimeType)) return 'video';
        if (DOCUMENT_MIME_TYPES.has(mimeType)) return 'document';

        throw new BadRequestException('Định dạng file không được hỗ trợ.');
    }

    private assertFileSize(file: Express.Multer.File, type: ChatMessageType) {
        const maxBytes = type === 'image'
            ? MAX_IMAGE_BYTES
            : type === 'video'
                ? MAX_VIDEO_BYTES
                : MAX_DOCUMENT_BYTES;

        if (file.size > maxBytes) {
            throw new BadRequestException('File vượt quá dung lượng cho phép.');
        }
    }

    private uploadBuffer(file: Express.Multer.File, conversationId: number): Promise<UploadApiResponse> {
        return new Promise((resolveUpload, rejectUpload) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `chat/${conversationId}`,
                    resource_type: 'auto',
                    use_filename: true,
                    unique_filename: true,
                },
                (error, result) => {
                    if (error || !result) {
                        rejectUpload(error ?? new Error('Không thể upload file.'));
                        return;
                    }

                    resolveUpload(result);
                },
            );

            Readable.from(file.buffer).pipe(uploadStream);
        });
    }

    private buildVideoThumbnailUrl(publicId: string) {
        return cloudinary.url(publicId, {
            resource_type: 'video',
            secure: true,
            format: 'jpg',
            transformation: [
                {
                    start_offset: 0,
                    width: 1280,
                    crop: 'limit',
                    quality: 'auto',
                },
            ],
        });
    }

    private normalizeDuration(duration: number | undefined) {
        if (!Number.isFinite(duration) || !duration || duration < 0) return null;
        return Math.max(1, Math.ceil(duration));
    }
}
