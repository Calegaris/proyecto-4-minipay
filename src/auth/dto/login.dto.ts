import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
    @IsEmail({}, { message: 'El formato del email no es válido' })
    @IsNotEmpty({ message: 'El email es obligatorio' })
    @Transform(({ value }) => value.toLowerCase().trim())
    email: string;

    @IsString({ message: 'La contraseña debe ser una cadena de texto' })
    @IsNotEmpty({ message: 'La contraseña es obligatoria' })
    password: string;
}