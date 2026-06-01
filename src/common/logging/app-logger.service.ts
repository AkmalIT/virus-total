import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { getCorrelation } from './correlation.context';

type LogMeta = Record<string, unknown>;

@Injectable()
export class AppLogger implements LoggerService {
  log(message: string, context?: string, meta?: LogMeta) {
    this.write('log', message, context, meta);
  }

  event(eventType: string, message: string, context?: string, meta?: LogMeta) {
    this.write('log', message, context, {
      eventType,
      ...meta,
    });
  }

  error(message: string, trace?: string, context?: string, meta?: LogMeta) {
    this.write('error', message, context, {
      ...meta,
      ...(trace ? { trace } : {}),
    });
  }

  warn(message: string, context?: string, meta?: LogMeta) {
    this.write('warn', message, context, meta);
  }

  debug(message: string, context?: string, meta?: LogMeta) {
    this.write('debug', message, context, meta);
  }

  verbose(message: string, context?: string, meta?: LogMeta) {
    this.write('verbose', message, context, meta);
  }

  async timed<T>(
    eventType: string,
    message: string,
    fn: () => Promise<T>,
    context?: string,
    meta?: LogMeta,
  ): Promise<T> {
    const startedAt = Date.now();

    try {
      const result = await fn();

      this.write('log', message, context, {
        eventType,
        durationMs: Date.now() - startedAt,
        ...meta,
      });

      return result;
    } catch (error) {
      this.write('error', message, context, {
        eventType,
        durationMs: Date.now() - startedAt,
        ...meta,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setLogLevels?(_levels: LogLevel[]) {
    return undefined;
  }

  private write(
    level: LogLevel,
    message: string,
    context?: string,
    meta?: LogMeta,
  ) {
    const payload = {
      level,
      ...getCorrelation(),
      ...(context ? { context } : {}),
      ...(meta ?? {}),
      message,
      timestamp: new Date().toISOString(),
    };

    const serialized = JSON.stringify(payload);

    if (level === 'error') {
      console.error(serialized);
      return;
    }

    if (level === 'warn') {
      console.warn(serialized);
      return;
    }

    console.log(serialized);
  }
}
