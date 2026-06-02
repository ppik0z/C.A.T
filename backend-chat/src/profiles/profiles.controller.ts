import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProfilesService } from './profiles.service';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(':userId/profile')
  getPublicProfile(@Param('userId', ParseIntPipe) userId: number) {
    return this.profilesService.getPublicProfile(userId);
  }
}
