import { IsString, IsOptional, IsEmail, IsEnum } from 'class-validator';
import { TipoDocumento, CondicionFiscal } from '@prisma/client';

export class UpdateClientFiscalDto {
  @IsOptional()
  @IsEnum(TipoDocumento)
  tipoDocumento?: TipoDocumento;

  @IsOptional()
  @IsString()
  numeroDocumento?: string;

  @IsOptional()
  @IsEnum(CondicionFiscal)
  condicionFiscal?: CondicionFiscal;

  @IsOptional()
  @IsString()
  razonSocial?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
