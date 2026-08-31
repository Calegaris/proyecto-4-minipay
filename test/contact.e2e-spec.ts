import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupTestUsers } from './test-utils';


describe('ContactsModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ownerUser = {
    name: 'Owner Contact User',
    email: 'owner-contact-e2e@example.com',
    password: 'Password123!',
  };

  const contactUser1 = {
    name: 'Friend Juan',
    email: 'friend-juan-e2e@example.com',
    password: 'Password123!',
  };

  const contactUser2 = {
    name: 'Friend Maria',
    email: 'friend-maria-e2e@example.com',
    password: 'Password123!',
  };

  const thirdPartyUser = {
    name: 'Third Party User',
    email: 'third-contact-e2e@example.com',
    password: 'Password123!',
  };

  let ownerToken: string;
  let thirdPartyToken: string;
  let contact1Wallet: any;
  let contact2Wallet: any;
  let createdContactId: string;

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

    // Limpieza inicial
    await cleanupTestUsers(prisma, [
      ownerUser.email,
      contactUser1.email,
      contactUser2.email,
      thirdPartyUser.email,
    ]);

    // 1. Registrar Owner
    const ownerReg = await request(app.getHttpServer())
      .post('/auth/register')
      .send(ownerUser);
    ownerToken = ownerReg.body.tokens.accessToken;

    // 2. Registrar Contactos
    const reg1 = await request(app.getHttpServer())
      .post('/auth/register')
      .send(contactUser1);
    contact1Wallet = reg1.body.user.wallet;

    const reg2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send(contactUser2);
    contact2Wallet = reg2.body.user.wallet;

    // 3. Registrar Third Party
    const thirdReg = await request(app.getHttpServer())
      .post('/auth/register')
      .send(thirdPartyUser);
    thirdPartyToken = thirdReg.body.tokens.accessToken;
  });

  afterAll(async () => {
    await cleanupTestUsers(prisma, [
      ownerUser.email,
      contactUser1.email,
      contactUser2.email,
      thirdPartyUser.email,
    ]);
    await app.close();
  });

  describe('POST /contacts (Creación y Validaciones)', () => {
    it('debe rechazar la petición sin identificadores con 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/contacts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          aliasCustomName: 'Contacto Sin Identificador',
        })
        .expect(400);
    });

    it('debe rechazar auto-agendarse con 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/contacts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          aliasCustomName: 'Yo Mismo',
          contactEmail: ownerUser.email,
        })
        .expect(400);
    });

    it('debe rechazar agregar un usuario inexistente con 404 Not Found', async () => {
      await request(app.getHttpServer())
        .post('/contacts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          aliasCustomName: 'Fantasma',
          contactEmail: 'nonexistent-user-12345@example.com',
        })
        .expect(404);
    });

    it('debe agregar un contacto exitosamente por Email con 201 Created', async () => {
      const response = await request(app.getHttpServer())
        .post('/contacts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          aliasCustomName: 'Juan Alquiler',
          contactEmail: contactUser1.email,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.aliasCustomName).toBe('Juan Alquiler');
      expect(response.body.contactUser.email).toBe(contactUser1.email);
      expect(response.body.contactUser.wallet.alias).toBe(contact1Wallet.alias);
      expect(response.body.contactUser.wallet.cvu).toBe(contact1Wallet.cvu);
      expect(response.body.contactUser).not.toHaveProperty('passwordHash');

      createdContactId = response.body.id;
    });

    it('debe rechazar agregar un contacto duplicado con 409 Conflict', async () => {
      await request(app.getHttpServer())
        .post('/contacts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          aliasCustomName: 'Juan Repetido',
          contactEmail: contactUser1.email,
        })
        .expect(409);
    });

    it('debe agregar un segundo contacto por Alias de billetera con 201 Created', async () => {
      const response = await request(app.getHttpServer())
        .post('/contacts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          aliasCustomName: 'Maria Gimnasio',
          contactAlias: contact2Wallet.alias,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.aliasCustomName).toBe('Maria Gimnasio');
      expect(response.body.contactUser.email).toBe(contactUser2.email);
    });
  });

  describe('GET /contacts (Listado Seguro)', () => {
    it('debe listar todos los contactos agendados del usuario autenticado', async () => {
      const response = await request(app.getHttpServer())
        .get('/contacts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0]).toHaveProperty('aliasCustomName');
      expect(response.body[0]).toHaveProperty('contactUser');
      expect(response.body[0].contactUser).toHaveProperty('wallet');
      expect(response.body[0].contactUser).not.toHaveProperty('passwordHash');
    });

    it('otro usuario no debe ver los contactos del owner', async () => {
      const response = await request(app.getHttpServer())
        .get('/contacts')
        .set('Authorization', `Bearer ${thirdPartyToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('DELETE /contacts/:id (Eliminación)', () => {
    it('un tercero no debe poder eliminar el contacto de otro usuario (404 Not Found)', async () => {
      await request(app.getHttpServer())
        .delete(`/contacts/${createdContactId}`)
        .set('Authorization', `Bearer ${thirdPartyToken}`)
        .expect(404);
    });

    it('el propietario debe poder eliminar su contacto exitosamente con 200 OK', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/contacts/${createdContactId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('eliminado exitosamente');

      // Verificar que ahora solo queda 1 contacto
      const listResponse = await request(app.getHttpServer())
        .get('/contacts')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(listResponse.body.length).toBe(1);
    });
  });
});
