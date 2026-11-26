<?php
declare(strict_types=1);

namespace App\Models;

final class Branch extends Model
{
    public $id;
    public $code;
    public $name;
    public $address;
    public $phone;
    public $logo_path;
    public $status;
    public $created_at;
    public $updated_at;
}
