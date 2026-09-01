import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'lucas@test.com',
    description: 'Correo electrónico registrado',
  })
  @IsEmail({}, { message: 'El formato del email no es válido' })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  @Transform(({ value }) => value.toLowerCase().trim())
  email: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'Contraseña del usuario',
  })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password: string;
}
