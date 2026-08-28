import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, Min } from 'class-validator';

export class DepositDto {
  @ApiProperty({
    example: 5000,
    description: 'Monto en ARS a depositar en la billetera',
    minimum: 1,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número válido' },
  )
  @IsPositive({ message: 'El monto del depósito debe ser mayor a 0' })
  @Min(1, { message: 'El monto mínimo de depósito es 1' })
  amount: number;
}
