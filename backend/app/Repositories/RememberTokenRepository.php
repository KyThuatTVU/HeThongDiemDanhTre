<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Infrastructure\Logging\Logger;

final class RememberTokenRepository extends Repository
{
    protected string $table = 'user_remember_tokens';

    public function create(array $data): int
    {
        try {
            return $this->insert($data);
        } catch (\PDOException $exception) {
            if ($this->isMissingTable($exception)) {
                $this->logMissingTable();
                return 0;
            }
            throw $exception;
        }
    }

    public function findBySelector(string $selector): ?array
    {
        try {
            return $this->fetchOne(
                'SELECT * FROM user_remember_tokens WHERE selector = ? LIMIT 1',
                [$selector]
            );
        } catch (\PDOException $exception) {
            if ($this->isMissingTable($exception)) {
                $this->logMissingTable();
                return null;
            }
            throw $exception;
        }
    }

    public function touch(
        int $id,
        string $expiresAt,
        ?string $newTokenHash = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): void {
        $sql = 'UPDATE user_remember_tokens SET last_used_at = NOW(), expires_at = ?';
        $params = [$expiresAt];
        if ($newTokenHash !== null) {
            $sql .= ', token_hash = ?';
            $params[] = $newTokenHash;
        }
        if ($ipAddress !== null) {
            $sql .= ', ip_address = ?';
            $params[] = $ipAddress;
        }
        if ($userAgent !== null) {
            $sql .= ', user_agent = ?';
            $params[] = $userAgent;
        }
        $sql .= ' WHERE id = ?';
        $params[] = $id;
        try {
            $this->execute($sql, $params);
        } catch (\PDOException $exception) {
            if (!$this->isMissingTable($exception)) {
                throw $exception;
            }
        }
    }

    public function updateBranchBySelector(string $selector, ?int $branchId): void
    {
        try {
            $this->execute(
                'UPDATE user_remember_tokens SET branch_id = ? WHERE selector = ?',
                [$branchId, $selector]
            );
        } catch (\PDOException $exception) {
            if (!$this->isMissingTable($exception)) {
                throw $exception;
            }
        }
    }

    public function deleteBySelector(string $selector): void
    {
        try {
            $this->execute('DELETE FROM user_remember_tokens WHERE selector = ?', [$selector]);
        } catch (\PDOException $exception) {
            if (!$this->isMissingTable($exception)) {
                throw $exception;
            }
        }
    }

    public function deleteById(int $id): void
    {
        try {
            $this->execute('DELETE FROM user_remember_tokens WHERE id = ?', [$id]);
        } catch (\PDOException $exception) {
            if (!$this->isMissingTable($exception)) {
                throw $exception;
            }
        }
    }

    public function deleteAllForUser(int $userId): void
    {
        try {
            $this->execute('DELETE FROM user_remember_tokens WHERE user_id = ?', [$userId]);
        } catch (\PDOException $exception) {
            if (!$this->isMissingTable($exception)) {
                throw $exception;
            }
        }
    }

    public function pruneUserExcess(int $userId, int $keepMax): void
    {
        $keepMax = max(1, $keepMax);
        try {
            $rows = $this->fetchAll(
                'SELECT id FROM user_remember_tokens WHERE user_id = ? ORDER BY last_used_at DESC, id DESC LIMIT 100 OFFSET ' . $keepMax,
                [$userId]
            );
            foreach ($rows as $row) {
                $this->execute('DELETE FROM user_remember_tokens WHERE id = ?', [(int) $row['id']]);
            }
        } catch (\PDOException $exception) {
            if (!$this->isMissingTable($exception)) {
                throw $exception;
            }
        }
    }

    public function deleteExpired(): int
    {
        try {
            return $this->execute('DELETE FROM user_remember_tokens WHERE expires_at <= NOW()');
        } catch (\PDOException $exception) {
            if ($this->isMissingTable($exception)) {
                return 0;
            }
            throw $exception;
        }
    }

    private function isMissingTable(\PDOException $exception): bool
    {
        return $exception->getCode() === '42S02'
            || str_contains($exception->getMessage(), '1146');
    }

    private function logMissingTable(): void
    {
        Logger::warning('Missing table user_remember_tokens; run migration 011_create_remember_tokens.sql');
    }
}
