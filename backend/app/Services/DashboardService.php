<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\AttendanceRepository;
use App\Repositories\StudentRepository;

final class DashboardService
{
    private StudentRepository $students;
    private AttendanceRepository $attendance;
    private AuthorizationService $authz;

    public function __construct()
    {
        $this->students = new StudentRepository();
        $this->attendance = new AttendanceRepository();
        $this->authz = new AuthorizationService();
    }

    public function summary(int $branchId): array
    {
        $branches = $this->authz->accessibleBranches();
        $today = today();
        $compare = [];
        $overall = [
            'total_students' => 0,
            'active_students' => 0,
            'paused_students' => 0,
            'left_students' => 0,
            'present_today' => 0,
            'absent_today' => 0,
            'recorded_today' => 0,
        ];

        foreach ($branches as $branch) {
            $id = (int) $branch->id;
            $counts = $this->students->countsByStatus($id);
            $day = $this->attendance->dayCounts($id, $today);
            $row = [
                'branch_id' => $id,
                'branch_name' => $branch->name,
                'total_students' => $counts['total'],
                'active_students' => $counts['active'],
                'paused_students' => $counts['paused'],
                'left_students' => $counts['left'],
                'present_today' => $day['present'],
                'absent_today' => $day['absent'],
                'recorded_today' => $day['recorded'],
                'attendance_rate' => $this->rate($day['present'], $day['absent']),
            ];
            $compare[] = $row;
            foreach (['total_students', 'active_students', 'paused_students', 'left_students', 'present_today', 'absent_today', 'recorded_today'] as $key) {
                $overall[$key] += $row[$key];
            }
        }
        $overall['attendance_rate'] = $this->rate($overall['present_today'], $overall['absent_today']);

        $current = null;
        foreach ($compare as $row) {
            if ($row['branch_id'] === $branchId) {
                $current = $row;
                break;
            }
        }

        return [
            'current_branch_id' => $branchId,
            'current_branch' => $current,
            'branches' => $compare,
            'overall' => $overall,
            'chart' => [
                'from' => date('Y-m-d', strtotime('-6 days')),
                'to' => $today,
                'series' => $this->attendance->dailySeries($branchId),
            ],
        ];
    }

    private function rate(int $present, int $absent): ?float
    {
        $total = $present + $absent;
        return $total > 0 ? round($present * 100 / $total, 1) : null;
    }
}
