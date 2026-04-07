import { IsString, IsOptional, IsArray, ValidateNested, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceType } from '@prisma/client';

class SubscriptionDto {
  @IsEnum(ServiceType)
  tipo: ServiceType;

  @IsDateString()
  fechaAlta: string;
}

export class CreateClientDto {
  @IsString()
  nombreOriginal: string;

  @IsOptional()
  @IsString()
  codigoOriginal?: string;

  @IsOptional()
  @IsString()
  calle?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubscriptionDto)
  subscriptions: SubscriptionDto[];
}
