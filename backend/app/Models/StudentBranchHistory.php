<?php
declare(strict_types=1);

namespace App\Models;

final class StudentBranchHistory extends Model
{
    public $id;
    public $student_id;
    public $from_branch_id;
    public $to_branch_id;
    public $moved_at;
    public $reason;
    public $performed_by;
    public $created_at;
    public $from_branch_name;
    public $to_branch_name;
}
