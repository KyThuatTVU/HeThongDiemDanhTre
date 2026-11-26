<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Infrastructure\Database\Connection;
use App\Models\Model;
use PDO;

abstract class Repository
{
    protected string $table = '';
    protected string $model = Model::class;

    protected function db(): PDO
    {
        return Connection::pdo();
    }

    protected function fetchAll(string $sql, array $params = []): array
    {
        $statement = $this->db()->prepare($sql);
        $statement->execute($params);
        return $statement->fetchAll();
    }

    protected function fetchOne(string $sql, array $params = []): ?array
    {
        $statement = $this->db()->prepare($sql);
        $statement->execute($params);
        $row = $statement->fetch();
        return is_array($row) ? $row : null;
    }

    protected function fetchValue(string $sql, array $params = []): mixed
    {
        $statement = $this->db()->prepare($sql);
        $statement->execute($params);
        return $statement->fetchColumn();
    }

    protected function execute(string $sql, array $params = []): int
    {
        $statement = $this->db()->prepare($sql);
        $statement->execute($params);
        return $statement->rowCount();
    }

    protected function insert(array $data): int
    {
        $columns = array_keys($data);
        foreach ($columns as $column) {
            if (!preg_match('/^[a-z_][a-z0-9_]*$/', (string) $column)) {
                throw new \InvalidArgumentException('Tên cột không hợp lệ: ' . $column);
            }
        }
        $placeholders = array_map(static fn ($column): string => ':' . $column, $columns);
        $sql = sprintf(
            'INSERT INTO `%s` (`%s`) VALUES (%s)',
            $this->table,
            implode('`, `', $columns),
            implode(', ', $placeholders)
        );
        $this->execute($sql, $this->bindable($data));
        return (int) $this->db()->lastInsertId();
    }

    protected function updateById(int $id, array $data): int
    {
        if ($data === []) {
            return 0;
        }
        $assignments = [];
        foreach (array_keys($data) as $column) {
            if (!preg_match('/^[a-z_][a-z0-9_]*$/', (string) $column)) {
                throw new \InvalidArgumentException('Tên cột không hợp lệ: ' . $column);
            }
            $assignments[] = sprintf('`%s` = :%s', $column, $column);
        }
        $sql = sprintf('UPDATE `%s` SET %s WHERE id = :id', $this->table, implode(', ', $assignments));
        $params = $this->bindable($data);
        $params['id'] = $id;
        return $this->execute($sql, $params);
    }

    private function bindable(array $data): array
    {
        $params = [];
        foreach ($data as $column => $value) {
            $params[':' . $column] = is_array($value) ? json_encode($value, JSON_UNESCAPED_UNICODE) : $value;
        }
        return $params;
    }

    protected function hydrate(?array $row): ?Model
    {
        if ($row === null) {
            return null;
        }
        $class = $this->model;
        return $class::from($row);
    }

    public function find(int $id): ?Model
    {
        return $this->hydrate($this->fetchOne(
            sprintf('SELECT * FROM `%s` WHERE id = ? LIMIT 1', $this->table),
            [$id]
        ));
    }
}
