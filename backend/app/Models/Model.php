<?php
declare(strict_types=1);

namespace App\Models;

abstract class Model
{
    public function __construct(array $attributes = [])
    {
        foreach ($attributes as $key => $value) {
            if (property_exists($this, $key)) {
                $this->{$key} = $value;
            }
        }
    }

    public static function from(array $attributes): static
    {
        return new static($attributes);
    }

    public function toArray(): array
    {
        return get_object_vars($this);
    }

    public function __get(string $name): mixed
    {
        return property_exists($this, $name) ? $this->{$name} : null;
    }
}
