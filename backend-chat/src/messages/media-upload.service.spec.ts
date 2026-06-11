import { v2 as cloudinary } from 'cloudinary';
import { MediaUploadService } from './media-upload.service';

describe('MediaUploadService', () => {
    let service: MediaUploadService;

    beforeEach(() => {
        cloudinary.config({
            cloud_name: 'test-cloud',
            api_key: 'test-key',
            api_secret: 'test-secret',
            secure: true,
        });
        service = new MediaUploadService();
    });

    it('normalizes video duration to a positive whole second', () => {
        const normalizeDuration = (
            service as unknown as {
                normalizeDuration(duration: number | undefined): number | null;
            }
        ).normalizeDuration.bind(service);

        expect(normalizeDuration(4.01)).toBe(5);
        expect(normalizeDuration(0)).toBeNull();
        expect(normalizeDuration(undefined)).toBeNull();
    });

    it('builds a secure Cloudinary poster URL for videos', () => {
        const thumbnailUrl = (
            service as unknown as {
                buildVideoThumbnailUrl(publicId: string): string;
            }
        ).buildVideoThumbnailUrl('chat/20/video-message');

        expect(thumbnailUrl).toContain('https://');
        expect(thumbnailUrl).toContain('/video/upload/');
        expect(thumbnailUrl).toContain('chat/20/video-message.jpg');
    });
});
