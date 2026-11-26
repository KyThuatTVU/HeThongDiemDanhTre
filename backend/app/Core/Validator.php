<?php
declare(strict_types=1);

namespace App\Core;

use App\Exceptions\ValidationException;
use App\Infrastructure\Database\Connection;

final class Validator
{
    private const MESSAGES = [
        'required' => ':attribute không được để trống',
        'string' => ':attribute phải là chuỗi',
        'integer' => ':attribute phải là số nguyên',
        'numeric' => ':attribute phải là số',
        'array' => ':attribute phải là danh sách',
        'min' => ':attribute tối thiểu :param',
        'max' => ':attribute tối đa :param',
        'in' => ':attribute không hợp lệ',
        'date' => ':attribute phải có định dạng YYYY-MM-DD',
        'email' => ':attribute không đúng định dạng email',
        'boolean' => ':attribute phải là true/false',
        'unique' => ':attribute đã tồn tại',
        'exists' => ':attribute không tồn tại',
        'regex' => ':attribute không đúng định dạng',
    ];

    public static function validate(array $data, array $rules, array $labels = []): array
    {
        $errors = [];
        $clean = [];

        foreach ($rules as $field => $ruleSet) {
            $rulesForField = is_array($ruleSet) ? $ruleSet : explode('|', (string) $ruleSet);
            $value = $data[$field] ?? null;
            $isNullable = in_array('nullable', $rulesForField, true);
            $numericField = in_array('integer', $rulesForField, true) || in_array('numeric', $rulesForField, true);
            $fieldErrors = [];

            if ($isNullable && ($value === null || $value === '')) {
                continue;
            }

            foreach ($rulesForField as $rule) {
                if ($rule === '' || $rule === 'nullable') {
                    continue;
                }
                [$name, $param] = array_pad(explode(':', $rule, 2), 2, null);
                $message = self::MESSAGES[$name] ?? ':attribute không hợp lệ';
                $label = $labels[$field] ?? $field;
                $message = str_replace([':attribute', ':param'], [$label, (string) $param], $message);

                if ($name !== 'required' && ($value === null || $value === '')) {
                    continue;
                }

                $failed = match ($name) {
                    'required' => $value === null || $value === '' || (is_array($value) && count($value) === 0),
                    'string' => !is_string($value) && !is_numeric($value),
                    'integer' => !is_numeric($value) || (float) $value !== (float) (int) $value,
                    'numeric' => !is_numeric($value),
                    'array' => !is_array($value),
                    'min' => self::isNumericValue($value, $numericField) ? (float) $value < (float) $param : mb_strlen((string) $value) < (int) $param,
                    'max' => self::isNumericValue($value, $numericField) ? (float) $value > (float) $param : mb_strlen((string) $value) > (int) $param,
                    'in' => !in_array((string) $value, explode(',', (string) $param), true),
                    'date' => !self::isDate((string) $value),
                    'email' => filter_var($value, FILTER_VALIDATE_EMAIL) === false,
                    'boolean' => !in_array($value, [true, false, 0, 1, '0', '1'], true),
                    'unique' => !self::isUnique((string) $param, $value),
                    'exists' => !self::exists((string) $param, $value),
                    'regex' => @preg_match('/' . str_replace('/', '\/', (string) $param) . '/', (string) $value) !== 1,
                    default => false,
                };

                if ($failed) {
                    $fieldErrors[] = $message;
                }
            }

            if ($fieldErrors === [] && $value !== null) {
                $clean[$field] = $value;
            } elseif ($fieldErrors !== []) {
                $errors[$field] = $fieldErrors;
            }
        }

        if ($errors !== []) {
            throw new ValidationException('Dữ liệu không hợp lệ', $errors);
        }
        return $clean;
    }

    private static function isNumericValue(mixed $value, bool $numericField): bool
    {
        return is_int($value) || is_float($value) || ($numericField && is_numeric($value));
    }

    private static function isDate(string $value): bool
    {
        $date = \DateTimeImmutable::createFromFormat('Y-m-d', $value);
        return $date !== false && $date->format('Y-m-d') === $value;
    }

    private static function isUnique(string $param, mixed $value): bool
    {
        $parts = explode(',', $param);
        $table = $parts[0] ?? '';
        $column = $parts[1] ?? '';
        $exceptId = isset($parts[2]) && $parts[2] !== '' ? (int) $parts[2] : null;
        if (!preg_match('/^[a-z_][a-z0-9_]*$/', $table) || !preg_match('/^[a-z_][a-z0-9_]*$/', $column)) {
            return false;
        }
        $sql = "SELECT COUNT(*) FROM `{$table}` WHERE `{$column}` = ?";
        $params = [$value];
        if ($exceptId !== null) {
            $sql .= ' AND id <> ?';
            $params[] = $exceptId;
        }
        $statement = Connection::pdo()->prepare($sql);
        $statement->execute($params);
        return (int) $statement->fetchColumn() === 0;
    }

    private static function exists(string $param, mixed $value): bool
    {
        $parts = explode(',', $param);
        $table = $parts[0] ?? '';
        $column = $parts[1] ?? '';
        if (!preg_match('/^[a-z_][a-z0-9_]*$/', $table) || !preg_match('/^[a-z_][a-z0-9_]*$/', $column)) {
            return false;
        }
        $statement = Connection::pdo()->prepare("SELECT COUNT(*) FROM `{$table}` WHERE `{$column}` = ?");
        $statement->execute([$value]);
        return (int) $statement->fetchColumn() > 0;
    }
}
