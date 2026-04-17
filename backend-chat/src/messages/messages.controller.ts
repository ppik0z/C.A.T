import { Body, Controller, Get, Param, ParseIntPipe, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';
import { MessagesService } from './messages.service';

@UseGuards(AuthGuard('jwt'))
@Controller('messages')
export class MessagesController {
    constructor(private readonly messagesService: MessagesService) { }

    @Post()
    async send(@Body() body: { conversationId: number, content: string, senderName: string }, @Request() req: RequestWithUser) {
        return this.messagesService.sendMessage(req.user.userId, body.conversationId, body.content, body.senderName);
    }

    @Get(':conversationId')
    async getHistory(
        @Param('conversationId', ParseIntPipe) convId: number,
        @Request() req: RequestWithUser
    ) {
        return this.messagesService.getMessages(req.user.userId, convId);
    }
}