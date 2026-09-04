import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { ChangePasswordDto, UpdateAvatarDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Consultar perfil del usuario autenticado',
    description:
      'Retorna la información del usuario autenticado y los datos de su billetera sin exponer datos sensibles.',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil del usuario obtenido exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado / Token ausente o inválido',
  })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('me/avatar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar o eliminar foto de perfil (Avatar)',
    description:
      'Asigna una URL pública segura HTTPS para la foto de perfil del usuario autenticado, o null para eliminarla.',
  })
  @ApiResponse({
    status: 200,
    description: 'Foto de perfil actualizada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'URL inválida o con protocolo no seguro (se requiere HTTPS)',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado / Token ausente o inválido',
  })
  async updateAvatar(
    @CurrentUser('id') userId: string,
    @Body() updateAvatarDto: UpdateAvatarDto,
  ) {
    return this.usersService.updateAvatar(userId, updateAvatarDto.avatarUrl);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cambiar contraseña del usuario',
    description:
      'Valida la contraseña actual, establece la nueva contraseña y revoca todos los refresh tokens activos para cerrar sesiones previas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Contraseña actualizada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description:
      'La nueva contraseña no cumple los requisitos o es idéntica a la anterior',
  })
  @ApiResponse({
    status: 401,
    description: 'La contraseña actual es incorrecta o no está autorizado',
  })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(userId, changePasswordDto);
  }
}
