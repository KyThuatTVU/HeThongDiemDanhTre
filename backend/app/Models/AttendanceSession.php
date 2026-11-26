<?php
declare(strict_types=1);

namespace App\Models;

final class AttendanceSession extends Model
{
    public $id;
    public $branch_id;
    public $class_id;
    public $session_date;
    public $slot_name;
    public $is_locked;
    public $locked_at;
    public $locked_by;
    public $created_by;
    public $created_at;
    public $updated_at;
    public $class_name;
    public $branch_name;
}
