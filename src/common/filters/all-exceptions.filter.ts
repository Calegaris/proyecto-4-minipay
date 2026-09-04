import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        error = exception.name;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message ?? exception.message;
        error = resObj.error ?? exception.name;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Error no controlado en ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );

      if (process.env.NODE_ENV !== 'production') {
        message = exception.message;
      }
    }

    const correlationId =
      request.correlationId ||
      (response.getHeader('X-Correlation-ID') as string) ||
      undefined;

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      correlationId,
      message,
      error,
    };

    response.status(status).json(errorResponse);
  }
}
