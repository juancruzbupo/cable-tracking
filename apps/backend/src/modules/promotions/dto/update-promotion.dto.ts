import { IsString, IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class UpdatePromotionDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
