<?php
declare(strict_types=1);

namespace App\Models;

final class Attendance extends Model
{
    public $id;
    public $attendance_session_id;
    public $student_id;
    public $status;
    public $note;
    public $recorded_by;
    public $recorded_at;
    public $updated_by;
    public $updated_at;
    public $student_code;
    public $full_name;
    public $class_name;
    public $session_date;
    public $slot_name;
    public $recorded_by_name;
}
