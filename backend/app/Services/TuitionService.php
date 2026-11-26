<?php
declare(strict_types=1);

namespace App\Services;

use App\Exceptions\HttpException;
use App\Infrastructure\Database\Connection;
use App\Models\TuitionRecord;
use App\Repositories\AttendanceRepository;
use App\Repositories\StudentRepository;
use App\Repositories\TuitionRepository;

final class TuitionService
{
    private TuitionRepository $tuition;
    private StudentRepository $students;
    private AttendanceRepository $attendance;
    private ActivityLogService $logs;

    public function __construct()
    {
        $this->tuition = new TuitionRepository();
        $this->students = new StudentRepository();
        $this->attendance = new AttendanceRepository();
        $this->logs = new ActivityLogService();
    }

    public function board(array $filters, int $page, int $perPage): array
    {
        $result = $this->tuition->board($filters, $page, $perPage);
        return [
            'items' => array_map(fn (TuitionRecord $record): array => $this->payload($record), $result['items']),
            'total' => $result['total'],
            'totals' => $result['totals'],
        ];
    }

    public function generate(int $branchId, int $year, int $month, int $actorId): array
    {
        [$dateFrom, $dateTo] = $this->periodRange($year, $month);
        $existing = $this->tuition->existingStudentIds($branchId, $year, $month);
        $students = $this->students->activeForTuition($branchId);
        $created = 0;

        Connection::transaction(function () use ($students, $existing, $branchId, $year, $month, $dateFrom, $dateTo, $actorId, &$created): void {
            foreach ($students as $student) {
                $studentId = (int) $student['id'];
                if (in_array($studentId, $existing, true)) {
                    continue;
                }
                $counts = $this->attendance->statusCountsForStudent($studentId, $dateFrom, $dateTo);
                $baseAmount = (float) $student['monthly_fee'];
                $this->tuition->create([
                    'student_id' => $studentId,
                    'branch_id' => $branchId,
                    'period_year' => $year,
                    'period_month' => $month,
                    'base_amount' => $baseAmount,
                    'present_days' => $counts['present_total'],
                    'absent_days' => $counts['absent_total'],
                    'deduction_amount' => 0,
                    'final_amount' => $baseAmount,
                    'paid_amount' => 0,
                    'status' => 'unpaid',
                    'created_by' => $actorId,
                ]);
                $created++;
            }
        });

        $this->logs->record(
            'generate',
            'tuition',
            null,
            null,
            'Tạo bảng học phí kỳ ' . $month . '/' . $year . ' cơ sở #' . $branchId . ' (' . $created . ' hồ sơ)'
        );
        return ['created' => $created, 'skipped' => count($existing)];
    }

    public function detail(int $recordId): array
    {
        $record = $this->tuition->findDetail($recordId);
        if ($record === null) {
            throw new HttpException(404, 'Không tìm thấy phiếu học phí');
        }
        (new AuthorizationService())->assertBranch((int) $record->branch_id);
        [$dateFrom, $dateTo] = $this->periodRange((int) $record->period_year, (int) $record->period_month);
        return [
            'record' => $this->payload($record),
            'attendance' => $this->attendance->statusCountsForStudent((int) $record->student_id, $dateFrom, $dateTo),
            'adjustments' => $this->tuition->adjustments($recordId),
            'payments' => $this->tuition->payments($recordId),
        ];
    }

