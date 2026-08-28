import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateTransferDto {
  @IsOptional()
  @IsEmail({}, { message: 'El email del destinatario no es válido' })
  recipientEmail?: string;

  @IsOptional()
  @IsString({ message: 'El ID del destinatario debe ser un texto' })
  recipientId?: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número válido' },
  )
  @IsPositive({ message: 'El monto a transferir debe ser mayor a 0' })
  @Min(1, { message: 'El monto mínimo de transferencia es 1' })
  amount: number;
}
