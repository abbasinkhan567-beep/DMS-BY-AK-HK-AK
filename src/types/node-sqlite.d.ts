declare module "node:sqlite" {
  type SupportedValueType =
    | null
    | number
    | bigint
    | string
    | Uint8Array
    | Float64Array
    | Int32Array
    | ArrayBuffer;

  class StatementSync {
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
    expand(flag?: boolean): this;
    iterate(...params: unknown[]): IterableIterator<Record<string, unknown>>;
    sourceSQL(): string;
    columns(): Array<{ name: string; type: string }>;
  }

  class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
    sync(): void;
    pragma(value: string): unknown;
  }

  function open(path: string, options?: { readOnly?: boolean }): DatabaseSync;
}
