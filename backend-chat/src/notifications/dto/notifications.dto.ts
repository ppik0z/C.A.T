import { IsArray, IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListNotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  beforeId?: number;
}

export class MarkReadDto {
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  ids?: number[];

  @IsOptional()
  @IsBoolean()
  all?: boolean;
}
