import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export type CorrelationContext = {
  requestId?: string;
  submissionId?: string;
  jobId?: string;
};

export const correlationStore = new AsyncLocalStorage<CorrelationContext>();

export function getCorrelation(): CorrelationContext {
  return correlationStore.getStore() ?? {};
}

export function runWithCorrelation<T>(
  context: CorrelationContext,
  callback: () => T,
): T {
  return correlationStore.run(
    {
      ...getCorrelation(),
      ...context,
    },
    callback,
  );
}

export function createRequestId() {
  return `req_${randomUUID()}`;
}
