import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { AuthGuard } from '@nestjs/passport';
import type { RequestWithUser } from '../common/interfaces/request-with-user.interface';
import { FileInterceptor } from '@nestjs/platform-express';

interface CreateGroupBody {
    name: string;
    description?: string | null;
    memberIds: number[] | string;
}

interface UpdateConversationBody {
    name?: string;
    description?: string | null;
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
    @UseInterceptors(FileInterceptor('avatar', {
        limits: { fileSize: 5 * 1024 * 1024 },
    }))
    async createGroup(
        @Body() body: CreateGroupBody,
        @UploadedFile() avatar: Express.Multer.File | undefined,
        @Request() req: RequestWithUser,
    ) {
        return this.conversationsService.createGroup(
            req.user.userId,
            {
                name: body.name,
                description: body.description,
                memberIds: this.parseMemberIds(body.memberIds),
            },
            avatar,
        );
    }

    @Get(':id')
    async getDetail(@Param('id', ParseIntPipe) id: number, @Request() req: RequestWithUser) {
        return this.conversationsService.getConversationDetail(req.user.userId, id);
    }

    @Patch(':id')
    @UseInterceptors(FileInterceptor('avatar', {
        limits: { fileSize: 5 * 1024 * 1024 },
    }))
    async updateConversation(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateConversationBody,
        @UploadedFile() avatar: Express.Multer.File | undefined,
        @Request() req: RequestWithUser,
    ) {
        return this.conversationsService.updateGroup(req.user.userId, id, body, avatar);
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

    private parseMemberIds(value: number[] | string) {
        if (Array.isArray(value)) return value;
        try {
            const parsed = JSON.parse(value) as unknown;
            if (!Array.isArray(parsed)) throw new Error('invalid');
            return parsed.filter((item): item is number => Number.isInteger(item));
        } catch {
            throw new BadRequestException('Danh sách thành viên không hợp lệ.');
        }
    }
}
