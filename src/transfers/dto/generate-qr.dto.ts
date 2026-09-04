import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionCategory } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GenerateQrDto {
  @ApiProperty({
    example: 1500,
    description: 'Monto en ARS a cobrar mediante el código QR',
    minimum: 1,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número válido' },
  )
  @IsPositive({ message: 'El monto debe ser mayor a 0' })
  @Min(1, { message: 'El monto mínimo de cobro es 1' })
  amount: number;

  @ApiPropertyOptional({
    example: 'Cena en restaurante',
    description: 'Concepto o descripción opcional del cobro',
  })
  @IsOptional()
  @IsString({ message: 'El concepto debe ser un texto' })
  concept?: string;

  @ApiPropertyOptional({
    enum: TransactionCategory,
    default: TransactionCategory.GENERAL_TRANSFER,
    example: TransactionCategory.FOOD,
    description: 'Categoría o rubro del gasto asociado al cobro',
  })
  @IsOptional()
  @IsEnum(TransactionCategory, {
    message:
      'La categoría debe ser una de las siguientes: SERVICES, FOOD, HOUSING, ENTERTAINMENT, GENERAL_TRANSFER, YIELD, OTHER',
  })
  category?: TransactionCategory;

  @ApiPropertyOptional({
    example: 15,
    default: 15,
    description:
      'Tiempo de validez en minutos del código QR (TTL entre 1 y 60 minutos)',
    minimum: 1,
    maximum: 60,
  })
  @IsOptional()
  @IsNumber(
    {},
    { message: 'El tiempo de expiración debe ser un número entero' },
  )
  @Min(1, { message: 'El tiempo mínimo de expiración es 1 minuto' })
  @Max(60, { message: 'El tiempo máximo de expiración es 60 minutos' })
  expiresInMinutes?: number;
}
