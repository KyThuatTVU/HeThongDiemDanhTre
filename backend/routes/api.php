<?php
declare(strict_types=1);

use App\Controllers\Api\ActivityLogController;
use App\Controllers\Api\AttendanceController;
use App\Controllers\Api\AuthController;
use App\Controllers\Api\BranchController;
use App\Controllers\Api\ClassController;
use App\Controllers\Api\DashboardController;
use App\Controllers\Api\FileController;
use App\Controllers\Api\ProfileController;
use App\Controllers\Api\ReportController;
use App\Controllers\Api\SettingController;
use App\Controllers\Api\StaffController;
use App\Controllers\Api\StudentController;
use App\Controllers\Api\SystemController;
use App\Controllers\Api\TuitionController;
use App\Core\Router;

/** @var Router $router */

$router->get('/api/health', [SystemController::class, 'health']);
$router->get('/api/auth/csrf', [AuthController::class, 'csrf']);
$router->post('/api/auth/login', [AuthController::class, 'login'], ['csrf', 'throttle:login']);
$router->get('/api/auth/google-url', [AuthController::class, 'googleUrl']);

$router->get('/api/auth/me', [AuthController::class, 'me'], ['auth']);
$router->get('/api/auth/ping', [AuthController::class, 'ping'], ['auth']);
$router->post('/api/auth/logout', [AuthController::class, 'logout'], ['csrf', 'auth']);
$router->post('/api/auth/select-branch', [AuthController::class, 'selectBranch'], ['csrf', 'auth', 'branch']);

$router->put('/api/profile', [ProfileController::class, 'update'], ['csrf', 'auth']);
$router->put('/api/profile/password', [ProfileController::class, 'password'], ['throttle:sensitive', 'csrf', 'auth']);
$router->post('/api/profile/avatar', [ProfileController::class, 'avatar'], ['throttle:upload', 'csrf', 'auth']);

$router->get('/api/branches', [BranchController::class, 'index'], ['auth']);
$router->post('/api/branches', [BranchController::class, 'store'], ['csrf', 'auth', 'permission:branches.manage']);
$router->put('/api/branches/{id}', [BranchController::class, 'update'], ['csrf', 'auth', 'permission:branches.manage']);
$router->post('/api/branches/{id}/logo', [BranchController::class, 'logo'], ['throttle:upload', 'csrf', 'auth', 'permission:branches.manage']);

$router->get('/api/staff', [StaffController::class, 'index'], ['auth', 'branch', 'permission:staff.view']);
$router->get('/api/permissions', [StaffController::class, 'permissionCatalog'], ['auth', 'permission:staff.manage']);
$router->get('/api/staff/{id}/logins', [StaffController::class, 'logins'], ['auth', 'branch', 'permission:logs.view']);
$router->get('/api/staff/{id}', [StaffController::class, 'show'], ['auth', 'branch', 'permission:staff.view']);
$router->post('/api/staff', [StaffController::class, 'store'], ['csrf', 'auth', 'branch', 'permission:staff.manage']);
$router->put('/api/staff/{id}', [StaffController::class, 'update'], ['csrf', 'auth', 'branch', 'permission:staff.manage']);
$router->post('/api/staff/{id}/permissions', [StaffController::class, 'assignPermissions'], ['csrf', 'auth', 'branch', 'permission:staff.manage']);
$router->post('/api/staff/{id}/lock', [StaffController::class, 'lock'], ['csrf', 'auth', 'branch', 'permission:staff.manage']);
$router->post('/api/staff/{id}/unlock', [StaffController::class, 'unlock'], ['csrf', 'auth', 'branch', 'permission:staff.manage']);
$router->post('/api/staff/{id}/reset-password', [StaffController::class, 'resetPassword'], ['throttle:sensitive', 'csrf', 'auth', 'branch', 'permission:staff.manage']);
$router->post('/api/staff/{id}/branches', [StaffController::class, 'assignBranches'], ['csrf', 'auth', 'branch', 'permission:staff.manage']);
$router->post('/api/staff/{id}/avatar', [StaffController::class, 'avatar'], ['throttle:upload', 'csrf', 'auth', 'branch', 'permission:staff.manage']);

