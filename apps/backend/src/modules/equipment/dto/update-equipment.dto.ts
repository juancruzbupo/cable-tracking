import { IsString, IsOptional, IsEnum } from 'class-validator';
import { EquipmentStatus } from '@prisma/client';

export class UpdateEquipmentDto {
  @IsOptional()
  @IsString()
  marca?: string;

  @IsOptional()
  @IsString()
  modelo?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsEnum(EquipmentStatus)
  estado?: EquipmentStatus;
}
