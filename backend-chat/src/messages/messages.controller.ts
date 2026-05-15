import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';
import { MediaUploadService } from './media-upload.service';
import { MessagesService, type SendMessageInput } from './messages.service';

@UseGuards(AuthGuard('jwt'))
@Controller('messages')
export class MessagesController {
    constructor(
        private readonly messagesService: MessagesService,
        private readonly mediaUploadService: MediaUploadService,
    ) { }

    @Post()
    async send(@Body() body: { conversationId: number, content?: string, senderName: string, type?: 'text' | 'gif', fileUrl?: string, clientTempId?: string }, @Request() req: RequestWithUser) {
        const input: SendMessageInput = {
            type: body.type,
            content: body.content,
            fileUrl: body.fileUrl,
            clientTempId: body.clientTempId,
        };

        return this.messagesService.sendMessage(req.user.userId, body.conversationId, body.content ?? '', body.senderName, body.clientTempId, input);
    }

    @Post('media')
    @UseInterceptors(FileInterceptor('file', {
        limits: {
            fileSize: 100 * 1024 * 1024,
        },
    }))
    async sendMedia(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: { conversationId: string; caption?: string; clientTempId?: string },
        @Request() req: RequestWithUser,
    ) {
        const conversationId = Number(body.conversationId);
        if (!Number.isInteger(conversationId) || conversationId <= 0) {
            throw new BadRequestException('conversationId không hợp lệ.');
        }

        await this.messagesService.validateMember(req.user.userId, conversationId);
        const media = await this.mediaUploadService.uploadChatFile(file, conversationId);

        return this.messagesService.createMediaMessage(req.user.userId, {
            conversationId,
            senderName: req.user.username,
            caption: body.caption,
            clientTempId: body.clientTempId,
            media,
        });
    }

    @Get(':conversationId')
    async getHistory(
        @Param('conversationId', ParseIntPipe) convId: number,
        @Request() req: RequestWithUser
    ) {
        return this.messagesService.getMessages(req.user.userId, convId);
    }
}
