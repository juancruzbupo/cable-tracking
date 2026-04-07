import { IsString, IsOptional, IsNumber, IsEnum, IsDateString } from 'class-validator';
import { PromoType, PromoScope } from '@prisma/client';

export class CreatePromotionDto {
  @IsString()
  nombre: string;

  @IsEnum(PromoType)
  tipo: PromoType;

  @IsNumber()
  valor: number;

  @IsEnum(PromoScope)
  scope: PromoScope;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  planId?: string;
}
