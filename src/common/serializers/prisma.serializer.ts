/* eslint-disable @typescript-eslint/no-unsafe-return */
export function serializePrisma<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === 'bigint' ? item.toString() : item,
    ),
  ) as T;
}
/* eslint-enable @typescript-eslint/no-unsafe-return */
