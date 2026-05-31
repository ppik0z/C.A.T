import { Controller, Get, Patch, Put, Body, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { AccountService } from './account.service';
import { UpdateProfileDto, UpdateSettingsDto, UpdatePasswordDto } from './dto/account.dto';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer';

interface ReqUser {
  userId: number;
  username: string;
  displayName: string | null;
}

@Controller('account')
@UseGuards(AuthGuard('jwt'))
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('me')
  getMe(@Request() req: { user: ReqUser }) {
    return this.accountService.getMe(req.user.userId);
  }

  @Patch('profile')
  updateProfile(@Request() req: { user: ReqUser }, @Body() body: UpdateProfileDto) {
    return this.accountService.updateProfile(req.user.userId, body);
  }

  @Patch('settings')
  updateSettings(@Request() req: { user: ReqUser }, @Body() body: UpdateSettingsDto) {
    return this.accountService.updateSettings(req.user.userId, body);
  }

  @Put('avatar')
  @UseInterceptors(FileInterceptor('file'))
  updateAvatar(@Request() req: { user: ReqUser }, @UploadedFile() file: Express.Multer.File) {
    return this.accountService.updateAvatar(req.user.userId, file);
  }

  @Put('password')
  updatePassword(@Request() req: { user: ReqUser }, @Body() body: UpdatePasswordDto) {
    return this.accountService.updatePassword(req.user.userId, body);
  }
}
