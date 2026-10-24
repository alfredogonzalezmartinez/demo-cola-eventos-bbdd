import mysql, { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";

export type Row = RowDataPacket | ResultSetHeader;

/**
 * Fragmento SQL de confianza (p. ej. el filtro dinámico de subscribers).
 * Sólo se construye desdeinitos literales internos del bus, nunca desde input externo (docs/04).
 */
export type RawFragment = { $$raw: string };
export const raw = (sql: string): RawFragment => ({ $$raw: sql });

/**
 * Parametro JSON: se serializa como string para columnas JSON de MySQL
 * (equivalente del `tx.json(...)` de la referencia Postgres, ver docs/04).
 */
export type JsonParam = { $$json: unknown };
export const json = (value: unknown): JsonParam => ({ $$json: value });

export type TemplateFunction = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Row[]>;

/**
 * Ejecutor al estilo de la referencia (`postgres-js`):
 * - invocable como template tag: `sql`SELECT ... ${valor}``
 * - `begin(cb)` abre transacción y entrega otro executor como `tx`
 */
export type SqlExecutor = TemplateFunction & {
  begin: (callback: (tx: SqlExecutor) => Promise<void>) => Promise<void>;
};

function toSql(
  strings: TemplateStringsArray,
  values: unknown[],
): { sql: string; params: unknown[] } {
  let sql = "";
  const params: unknown[] = [];

  for (const [i, token] of strings.entries()) {
    sql += token;

    if (i === strings.length - 1) {
      break;
    }

    const value = values[i];
    const isJson = value !== null && typeof value === "object" && "$$json" in value;
    const isRaw = !isJson && typeof value === "object" && "$$raw" in value;

    if (isRaw) {
      sql += (value as RawFragment).$$raw;
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        sql += "(NULL)";
      } else {
        sql += `(${Array(value.length).fill("?").join(", ")})`;
        params.push(...value);
      }
    } else {
      sql += "?";
      params.push(isJson ? JSON.stringify(value.$$json) : value);
    }
  }

  return { sql, params };
}

function executorFor(conn: Pool | PoolConnection): SqlExecutor {
  const query = async (strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> => {
    const { sql, params } = toSql(strings, values);
    const [result] = await conn.query(sql, params);

    return result as unknown as Row[];
  };

  return Object.assign(query, {
    begin: async (callback: (tx: SqlExecutor) => Promise<void>) => {
      const client = await (conn as Pool).getConnection();

      try {
        await client.beginTransaction();
        await callback(executorFor(client));
        await client.commit();
      } catch (error) {
        await client.rollback();
        throw error;
      } finally {
        client.release();
      }
    },
  });
}

export class MysqlConnection {
  /** Tag-style executor, análogo del `connection.sql` de la referencia */
  public readonly sql: SqlExecutor;
  private readonly pool: Pool;

  constructor(dsn: string) {
    this.pool = mysql.createPool({
      uri: dsn,
      timezone: "Z", // el contenedor mysql corre en UTC (docs/03)
    });
    this.sql = executorFor(this.pool);
  }

  async end(): Promise<void> {
    await this.pool.end();
  }

  /** Análogo del truncateAll() de la referencia, sobre las tablas de la BD conectada */
  async truncateAll(): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = DATABASE()`,
    );

    await this.pool.query("SET FOREIGN_KEY_CHECKS = 0");

    for (const row of rows) {
      await this.pool.query(`TRUNCATE TABLE \`${String(row.tableName).replaceAll("`", "")}\``);
    }

    await this.pool.query("SET FOREIGN_KEY_CHECKS = 1");
  }
}
