import { Controller, Get, Post, Body, UseGuards, Request, Param, ParseIntPipe } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { AuthGuard } from '@nestjs/passport';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@UseGuards(AuthGuard('jwt'))
@Controller('conversations')
export class ConversationsController {
    constructor(private readonly conversationsService: ConversationsService) { }
    n
    @Post('access/:friendId')
    async access(@Param('friendId', ParseIntPipe) friendId: number, @Request() req: RequestWithUser) {
        return this.conversationsService.getConversation(req.user.userId, friendId);
    }

    @Get()
    async getMyConvs(@Request() req: RequestWithUser) {
        return this.conversationsService.getMyConversations(req.user.userId);
    }
}