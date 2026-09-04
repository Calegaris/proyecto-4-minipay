import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('AppController & Observability (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET) - debe responder Hello World!', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  describe('Correlation ID Middleware & Observability', () => {
    it('debe generar y retornar automáticamente una cabecera X-Correlation-ID en respuestas 200', async () => {
      const response = await request(app.getHttpServer()).get('/').expect(200);

      expect(response.headers).toHaveProperty('x-correlation-id');
      expect(response.headers['x-correlation-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('debe preservar y retornar la cabecera X-Correlation-ID personalizada enviada por el cliente', async () => {
      const customId = 'my-custom-client-trace-id-12345';

      const response = await request(app.getHttpServer())
        .get('/')
        .set('X-Correlation-ID', customId)
        .expect(200);

      expect(response.headers['x-correlation-id']).toBe(customId);
    });

    it('debe soportar la cabecera alternativa X-Request-ID de proxies y retornarla en X-Correlation-ID', async () => {
      const proxyRequestId = 'aws-alb-req-id-98765';

      const response = await request(app.getHttpServer())
        .get('/')
        .set('X-Request-ID', proxyRequestId)
        .expect(200);

      expect(response.headers['x-correlation-id']).toBe(proxyRequestId);
    });

    it('debe incluir correlationId en el cuerpo JSON de error de AllExceptionsFilter', async () => {
      const customId = 'error-trace-id-777';

      const response = await request(app.getHttpServer())
        .get('/non-existent-endpoint-route')
        .set('X-Correlation-ID', customId)
        .expect(404);

      expect(response.headers['x-correlation-id']).toBe(customId);
      expect(response.body).toHaveProperty('correlationId', customId);
      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body).toHaveProperty(
        'path',
        '/non-existent-endpoint-route',
      );
    });
  });
});
