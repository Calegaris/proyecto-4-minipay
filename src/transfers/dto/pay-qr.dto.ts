import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class PayQrDto {
  @ApiProperty({
    example:
      'eyJhbW91bnQiOjE1MDAsInJlY2lwaWVudEN2dSI6IjAwMDAwMTIzNDU2Nzg5MDEyMzQ1NjciLCJleHBpcmVzQXQiOiIyMDI2LTA5LTAzVDIzOjAwOjAwLjAwMFoiLCJxcklkIjoiNTVmNWYxODUtZTgyYi00ZDg2LTg1MTAtNGYyNWM0MGNkZjc1Iiwic2lnbmF0dXJlIjoiNmExYjJjM2Q0ZTVmIn0=',

    description: 'Cadena Base64 del código QR a pagar',
  })
  @IsNotEmpty({ message: 'El payload del código QR es requerido' })
  @IsString({
    message: 'El payload del código QR debe ser una cadena de texto',
  })
  qrCode: string;
}
