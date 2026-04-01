import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class FindClientDetailDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  docPage?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  docLimit?: number = 20;
}
