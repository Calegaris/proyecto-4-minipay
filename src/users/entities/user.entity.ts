import { Exclude } from 'class-transformer';
import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';

export class UserEntity {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Identificador único del usuario (UUID)',
  })
  id: string;

  @ApiProperty({
    example: 'Lucas Dev',
    description: 'Nombre completo del usuario',
  })
  name: string;

  @ApiProperty({
    example: 'lucas@minipay.com',
    description: 'Correo electrónico del usuario',
  })
  email: string;

  @Exclude()
  @ApiHideProperty()
  passwordHash: string;

  @ApiProperty({
    example: '2026-08-28T12:00:00.000Z',
    description: 'Fecha de creación de la cuenta',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-08-28T12:00:00.000Z',
    description: 'Fecha de última actualización',
  })
  updatedAt: Date;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
