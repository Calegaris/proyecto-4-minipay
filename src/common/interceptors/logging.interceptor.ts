import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const { method, originalUrl } = req;
    const correlationId =
      req.correlationId ||
      (res.getHeader('X-Correlation-ID') as string) ||
      'N/A';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const latency = Date.now() - startTime;
          const statusCode = res.statusCode;
          const userId = (req as any).user?.id
            ? ` - User: ${(req as any).user.id}`
            : '';

          this.logger.log(
            `[${correlationId}] ${method} ${originalUrl} - ${statusCode} +${latency}ms${userId}`,
          );
        },
        error: (error: any) => {
          const latency = Date.now() - startTime;
          const statusCode =
            error instanceof HttpException ? error.getStatus() : 500;
          const errorMessage = error.message || 'Internal Server Error';

          this.logger.error(
            `[${correlationId}] ${method} ${originalUrl} - ${statusCode} +${latency}ms - Error: ${errorMessage}`,
          );
        },
      }),
    );
  }
}
