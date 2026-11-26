<?php
declare(strict_types=1);

namespace App\Models;

final class TuitionRecord extends Model
{
    public $id;
    public $student_id;
    public $branch_id;
    public $period_year;
    public $period_month;
    public $base_amount;
    public $present_days;
    public $absent_days;
    public $deduction_amount;
    public $final_amount;
    public $paid_amount;
    public $status;
    public $note;
    public $created_by;
    public $created_at;
    public $updated_at;
    public $student_code;
    public $student_name;
    public $class_name;
    public $branch_name;
}
