import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        wallet: {
          select: {
            id: true,
            balance: true,
            currency: true,
            alias: true,
            cvu: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async updateAvatar(userId: string, avatarUrl?: string | null) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: avatarUrl ?? null },
      include: {
        wallet: {
          select: {
            id: true,
            balance: true,
            currency: true,
            alias: true,
            cvu: true,
          },
        },
      },
    });

    const { passwordHash: _passwordHash, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // 1. Validar que la contraseña actual sea correcta
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    // 2. Validar que la nueva contraseña no sea idéntica a la anterior
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente a la contraseña actual',
      );
    }

    // 3. Hashear nueva contraseña
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // 4. Actualizar contraseña y revocar todas las sesiones/refresh tokens activos
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });

      await tx.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    });

    return {
      message:
        'Contraseña actualizada exitosamente. Las sesiones activas han sido cerradas por seguridad.',
    };
  }
}
