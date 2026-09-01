import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incomingId =
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string);

    const correlationId = incomingId || crypto.randomUUID();

    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    next();
  }
}
