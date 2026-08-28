import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupTestUsers } from './test-utils';

describe('AuthModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    name: 'E2E Tester',
    email: 'e2e-auth-test@example.com',
    password: 'Password123!',
  };

  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Habilitar ValidationPipe global idéntico a main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);

    // Limpieza previa de usuario de prueba si existiera
    await cleanupTestUsers(prisma, [testUser.email]);
  });

  afterAll(async () => {
    // Limpieza posterior
    await cleanupTestUsers(prisma, [testUser.email]);
    await app.close();
  });


  describe('POST /auth/register', () => {
    it('debe registrar un nuevo usuario con su billetera y retornar tokens', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user).toHaveProperty('wallet');
      expect(response.body.user.wallet.balance).toBe('0');
      expect(response.body.user).not.toHaveProperty('passwordHash');

      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');

      refreshToken = response.body.tokens.refreshToken;
    });

    it('debe fallar con 409 Conflict si el email ya existe', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body.message).toContain(
        'El correo electrónico ya está registrado',
      );
    });

    it('debe fallar con 400 Bad Request si la contraseña no cumple la complejidad del DTO', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Invalid User',
          email: 'invalid@example.com',
          password: '123',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /auth/login', () => {
    it('debe inicar sesión exitosamente con credenciales válidas', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');

      // Actualizamos refreshToken para las siguientes pruebas
      refreshToken = response.body.tokens.refreshToken;
    });

    it('debe fallar con 401 Unauthorized si la contraseña es incorrecta', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.message).toBe('Credenciales inválidas');
    });
  });

  describe('POST /auth/refresh', () => {
    it('debe renovar y rotar tokens exitosamente con un refreshToken válido', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.refreshToken).not.toBe(refreshToken);

      // Guardamos el nuevo token rotado para el logout
      refreshToken = response.body.refreshToken;
    });

    it('debe fallar con 401 Unauthorized si el refreshToken es inválido o malformado', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid.token.here' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('debe revocar el refreshToken exitosamente', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.message).toBe('Sesión cerrada con éxito');
    });

    it('debe rechazar el uso posterior de un refreshToken que ya fue revocado', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
