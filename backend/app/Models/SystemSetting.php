<?php
declare(strict_types=1);

namespace App\Models;

final class SystemSetting extends Model
{
    public $id;
    public $setting_key;
    public $setting_value;
    public $setting_group;
    public $description;
    public $updated_by;
    public $created_at;
    public $updated_at;
}
