import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { correlationStore, createRequestId } from './correlation.context';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const headerValue = request.headers['x-request-id'];
    const requestId =
      typeof headerValue === 'string' && headerValue.length > 0
        ? headerValue
        : createRequestId();

    response.setHeader('x-request-id', requestId);
    correlationStore.run({ requestId }, () => next());
  }
}
