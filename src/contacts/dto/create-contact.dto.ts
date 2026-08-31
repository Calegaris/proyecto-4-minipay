import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateContactDto {
  @ApiProperty({
    example: 'Lucas Alquiler',
    description: 'Nombre personalizado visible en la agenda de contactos',
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'El nombre personalizado del contacto es obligatorio' })
  @IsString({ message: 'El nombre personalizado debe ser un texto' })
  @MaxLength(50, { message: 'El nombre personalizado no puede superar los 50 caracteres' })
  aliasCustomName: string;

  @ApiPropertyOptional({
    example: 'lucas@minipay.com',
    description: 'Email del contacto a agendar (al menos uno entre email, alias o cvu es requerido)',
  })
  @IsOptional()
  @IsEmail({}, { message: 'El email del contacto no es válido' })
  contactEmail?: string;

  @ApiPropertyOptional({
    example: 'lucas.dev.mp',
    description: 'Alias de billetera del contacto a agendar',
  })
  @IsOptional()
  @IsString({ message: 'El alias del contacto debe ser un texto' })
  contactAlias?: string;

  @ApiPropertyOptional({
    example: '0000045600000000000001',
    description: 'CVU (22 dígitos) de la billetera del contacto a agendar',
  })
  @IsOptional()
  @IsString({ message: 'El CVU del contacto debe ser un texto' })
  @Length(22, 22, { message: 'El CVU debe tener exactamente 22 dígitos' })
  contactCvu?: string;
}
