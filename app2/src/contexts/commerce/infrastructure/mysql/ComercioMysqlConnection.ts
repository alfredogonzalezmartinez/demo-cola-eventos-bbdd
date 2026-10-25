import { MysqlConnection } from "../../../shared/infrastructure/mysql/MysqlConnection";

/**
 * Token de DI para la conexión a la BD de dominio `comercio` (una conexión por
 * schema con su propio DSN: MYSQL_COMERCIO_URL, ver docs/07): la cola vive en
 * `eventos` y el dominio en `comercio` en el mismo servidor MySQL.
 */
export class ComercioMysqlConnection extends MysqlConnection {}
