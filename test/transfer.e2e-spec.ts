import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupTestUsers } from './test-utils';

describe('TransfersModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const senderUser = {
    name: 'Sender User',
    email: 'sender-transfer-e2e@example.com',
    password: 'Password123!',
  };

  const receiverUser = {
    name: 'Receiver User',
    email: 'receiver-transfer-e2e@example.com',
    password: 'Password123!',
  };

  const thirdPartyUser = {
    name: 'Third Party User',
    email: 'thirdparty-transfer-e2e@example.com',
    password: 'Password123!',
  };

  let senderToken: string;
  let thirdPartyToken: string;
  let createdTransferId: string;
  const idempotencyKey = 'transfer-key-test-12345';

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
    await cleanupTestUsers(prisma, [
      senderUser.email,
      receiverUser.email,
      thirdPartyUser.email,
    ]);

    // 1. Registrar Sender y hacer un depósito inicial de 10.000
    const senderReg = await request(app.getHttpServer())
      .post('/auth/register')
      .send(senderUser);
    senderToken = senderReg.body.tokens.accessToken;

    await request(app.getHttpServer())
      .post('/wallet/deposit')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ amount: 10000 });

    // 2. Registrar Receiver
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(receiverUser);

    // 3. Registrar Third Party User
    const thirdPartyReg = await request(app.getHttpServer())
      .post('/auth/register')
      .send(thirdPartyUser);
    thirdPartyToken = thirdPartyReg.body.tokens.accessToken;
  });

  afterAll(async () => {
    // Limpieza posterior
    await cleanupTestUsers(prisma, [
      senderUser.email,
      receiverUser.email,
      thirdPartyUser.email,
    ]);
    await app.close();
  });


  describe('POST /transfers (Transferencias & Reglas de Negocio)', () => {
    it('debe ejecutar una transferencia válida atómicamente y actualizar ambos saldos', async () => {
      const transferAmount = 2500;

      const response = await request(app.getHttpServer())
        .post('/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          recipientEmail: receiverUser.email,
          amount: transferAmount,
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.amount).toBe('2500');
      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.idempotencyKey).toBe(idempotencyKey);

      createdTransferId = response.body.id;

      // Verificar que el saldo del remitente se redujo a 7500 (10000 - 2500)
      const senderWalletRes = await request(app.getHttpServer())
        .get('/wallet')
        .set('Authorization', `Bearer ${senderToken}`);

      expect(senderWalletRes.body.balance).toBe('7500');
    });

    it('IDEMPOTENCIA: reintentar con la misma Idempotency-Key debe devolver la transferencia previa SIN descontar saldo nuevamente', async () => {
      const response = await request(app.getHttpServer())
        .post('/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          recipientEmail: receiverUser.email,
          amount: 2500,
        })
        .expect(200);

      expect(response.body.id).toBe(createdTransferId);

      // El saldo debe permanecer intacto en 7500 (no se vuelve a cobrar)
      const senderWalletRes = await request(app.getHttpServer())
        .get('/wallet')
        .set('Authorization', `Bearer ${senderToken}`);

      expect(senderWalletRes.body.balance).toBe('7500');
    });

    it('IDEMPOTENCIA: reintentar con la misma Idempotency-Key pero datos diferentes debe fallar con 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          recipientEmail: receiverUser.email,
          amount: 9999, // Monto diferente
        })
        .expect(400);
    });

    it('debe rechazar transferencias con saldo insuficiente con 409 Conflict', async () => {
      await request(app.getHttpServer())
        .post('/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientEmail: receiverUser.email,
          amount: 50000, // Saldo disponible es 7500
        })
        .expect(409);
    });

    it('debe rechazar una auto-transferencia (mismo usuario) con 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientEmail: senderUser.email,
          amount: 500,
        })
        .expect(400);
    });

    it('debe rechazar transferencias a destinatarios inexistentes con 404 Not Found', async () => {
      await request(app.getHttpServer())
        .post('/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientEmail: 'nonexistent@example.com',
          amount: 500,
        })
        .expect(404);
    });
  });

  describe('GET /transfers/:id (Autorización)', () => {
    it('el remitente debe poder consultar el detalle de su transferencia', async () => {
      const response = await request(app.getHttpServer())
        .get(`/transfers/${createdTransferId}`)
        .set('Authorization', `Bearer ${senderToken}`)
        .expect(200);

      expect(response.body.id).toBe(createdTransferId);
    });

    it('un tercero no participante debe ser rechazado con 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .get(`/transfers/${createdTransferId}`)
        .set('Authorization', `Bearer ${thirdPartyToken}`)
        .expect(403);
    });
  });

  describe('GET /transfers (Listado)', () => {
    it('debe listar las transferencias del usuario autenticado', async () => {
      const response = await request(app.getHttpServer())
        .get('/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0].id).toBe(createdTransferId);
    });
  });
});
