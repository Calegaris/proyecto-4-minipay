import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'Password123!',
    description: 'Contraseña actual del usuario',
  })
  @IsString({ message: 'La contraseña actual debe ser un texto' })
  @IsNotEmpty({ message: 'La contraseña actual es requerida' })
  currentPassword: string;

  @ApiProperty({
    example: 'NewSecretPass999!',
    description:
      'Nueva contraseña (mínimo 8 caracteres con mayúscula, minúscula, número y carácter especial)',
  })
  @IsString({ message: 'La nueva contraseña debe ser un texto' })
  @MinLength(8, {
    message: 'La nueva contraseña debe tener al menos 8 caracteres',
  })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'La nueva contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial',
    },
  )
  newPassword: string;
}
