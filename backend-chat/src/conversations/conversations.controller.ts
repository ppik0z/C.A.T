import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { AuthGuard } from '@nestjs/passport';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';

interface CreateGroupBody {
    name: string;
    avatarGroup?: string | null;
    memberIds: number[];
}

interface UpdateConversationBody {
    name?: string;
    avatarGroup?: string | null;
}

interface AddMembersBody {
    memberIds: number[];
}

@UseGuards(AuthGuard('jwt'))
@Controller('conversations')
export class ConversationsController {
    constructor(private readonly conversationsService: ConversationsService) { }
    @Post('access/:friendId')
    async access(@Param('friendId', ParseIntPipe) friendId: number, @Request() req: RequestWithUser) {
        return this.conversationsService.getConversation(req.user.userId, friendId);
    }

    @Get()
    async getMyConvs(@Request() req: RequestWithUser) {
        return this.conversationsService.getMyConversations(req.user.userId);
    }

    @Post('groups')
    async createGroup(@Body() body: CreateGroupBody, @Request() req: RequestWithUser) {
        return this.conversationsService.createGroup(req.user.userId, body);
    }

    @Get(':id')
    async getDetail(@Param('id', ParseIntPipe) id: number, @Request() req: RequestWithUser) {
        return this.conversationsService.getConversationDetail(req.user.userId, id);
    }

    @Patch(':id')
    async updateConversation(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateConversationBody,
        @Request() req: RequestWithUser,
    ) {
        return this.conversationsService.updateGroup(req.user.userId, id, body);
    }

    @Post(':id/members')
    async addMembers(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: AddMembersBody,
        @Request() req: RequestWithUser,
    ) {
        return this.conversationsService.addGroupMembers(req.user.userId, id, body.memberIds);
    }

    @Delete(':id/members/:userId')
    async removeMember(
        @Param('id', ParseIntPipe) id: number,
        @Param('userId', ParseIntPipe) userId: number,
        @Request() req: RequestWithUser,
    ) {
        return this.conversationsService.removeGroupMember(req.user.userId, id, userId);
    }
}
