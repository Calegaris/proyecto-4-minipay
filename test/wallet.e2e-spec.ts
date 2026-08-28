import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupTestUsers } from './test-utils';

describe('WalletsModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const walletUser = {
    name: 'Wallet Tester',
    email: 'wallet-e2e@example.com',
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

    await app.init();
    prisma = app.get(PrismaService);

    // Limpieza previa
    await cleanupTestUsers(prisma, [walletUser.email]);

    // Registrar y autenticar usuario para pruebas de billetera
    const regResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(walletUser);

    accessToken = regResponse.body.tokens.accessToken;
  });

  afterAll(async () => {
    // Limpieza posterior
    await cleanupTestUsers(prisma, [walletUser.email]);
    await app.close();
  });


  describe('GET /wallet', () => {
    it('debe rechazar el acceso con 401 si no se envía token de autenticación', async () => {
      await request(app.getHttpServer()).get('/wallet').expect(401);
    });

    it('debe obtener la billetera del usuario autenticado', async () => {
      const response = await request(app.getHttpServer())
        .get('/wallet')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('balance');
      expect(response.body).toHaveProperty('currency');
      expect(response.body.currency).toBe('ARS');
    });
  });

  describe('POST /wallet/deposit', () => {
    it('debe depositar dinero ficticio exitosamente y registrar la transacción', async () => {
      const depositAmount = 5000;

      const response = await request(app.getHttpServer())
        .post('/wallet/deposit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: depositAmount })
        .expect(200);

      expect(response.body).toHaveProperty('wallet');
      expect(response.body).toHaveProperty('transaction');
      expect(response.body.wallet.balance).toBe('5000');
      expect(response.body.transaction.type).toBe('DEPOSIT');
      expect(response.body.transaction.amount).toBe('5000');
    });

    it('debe rechazar un depósito con monto negativo o inválido con 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/wallet/deposit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: -100 })
        .expect(400);
    });
  });

  describe('GET /wallet/transactions', () => {
    it('debe listar las transacciones de la billetera del usuario', async () => {
      const response = await request(app.getHttpServer())
        .get('/wallet/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0]).toHaveProperty('type', 'DEPOSIT');
      expect(response.body[0]).toHaveProperty('amount', '5000');
    });
  });
});
