<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\Persistence;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\DriverManager;

/**
 * Wrapper mínimo sobre Doctrine DBAL (sen ORM), equivalente del
 * `MysqlConnection` (app2) sobre mysql2. La clase no es final para poder
 * mockearla en los tests del bus (ver MysqlDoctrineEventBus).
 */
class DoctrineConnection
{
    private Connection $connection;

    private ?\DateTimeZone $utc = null;

    public function __construct(string $dsn)
    {

        // DSN `mysql://user:pass@host:port/db` estilo app2; DBAL 4 no infiere
        // el driver desde el scheme, así que se mapea a params explícitos.
        $parts = parse_url($dsn) ?: [];
        $host = $parts['host'] ?? 'localhost';
        // PDO trata el host `localhost` como unix socket: todo va por TCP
        $host = $host === 'localhost' ? '127.0.0.1' : $host;

        $this->connection = DriverManager::getConnection([
            'driver' => 'pdo_mysql',
            'host' => $host,
            'port' => (int) ($parts['port'] ?? 3306),
            'user' => isset($parts['user']) ? urldecode($parts['user']) : '',
            'password' => isset($parts['pass']) ? urldecode($parts['pass']) : '',
            'dbname' => isset($parts['path']) ? ltrim($parts['path'], '/') : null,
            'charset' => 'utf8mb4',
        ]);
    }

    /** @return list<array<string, mixed>> */
    public function fetchAll(string $sql, array $params = []): array
    {
        return $this->connection->fetchAllAssociative($sql, $params);
    }

    /** @param array<string, mixed> $data */
    public function insert(string $table, array $data): void
    {
        $this->connection->insert($table, $data);
    }

    /** @param array<string, mixed> $data */
    public function update(string $table, array $data, array $criteria): void
    {
        $this->connection->update($table, $data, $criteria);
    }

    /**
     * @param array<string, mixed> $criteria
     */
    public function delete(string $table, array $criteria): void
    {
        $this->connection->delete($table, $criteria);
    }

    /** SQL crudo con placeholders `?` (p. ej. el `INSERT IGNORE` del sync-routing) */
    public function execute(string $sql, array $params = []): int
    {
        return $this->connection->executeStatement($sql, $params);
    }

    /** @param callable(DoctrineConnection): mixed $fn */
    public function transactional(callable $fn): mixed
    {
        return $this->connection->transactional(function (Connection $dbal) use ($fn): mixed {
            return $fn($this);
        });
    }

    /**
     * TIMESTAMP(6) conserva la precisión de microsegundos (docs/04): los
     * timestamps viajan ya en UTC (TZ del contenedor, docs/03-07).
     */
    public function formatTimestamp(\DateTimeImmutable $datetime): string
    {
        return $datetime->setTimezone($this->utc ??= new \DateTimeZone('UTC'))
            ->format('Y-m-d H:i:s.u');
    }

    public function close(): void
    {
        $this->connection->close();
    }
}
