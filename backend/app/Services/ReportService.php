<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\AttendanceRepository;
use App\Repositories\StudentRepository;
use App\Repositories\TuitionRepository;

final class ReportService
{
    private StudentRepository $students;
    private AttendanceRepository $attendance;
    private TuitionRepository $tuition;

    public function __construct()
    {
        $this->students = new StudentRepository();
        $this->attendance = new AttendanceRepository();
        $this->tuition = new TuitionRepository();
    }

    public function students(array $filters): array
    {
        $filters['include_deleted'] = $filters['include_deleted'] ?? false;
        return array_map(fn (array $row): array => [
            'student_code' => $row['student_code'],
            'full_name' => $row['full_name'],
            'dob' => $row['dob'],
            'gender' => $row['gender'],
            'study_format' => $row['study_format'],
            'branch_name' => $row['branch_name'],
            'class_name' => $row['class_name'],
            'monthly_fee' => (float) $row['monthly_fee'],
            'guardian_name' => $row['guardian_name'],
            'guardian_phone' => $row['guardian_phone'],
            'address' => $row['address'],
            'enrollment_date' => $row['enrollment_date'],
            'status' => $row['status'],
            'left_at' => $row['left_at'] ?? null,
            'notes' => $row['notes'],
        ], $this->students->allForReport($filters));
    }

    public function attendance(array $filters): array
    {
        $result = $this->attendance->history($filters, 1, 1000);
        return $result['items'];
    }

    public function attendanceSummary(int $branchId, int $year, int $month, ?int $classId = null): array
    {
        [$dateFrom, $dateTo] = $this->periodRange($year, $month);
        return $this->attendance->monthSummaryByClass($branchId, $dateFrom, $dateTo, $classId);
    }

    public function tuition(array $filters): array
    {
        return array_map(static fn (array $row): array => [
            'student_code' => $row['student_code'],
            'student_name' => $row['student_name'],
            'class_name' => $row['class_name'],
            'branch_name' => $row['branch_name'],
            'period_year' => (int) $row['period_year'],
            'period_month' => (int) $row['period_month'],
            'base_amount' => (float) $row['base_amount'],
            'present_days' => (int) $row['present_days'],
            'absent_days' => (int) $row['absent_days'],
            'deduction_amount' => (float) $row['deduction_amount'],
            'final_amount' => (float) $row['final_amount'],
            'paid_amount' => (float) $row['paid_amount'],
            'status' => $row['status'],
        ], $this->tuition->allForReport($filters));
    }

    public function movements(?int $branchId, int $year): array
    {
        $newByMonth = $this->students->newEnrollmentsByMonth($branchId, $year);
        $leftByMonth = $this->students->leftByMonth($branchId, $year);
        $months = [];
        for ($month = 1; $month <= 12; $month++) {
            $months[] = [
                'month' => $month,
                'new_students' => (int) ($newByMonth[$month] ?? $newByMonth[(string) $month] ?? 0),
                'left_students' => (int) ($leftByMonth[$month] ?? $leftByMonth[(string) $month] ?? 0),
            ];
        }
        return ['year' => $year, 'branch_id' => $branchId, 'months' => $months];
    }

    private function periodRange(int $year, int $month): array
    {
        $dateFrom = sprintf('%04d-%02d-01', $year, $month);
        return [$dateFrom, date('Y-m-t', strtotime($dateFrom))];
    }
}
