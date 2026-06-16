import { BadRequestException, Body, Controller, Logger, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CallsService } from './calls.service';
import { verifyCallDeclineToken } from './call-decline-token';

interface DeclineByTokenBody {
    token?: string;
}

// Endpoint công khai (xác thực bằng token ký trong push) để service worker từ chối
// cuộc gọi khi app đã đóng — lúc đó không có Bearer access token để gọi API thường.
@Controller('calls')
export class CallsPublicController {
    private readonly logger = new Logger(CallsPublicController.name);

    constructor(private readonly callsService: CallsService) { }

    @Post(':callId/decline/by-token')
    async declineByToken(
        @Param('callId', ParseIntPipe) callId: number,
        @Body() body: DeclineByTokenBody,
    ) {
        const verified = body.token ? verifyCallDeclineToken(body.token) : null;
        if (!verified || verified.callId !== callId) {
            throw new BadRequestException('Token từ chối cuộc gọi không hợp lệ hoặc đã hết hạn.');
        }

        try {
            await this.callsService.declineCall(verified.userId, callId);
        } catch (error) {
            // Cuộc gọi có thể đã kết thúc/được xử lý — coi như đã từ chối, không báo lỗi.
            this.logger.debug(`Từ chối cuộc gọi ${callId} qua token bỏ qua: ${error instanceof Error ? error.message : String(error)}`);
        }
        return { declined: true as const };
    }
}
