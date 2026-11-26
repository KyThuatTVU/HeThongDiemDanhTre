<?php
declare(strict_types=1);

namespace App\Models;

final class SchoolClass extends Model
{
    public $id;
    public $branch_id;
    public $name;
    public $note;
    public $status;
    public $created_by;
    public $created_at;
    public $updated_at;
    public $branch_name;
    public $student_count;
}
