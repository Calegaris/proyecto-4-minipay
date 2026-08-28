import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupTestUsers } from './test-utils';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('UsersModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    name: 'Profile Tester',
    email: 'user-profile-e2e@example.com',
    password: 'Password123!',
  };

  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
    prisma = app.get(PrismaService);

    // Limpieza previa
    await cleanupTestUsers(prisma, [testUser.email]);

    // Registrar y autenticar usuario
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser);

    accessToken = regRes.body.tokens.accessToken;
  });

  afterAll(async () => {
    // Limpieza posterior
    await cleanupTestUsers(prisma, [testUser.email]);
    await app.close();
  });

  describe('GET /users/me', () => {
    it('debe rechazar con 401 si no se envía token', async () => {
      await request(app.getHttpServer()).get('/users/me').expect(401);
    });

    it('debe retornar el perfil del usuario autenticado sin passwordHash', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(testUser.email);
      expect(response.body.name).toBe(testUser.name);
      expect(response.body).toHaveProperty('wallet');
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('passwordHash');
    });
  });

  describe('POST /users/change-password', () => {
    it('debe rechazar con 401 si la contraseña actual es incorrecta', async () => {
      await request(app.getHttpServer())
        .post('/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword999!',
          newPassword: 'BrandNewPassword123!',
        })
        .expect(401);
    });

    it('debe rechazar con 400 si la nueva contraseña es idéntica a la actual', async () => {
      await request(app.getHttpServer())
        .post('/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: testUser.password,
        })
        .expect(400);
    });

    it('debe cambiar la contraseña exitosamente y permitir login con la nueva', async () => {
      const newPassword = 'NewSecurePassword456!';

      const changeRes = await request(app.getHttpServer())
        .post('/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword,
        })
        .expect(200);

      expect(changeRes.body).toHaveProperty('message');

      // Intentar login con password viejo (debe fallar con 401)
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(401);

      // Login con nuevo password (debe tener éxito con 200)
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: newPassword,
        })
        .expect(200);

      expect(loginRes.body).toHaveProperty('tokens');
    });
  });
});
