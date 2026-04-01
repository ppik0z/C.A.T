import { Body, Controller, Get, Param, ParseIntPipe, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { RequestWithUser } from 'src/common/interfaces/request-with-user.interface';
import { MessagesService } from './messages.service';

@UseGuards(AuthGuard('jwt'))
@Controller('messages')
export class MessagesController {
    constructor(private readonly messagesService: MessagesService) { }

    @Post()
    async send(@Body() body: { conversationId: number, content: string }, @Request() req: RequestWithUser) {
        return this.messagesService.sendMessage(req.user.userId, body.conversationId, body.content);
    }

    @Get(':conversationId')
    async getHistory(@Param('conversationId', ParseIntPipe) convId: number) {
        return this.messagesService.getMessages(convId);
    }
}