    public function addAdjustment(int $recordId, float $amount, string $reason, int $actorId): array
    {
        $record = $this->tuition->findDetail($recordId);
        if ($record === null) {
            throw new HttpException(404, 'Không tìm thấy phiếu học phí');
        }
        (new AuthorizationService())->assertBranch((int) $record->branch_id);
        if ($amount <= 0) {
            throw new HttpException(422, 'Số tiền giảm trừ phải lớn hơn 0');
        }
        $totalDeduction = $this->tuition->sumAdjustments($recordId) + $amount;
        $baseAmount = (float) $record->base_amount;
        if ($totalDeduction > $baseAmount) {
            throw new HttpException(422, 'Tổng giảm trừ vượt quá học phí thoả thuận (' . format_money($baseAmount) . ')');
        }
        $finalAmount = $baseAmount - $totalDeduction;
        $paidAmount = (float) $record->paid_amount;

        Connection::transaction(function () use ($recordId, $amount, $reason, $totalDeduction, $finalAmount, $paidAmount, $actorId): void {
            $this->tuition->addAdjustment($recordId, $amount, $reason, $actorId);
            $this->tuition->update($recordId, [
                'deduction_amount' => $totalDeduction,
                'final_amount' => $finalAmount,
                'status' => $this->statusFor($paidAmount, $finalAmount),
            ]);
        });

        $this->logs->record('adjust', 'tuition', 'tuition_record', $recordId, 'Giảm trừ ' . format_money($amount) . ': ' . $reason);
        return $this->detail($recordId);
    }

    public function collect(int $recordId, float $amount, string $paidOn, string $method, ?string $note, int $actorId): array
    {
        $record = $this->tuition->findDetail($recordId);
        if ($record === null) {
            throw new HttpException(404, 'Không tìm thấy phiếu học phí');
        }
        (new AuthorizationService())->assertBranch((int) $record->branch_id);
        if ($amount <= 0) {
            throw new HttpException(422, 'Số tiền thu phải lớn hơn 0');
        }
        $remaining = (float) $record->final_amount - (float) $record->paid_amount;
        if ($amount > $remaining + 0.01) {
            throw new HttpException(422, 'Số tiền thu vượt quá số còn phải thu (' . format_money($remaining) . ')');
        }
        $newPaid = (float) $record->paid_amount + $amount;
        $finalAmount = (float) $record->final_amount;

        Connection::transaction(function () use ($recordId, $amount, $paidOn, $method, $note, $newPaid, $finalAmount, $actorId): void {
            $this->tuition->addPayment($recordId, $amount, $paidOn, $method, $note, $actorId);
            $this->tuition->update($recordId, [
                'paid_amount' => $newPaid,
                'status' => $this->statusFor($newPaid, $finalAmount),
            ]);
        });

        $this->logs->record('collect', 'tuition', 'tuition_record', $recordId, 'Thu học phí ' . format_money($amount) . ' ngày ' . $paidOn);
        return $this->detail($recordId);
    }

    private function statusFor(float $paid, float $final): string
    {
        if ($paid <= 0) {
            return 'unpaid';
        }
        if ($paid + 0.01 >= $final) {
            return 'paid';
        }
        return 'partial';
    }

    private function periodRange(int $year, int $month): array
    {
        $dateFrom = sprintf('%04d-%02d-01', $year, $month);
        $dateTo = date('Y-m-t', strtotime($dateFrom));
        return [$dateFrom, $dateTo];
    }

    private function payload(TuitionRecord $record): array
    {
        return [
            'id' => (int) $record->id,
            'student_id' => (int) $record->student_id,
            'student_code' => $record->student_code,
            'student_name' => $record->student_name,
            'class_name' => $record->class_name,
            'branch_id' => (int) $record->branch_id,
            'branch_name' => $record->branch_name,
            'period_year' => (int) $record->period_year,
            'period_month' => (int) $record->period_month,
            'base_amount' => (float) $record->base_amount,
            'present_days' => (int) $record->present_days,
            'absent_days' => (int) $record->absent_days,
            'deduction_amount' => (float) $record->deduction_amount,
            'final_amount' => (float) $record->final_amount,
            'paid_amount' => (float) $record->paid_amount,
            'remaining_amount' => (float) $record->final_amount - (float) $record->paid_amount,
            'status' => $record->status,
            'note' => $record->note,
            'updated_at' => $record->updated_at,
        ];
    }
}
