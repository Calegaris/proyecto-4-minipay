import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionCategory } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateTransferDto {
  @ApiPropertyOptional({
    example: 'juan@test.com',
    description:
      'Email del destinatario (opcional si se especifica recipientAlias, recipientCvu o recipientId)',
  })
  @IsOptional()
  @IsEmail({}, { message: 'El email del destinatario no es válido' })
  recipientEmail?: string;

  @ApiPropertyOptional({
    example: 'juan.perez.123.mp',
    description: 'Alias de billetera del destinatario',
  })
  @IsOptional()
  @IsString({ message: 'El alias del destinatario debe ser un texto' })
  recipientAlias?: string;

  @ApiPropertyOptional({
    example: '0000045612345678901234',
    description: 'CVU (22 dígitos) de la billetera del destinatario',
  })
  @IsOptional()
  @IsString({ message: 'El CVU del destinatario debe ser un texto' })
  @Length(22, 22, { message: 'El CVU debe tener exactamente 22 dígitos' })
  recipientCvu?: string;

  @ApiPropertyOptional({
    example: 'b7b89710-1845-42ec-b1aa-0c46ee094a4c',
    description: 'ID de usuario del destinatario',
  })
  @IsOptional()
  @IsString({ message: 'El ID del destinatario debe ser un texto' })
  recipientId?: string;

  @ApiProperty({
    example: 2500,
    description: 'Monto en ARS a transferir al destinatario',
    minimum: 1,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número válido' },
  )
  @IsPositive({ message: 'El monto a transferir debe ser mayor a 0' })
  @Min(1, { message: 'El monto mínimo de transferencia es 1' })
  amount: number;

  @ApiPropertyOptional({
    enum: TransactionCategory,
    default: TransactionCategory.GENERAL_TRANSFER,
    example: TransactionCategory.FOOD,
    description: 'Categoría o rubro del gasto asociado a la transferencia',
  })
  @IsOptional()
  @IsEnum(TransactionCategory, {
    message:
      'La categoría debe ser una de las siguientes: SERVICES, FOOD, HOUSING, ENTERTAINMENT, GENERAL_TRANSFER, YIELD, OTHER',
  })
  category?: TransactionCategory;
}
