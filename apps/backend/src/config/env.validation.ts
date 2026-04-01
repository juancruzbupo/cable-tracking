import { plainToInstance } from 'class-transformer';
import { IsString, IsOptional, IsIn, MinLength, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  DATABASE_URL: string;

  @IsString()
  @MinLength(8)
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL: string = 'http://localhost:5174';

  @IsOptional()
  PORT: number = 3000;

  @IsIn(['development', 'production', 'test'])
  @IsOptional()
  NODE_ENV: string = 'development';
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Config validation error: ${errors.toString()}`);
  }
  return validated;
}
