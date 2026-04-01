import { IsOptional, IsEnum, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ClientStatus } from '@prisma/client';

export class FindClientsDto {
  @IsOptional()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(ClientStatus)
  estado?: ClientStatus;

  @IsOptional()
  @IsEnum(['AL_DIA', '1_MES', '2_MESES', 'MAS_2_MESES'])
  debtStatus?: 'AL_DIA' | '1_MES' | '2_MESES' | 'MAS_2_MESES';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
