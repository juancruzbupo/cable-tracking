import { IsString, IsOptional, IsInt, IsIn, Min } from 'class-validator';

export class UpdateEmpresaConfigDto {
  @IsOptional()
  @IsString()
  cuit?: string;

  @IsOptional()
  @IsString()
  razonSocial?: string;

  @IsOptional()
  @IsString()
  condicionFiscal?: string;

  @IsOptional()
  @IsString()
  domicilioFiscal?: string;

  @IsOptional()
  @IsString()
  ingresosBrutos?: string;

  @IsOptional()
  @IsString()
  fechaInicioAct?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  puntoVenta?: number;

  @IsOptional()
  @IsIn(['mock', 'tusFacturas'])
  providerName?: string;

  @IsOptional()
  @IsString()
  actividadCodigo?: string;

  @IsOptional()
  @IsString()
  localidad?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  umbralCorte?: number;

  @IsOptional()
  @IsString()
  zonaDefault?: string;

  @IsOptional()
  @IsString()
  tfUsertoken?: string;

  @IsOptional()
  @IsString()
  tfApikey?: string;

  @IsOptional()
  @IsString()
  tfApitoken?: string;
}
