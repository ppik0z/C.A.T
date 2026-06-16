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
    async send(@Body() body: { conversationId: number, content?: string, type?: 'text' | 'gif', fileUrl?: string, clientTempId?: string, clientMessageId?: string, replyToMessageId?: number, mentionedUserIds?: number[], mentionEveryone?: boolean }, @Request() req: RequestWithUser) {
        const input: SendMessageInput = {
            type: body.type,
            content: body.content,
            fileUrl: body.fileUrl,
            clientTempId: body.clientTempId,
            clientMessageId: body.clientMessageId,
            replyToMessageId: body.replyToMessageId,
            mentionedUserIds: body.mentionedUserIds,
            mentionEveryone: body.mentionEveryone,
        };

        return this.messagesService.sendMessage(req.user.userId, body.conversationId, body.content ?? '', body.clientTempId, input);
    }

    @Post('media')
    @UseInterceptors(FileInterceptor('file', {
        limits: {
            fileSize: 10 * 1024 * 1024,
        },
    }))
    async sendMedia(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: { conversationId: string; caption?: string; clientTempId?: string; clientMessageId?: string; replyToMessageId?: string; mentionedUserIds?: string; mentionEveryone?: string },
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
            caption: body.caption,
            clientTempId: body.clientTempId,
            clientMessageId: body.clientMessageId,
            replyToMessageId: body.replyToMessageId ? Number(body.replyToMessageId) : undefined,
            mentionedUserIds: this.parseMentionedUserIds(body.mentionedUserIds),
            mentionEveryone: body.mentionEveryone === 'true',
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

    private parseMentionedUserIds(value: string | undefined) {
        if (!value) return undefined;
        try {
            const parsed = JSON.parse(value) as unknown;
            if (!Array.isArray(parsed)) throw new Error('invalid');
            return parsed.filter((item): item is number => Number.isInteger(item));
        } catch {
            throw new BadRequestException('mentionedUserIds không hợp lệ.');
        }
    }
}
