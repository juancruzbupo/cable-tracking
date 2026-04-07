import { IsString, IsOptional } from 'class-validator';

export class CreateEquipmentDto {
  @IsString()
  tipo: string;

  @IsOptional()
  @IsString()
  marca?: string;

  @IsOptional()
  @IsString()
  modelo?: string;

  @IsOptional()
  @IsString()
  numeroSerie?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