$router->get('/api/students/search', [StudentController::class, 'search'], ['auth', 'branch', 'permission:students.view']);
$router->get('/api/students', [StudentController::class, 'index'], ['auth', 'branch', 'permission:students.view']);
$router->get('/api/students/{id}', [StudentController::class, 'show'], ['auth', 'branch', 'permission:students.view']);
$router->post('/api/students', [StudentController::class, 'store'], ['csrf', 'auth', 'branch', 'permission:students.create']);
$router->put('/api/students/{id}', [StudentController::class, 'update'], ['csrf', 'auth', 'branch', 'permission:students.update']);
$router->delete('/api/students/{id}', [StudentController::class, 'destroy'], ['csrf', 'auth', 'branch', 'permission:students.delete']);
$router->post('/api/students/{id}/restore', [StudentController::class, 'restore'], ['csrf', 'auth', 'branch', 'permission:students.restore']);
$router->post('/api/students/{id}/transfer-branch', [StudentController::class, 'transferBranch'], ['csrf', 'auth', 'branch', 'permission:students.transfer']);
$router->post('/api/students/{id}/avatar', [StudentController::class, 'avatar'], ['throttle:upload', 'csrf', 'auth', 'branch', 'permission:students.update']);

$router->get('/api/classes', [ClassController::class, 'index'], ['auth', 'branch', 'permission:classes.view']);
$router->post('/api/classes/transfer', [ClassController::class, 'transfer'], ['csrf', 'auth', 'branch', 'permission:classes.assign']);
$router->get('/api/classes/{id}', [ClassController::class, 'show'], ['auth', 'branch', 'permission:classes.view']);
$router->post('/api/classes', [ClassController::class, 'store'], ['csrf', 'auth', 'branch', 'permission:classes.create']);
$router->put('/api/classes/{id}', [ClassController::class, 'update'], ['csrf', 'auth', 'branch', 'permission:classes.update']);
$router->post('/api/classes/{id}/assign', [ClassController::class, 'assign'], ['csrf', 'auth', 'branch', 'permission:classes.assign']);

$router->get('/api/attendance/board', [AttendanceController::class, 'board'], ['auth', 'branch', 'permission:attendance.view']);
$router->post('/api/attendance/save', [AttendanceController::class, 'save'], ['csrf', 'auth', 'branch', 'permission:attendance.save']);
$router->post('/api/attendance/sessions/{id}/lock', [AttendanceController::class, 'lock'], ['csrf', 'auth', 'branch', 'permission:attendance.lock']);
$router->post('/api/attendance/sessions/{id}/unlock', [AttendanceController::class, 'unlock'], ['csrf', 'auth', 'branch', 'permission:attendance.lock']);
$router->post('/api/attendance/lock-day', [AttendanceController::class, 'lockDay'], ['csrf', 'auth', 'branch', 'permission:attendance.lock']);
$router->post('/api/attendance/unlock-day', [AttendanceController::class, 'unlockDay'], ['csrf', 'auth', 'branch', 'permission:attendance.lock']);
$router->get('/api/attendance/history', [AttendanceController::class, 'history'], ['auth', 'branch', 'permission:attendance.view']);
$router->get('/api/attendance/monthly-sheet', [AttendanceController::class, 'monthlySheet'], ['auth', 'branch', 'permission:attendance.view']);

$router->get('/api/tuition', [TuitionController::class, 'index'], ['auth', 'branch', 'permission:tuition.view']);
$router->post('/api/tuition/generate', [TuitionController::class, 'generate'], ['csrf', 'auth', 'branch', 'permission:tuition.generate']);
$router->get('/api/tuition/{id}', [TuitionController::class, 'show'], ['auth', 'branch', 'permission:tuition.view']);
$router->post('/api/tuition/{id}/adjustments', [TuitionController::class, 'adjust'], ['csrf', 'auth', 'branch', 'permission:tuition.adjust']);
$router->post('/api/tuition/{id}/payments', [TuitionController::class, 'collect'], ['csrf', 'auth', 'branch', 'permission:tuition.collect']);

$router->get('/api/dashboard/summary', [DashboardController::class, 'summary'], ['auth', 'branch']);

$router->get('/api/reports/students', [ReportController::class, 'students'], ['auth', 'branch', 'permission:reports.view']);
$router->get('/api/reports/attendance', [ReportController::class, 'attendance'], ['auth', 'branch', 'permission:reports.view']);
$router->get('/api/reports/attendance-summary', [ReportController::class, 'attendanceSummary'], ['auth', 'branch', 'permission:reports.view']);
$router->get('/api/reports/tuition', [ReportController::class, 'tuition'], ['auth', 'branch', 'permission:reports.view']);
$router->get('/api/reports/movements', [ReportController::class, 'movements'], ['auth', 'branch', 'permission:reports.view']);

$router->get('/api/logs/activity', [ActivityLogController::class, 'activity'], ['auth', 'permission:logs.view']);
$router->get('/api/logs/logins', [ActivityLogController::class, 'logins'], ['auth', 'permission:logs.view']);

$router->get('/api/settings', [SettingController::class, 'index'], ['auth', 'permission:settings.manage']);
$router->put('/api/settings', [SettingController::class, 'save'], ['csrf', 'auth', 'permission:settings.manage']);

$router->get('/api/files/{module}/{filename}', [FileController::class, 'show'], ['auth']);
