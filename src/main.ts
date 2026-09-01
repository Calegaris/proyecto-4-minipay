import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { SanitizeResponseInterceptor } from './common/interceptors/sanitize-response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Cabeceras HTTP de seguridad con Helmet
  app.use(helmet());

  // 2. Configuración explícita de CORS
  const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  });

  // 3. Configuración global de validación para todos los DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 4. Filtro global de excepciones y normalización de respuestas de error
  app.useGlobalFilters(new AllExceptionsFilter());

  // 5. Interceptores globales: serialización y depuración automática de datos sensibles
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector),
    new SanitizeResponseInterceptor(),
  );

  // 6. Documentación interactiva OpenAPI / Swagger

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MiniPay Wallet API')
    .setDescription(
      'API RESTful de billetera digital con soporte de transferencias atómicas, autenticación JWT con rotación de refresh tokens e idempotencia.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingrese el Access Token JWT',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
void bootstrap();
