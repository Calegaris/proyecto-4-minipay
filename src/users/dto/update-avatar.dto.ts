import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUrl, ValidateIf } from 'class-validator';

export class UpdateAvatarDto {
  @ApiPropertyOptional({
    example:
      'https://res.cloudinary.com/minipay/image/upload/v12345/avatar.png',
    description:
      'URL pública segura HTTPS de la foto de perfil alojada en CDN / Cloud Storage, o null para eliminarla',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null && value !== undefined)
  @IsUrl(
    { require_protocol: true, protocols: ['https'] },
    { message: 'La URL del avatar debe utilizar el protocolo seguro HTTPS' },
  )
  avatarUrl?: string | null;
}
