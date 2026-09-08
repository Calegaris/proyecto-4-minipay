import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function sanitize(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  // Si es un Buffer o Stream binario, devolverlo sin procesar
  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item));
  }

  if (typeof data === 'object' && !(data instanceof Date)) {
    // Si es un objeto Decimal de Prisma, convertir a número nativo
    if (typeof data.toNumber === 'function') {
      return data.toNumber();
    }

    const cleanObject: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'passwordHash' || key === 'password') {
        continue; // Excluir campo sensible de la respuesta JSON
      }
      cleanObject[key] = sanitize(value);
    }
    return cleanObject;
  }

  return data;
}

@Injectable()
export class SanitizeResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => sanitize(data)));
  }
}
