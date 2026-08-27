import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { name, email, password } = registerDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    const saltRounds = Number(
      this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? 10,
    );
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Transacción atómica: Crear Usuario y su Billetera inicial
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          wallet: {
            create: {
              currency: 'ARS',
              balance: 0.0,
            },
          },
        },
        include: {
          wallet: true,
        },
      });

      return newUser;
    });

    const tokens = await this.generateAndSaveTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        wallet: user.wallet,
      },
      tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { wallet: true },
    });

    // Buenas prácticas de seguridad: mensaje genérico para evitar enumeración de usuarios
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tokens = await this.generateAndSaveTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        wallet: user.wallet,
      },
      tokens,
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    let payload: { sub: string; email: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // Buscar tokens activos y vigentes para el usuario
    const userTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    let matchedTokenRecord: (typeof userTokens)[0] | null = null;

    for (const record of userTokens) {
      const isMatch = await bcrypt.compare(refreshToken, record.tokenHash);
      if (isMatch) {
        matchedTokenRecord = record;
        break;
      }
    }

    if (!matchedTokenRecord) {
      throw new UnauthorizedException(
        'Token de actualización no reconocido o revocado',
      );
    }

    // Revocar el token usado (rotación de tokens)
    await this.prisma.refreshToken.update({
      where: { id: matchedTokenRecord.id },
      data: { revokedAt: new Date() },
    });

    // Generar un nuevo par de tokens
    const newTokens = await this.generateAndSaveTokens(
      payload.sub,
      payload.email,
    );

    return newTokens;
  }

  async logout(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    let payload: { sub: string; email: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      return { message: 'Sesión cerrada con éxito' };
    }

    const userTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        revokedAt: null,
      },
    });

    for (const record of userTokens) {
      const isMatch = await bcrypt.compare(refreshToken, record.tokenHash);
      if (isMatch) {
        await this.prisma.refreshToken.update({
          where: { id: record.id },
          data: { revokedAt: new Date() },
        });
      }
    }


    return { message: 'Sesión cerrada con éxito' };
  }

  private async generateAndSaveTokens(userId: string, email: string) {
    const payload = { sub: userId, email, jti: crypto.randomUUID() };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') ??
        '15m') as any,
    });


    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn as any,
    });

    const saltRounds = Number(
      this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? 10,
    );
    const tokenHash = await bcrypt.hash(refreshToken, saltRounds);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}




