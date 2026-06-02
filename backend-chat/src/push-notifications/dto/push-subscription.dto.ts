import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class RegisterFcmSubscriptionDto {
  @IsUUID()
  installationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token!: string;
}
