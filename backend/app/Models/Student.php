<?php
declare(strict_types=1);

namespace App\Models;

final class Student extends Model
{
    public $id;
    public $branch_id;
    public $current_class_id;
    public $student_code;
    public $full_name;
    public $dob;
    public $gender;
    public $study_format;
    public $monthly_fee;
    public $guardian_name;
    public $guardian_phone;
    public $address;
    public $enrollment_date;
    public $status;
    public $left_at;
    public $notes;
    public $identity_code;
    public $avatar_path;
    public $deleted_at;
    public $deleted_by;
    public $created_by;
    public $updated_by;
    public $created_at;
    public $updated_at;
    public $branch_name;
    public $class_name;
}
