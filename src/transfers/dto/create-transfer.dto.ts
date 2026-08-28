import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateTransferDto {
  @ApiPropertyOptional({
    example: 'juan@test.com',
    description: 'Email del destinatario (opcional si se especifica recipientId)',
  })
  @IsOptional()
  @IsEmail({}, { message: 'El email del destinatario no es válido' })
  recipientEmail?: string;

  @ApiPropertyOptional({
    example: 'b7b89710-1845-42ec-b1aa-0c46ee094a4c',
    description: 'ID de usuario del destinatario (opcional si se especifica recipientEmail)',
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
}

