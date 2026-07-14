/**
 * Thin SQLite wrapper using Node built-in `node:sqlite` (Node 22.13+ / 24+).
 * No native compile / Visual Studio / better-sqlite3.
 */
import { DatabaseSync } from "node:sqlite";

export type RunResult = {
  changes: number;
  lastInsertRowid: number | bigint;
};

export type Statement = {
  run: (...params: unknown[]) => RunResult;
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
};

export type PepsiDb = {
  exec: (sql: string) => void;
  prepare: (sql: string) => Statement;
  pragma: (source: string) => unknown;
  transaction: <T>(fn: () => T) => () => T;
  close: () => void;
};

function wrapStatement(stmt: {
  run: (...args: unknown[]) => { changes: number | bigint; lastInsertRowid: number | bigint };
  get: (...args: unknown[]) => unknown;
  all: (...args: unknown[]) => unknown[];
}): Statement {
  return {
    run(...params: unknown[]) {
      const r = stmt.run(...params);
      return {
        changes: Number(r.changes),
        lastInsertRowid: typeof r.lastInsertRowid === "bigint" ? Number(r.lastInsertRowid) : r.lastInsertRowid,
      };
    },
    get(...params: unknown[]) {
      return stmt.get(...params);
    },
    all(...params: unknown[]) {
      return stmt.all(...params);
    },
  };
}

export function openDatabase(filePath: string, opts?: { readonly?: boolean }): PepsiDb {
  const raw = new DatabaseSync(filePath, {
    readOnly: Boolean(opts?.readonly),
  });

  const db: PepsiDb = {
    exec(sql: string) {
      raw.exec(sql);
    },
    prepare(sql: string) {
      return wrapStatement(raw.prepare(sql) as Parameters<typeof wrapStatement>[0]);
    },
    pragma(source: string) {
      // better-sqlite3 style: pragma("journal_mode = WAL") or pragma("wal_checkpoint(FULL)")
      const s = source.trim();
      if (/^[a-z_][a-z0-9_]*$/i.test(s)) {
        return db.prepare(`PRAGMA ${s}`).get();
      }
      raw.exec(`PRAGMA ${s}`);
      return undefined;
    },
    transaction<T>(fn: () => T) {
      return () => {
        raw.exec("BEGIN");
        try {
          const out = fn();
          raw.exec("COMMIT");
          return out;
        } catch (e) {
          try {
            raw.exec("ROLLBACK");
          } catch {
            /* ignore */
          }
          throw e;
        }
      };
    },
    close() {
      raw.close();
    },
  };

  return db;
}
