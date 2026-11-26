<?php
declare(strict_types=1);

namespace App\Models;

final class StudentClassHistory extends Model
{
    public $id;
    public $student_id;
    public $class_id;
    public $joined_at;
    public $left_at;
    public $reason;
    public $created_by;
    public $created_at;
    public $class_name;
    public $branch_id;
    public $branch_name;
}
