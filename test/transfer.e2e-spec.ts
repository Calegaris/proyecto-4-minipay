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
  let receiverToken: string;
  let thirdPartyToken: string;
  let createdTransferId: string;
  let receiverWallet: any;
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
    const receiverReg = await request(app.getHttpServer())
      .post('/auth/register')
      .send(receiverUser);
    receiverWallet = receiverReg.body.user.wallet;
    receiverToken = receiverReg.body.tokens.accessToken;

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
      expect(response.body.category).toBe('GENERAL_TRANSFER');
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

    it('debe permitir asignar una categoría de gasto explícita a la transferencia (ej. SERVICES)', async () => {
      const response = await request(app.getHttpServer())
        .post('/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientEmail: receiverUser.email,
          amount: 500,
          category: 'SERVICES',
        })
        .expect(200);

      expect(response.body.category).toBe('SERVICES');
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

    it('debe permitir transferir dinero utilizando el Alias del destinatario', async () => {
      const response = await request(app.getHttpServer())
        .post('/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientAlias: receiverWallet.alias,
          amount: 500,
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.amount).toBe('500');
    });

    it('debe permitir transferir dinero utilizando el CVU del destinatario', async () => {
      const response = await request(app.getHttpServer())
        .post('/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientCvu: receiverWallet.cvu,
          amount: 500,
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.amount).toBe('500');
    });

    it('debe rechazar transferencias que excedan el límite operativo diario con 422 Unprocessable Entity', async () => {
      const senderDbUser = await prisma.user.findUnique({
        where: { email: senderUser.email },
        include: { wallet: true },
      });

      // Ajustamos temporalmente el límite diario a $1.000 ARS
      await prisma.wallet.update({
        where: { id: senderDbUser!.wallet!.id },
        data: { dailyTransferLimit: 1000.0 },
      });

      const response = await request(app.getHttpServer())
        .post('/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientEmail: receiverUser.email,
          amount: 1500,
        })
        .expect(422);

      expect(response.body.message).toContain(
        'Límite operativo diario excedido',
      );
      expect(response.body.message).toContain('Cupo disponible restante');

      // Restaurar el límite por defecto a $100.000 ARS
      await prisma.wallet.update({
        where: { id: senderDbUser!.wallet!.id },
        data: { dailyTransferLimit: 100000.0 },
      });
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

  describe('GET /transfers (Listado Paginado)', () => {
    it('debe listar las transferencias paginadas del usuario autenticado', async () => {
      const response = await request(app.getHttpServer())
        .get('/transfers?page=1&limit=5')
        .set('Authorization', `Bearer ${senderToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        response.body.data.some((t: any) => t.id === createdTransferId),
      ).toBe(true);
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(5);
    });
  });

  describe('GET /transfers/:id/receipt (Comprobantes en PDF)', () => {
    it('el remitente debe poder descargar el comprobante bancario en PDF', async () => {
      const response = await request(app.getHttpServer())
        .get(`/transfers/${createdTransferId}/receipt`)
        .set('Authorization', `Bearer ${senderToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain(
        `comprobante-transferencia-${createdTransferId}.pdf`,
      );
      expect(Buffer.isBuffer(response.body) || response.body.length > 0).toBe(
        true,
      );
    });

    it('el destinatario debe poder descargar el mismo comprobante en PDF', async () => {
      const response = await request(app.getHttpServer())
        .get(`/transfers/${createdTransferId}/receipt`)
        .set('Authorization', `Bearer ${receiverToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('un usuario tercero debe recibir 403 Forbidden al intentar descargar el comprobante', async () => {
      await request(app.getHttpServer())
        .get(`/transfers/${createdTransferId}/receipt`)
        .set('Authorization', `Bearer ${thirdPartyToken}`)
        .expect(403);
    });

    it('debe retornar 404 Not Found si la transferencia no existe', async () => {
      await request(app.getHttpServer())
        .get('/transfers/00000000-0000-0000-0000-000000000000/receipt')
        .set('Authorization', `Bearer ${senderToken}`)
        .expect(404);
    });
  });
});
