-- ============================================================
-- SEED 002 - Vai trò, danh mục quyền và gán quyền mặc định
-- Chạy SAU 001_seed_branches.sql
-- Có thể tinh chỉnh lại quyền từng vai trò ở giai đoạn 4.
-- ============================================================

INSERT INTO `roles` (`role_key`, `name`, `description`) VALUES
('super_admin',      'Super Admin',            'Toàn quyền hệ thống, quản lý cả hai cơ sở'),
('branch_manager',   'Quản lý cơ sở',          'Quản lý dữ liệu cơ sở được giao'),
('attendance_staff', 'Nhân viên điểm danh',    'Thực hiện điểm danh và xem danh sách trẻ'),
('profile_staff',    'Nhân viên hồ sơ',        'Quản lý hồ sơ theo quyền được cấp');

INSERT INTO `permissions` (`permission_key`, `module`, `name`) VALUES
('students.view',     'students',   'Xem hồ sơ học viên'),
('students.create',   'students',   'Thêm học viên'),
('students.update',   'students',   'Sửa hồ sơ học viên'),
('students.delete',   'students',   'Xoá mềm hồ sơ học viên'),
('students.restore',  'students',   'Khôi phục hồ sơ học viên'),
('students.import',   'students',   'Import học viên từ Excel'),
('students.export',   'students',   'Export danh sách học viên'),
('students.transfer', 'students',   'Chuyển học viên giữa hai cơ sở'),
('classes.view',      'classes',    'Xem lớp học'),
('classes.create',    'classes',    'Thêm lớp học'),
('classes.update',    'classes',    'Sửa / ngừng hoạt động lớp'),
('classes.assign',    'classes',    'Gán / chuyển lớp cho học viên'),
('attendance.view',   'attendance', 'Xem điểm danh và lịch sử điểm danh'),
('attendance.save',   'attendance', 'Thực hiện điểm danh'),
('attendance.edit',   'attendance', 'Chỉnh sửa điểm danh đã ghi'),
('attendance.lock',   'attendance', 'Khoá / mở khoá sổ điểm danh'),
('tuition.view',      'tuition',    'Xem học phí'),
('tuition.generate',  'tuition',    'Tạo bảng học phí kỳ tháng'),
('tuition.adjust',    'tuition',    'Nhập giảm trừ học phí'),
('tuition.collect',   'tuition',    'Thu học phí'),
('tuition.export',    'tuition',    'Xuất bảng học phí'),
('staff.view',        'staff',      'Xem danh sách nhân viên'),
('staff.manage',      'staff',      'Quản lý nhân viên và tài khoản'),
('branches.view',     'branches',   'Xem cơ sở'),
('branches.manage',   'branches',   'Quản lý cơ sở'),
('reports.view',      'reports',    'Xem báo cáo'),
('reports.export',    'reports',    'Xuất báo cáo Excel / PDF'),
('logs.view',         'logs',       'Xem nhật ký hoạt động'),
('settings.manage',   'settings',   'Quản lý cấu hình hệ thống');

-- Super Admin: toàn bộ quyền
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`role_key` = 'super_admin';

-- Quản lý cơ sở: quản lý dữ liệu trong cơ sở được giao
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `roles` r
JOIN `permissions` p ON p.`permission_key` IN (
  'students.view', 'students.create', 'students.update', 'students.delete',
  'students.restore', 'students.import', 'students.export', 'students.transfer',
  'classes.view', 'classes.create', 'classes.update', 'classes.assign',
  'attendance.view', 'attendance.save', 'attendance.edit', 'attendance.lock',
  'tuition.view', 'tuition.generate', 'tuition.adjust', 'tuition.collect', 'tuition.export',
  'reports.view', 'reports.export', 'logs.view', 'staff.view', 'branches.view'
)
WHERE r.`role_key` = 'branch_manager';

-- Nhân viên điểm danh: điểm danh và xem danh sách
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `roles` r
JOIN `permissions` p ON p.`permission_key` IN (
  'students.view', 'classes.view', 'attendance.view', 'attendance.save'
)
WHERE r.`role_key` = 'attendance_staff';

-- Nhân viên hồ sơ: quản lý hồ sơ học viên
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `roles` r
JOIN `permissions` p ON p.`permission_key` IN (
  'students.view', 'students.create', 'students.update',
  'students.import', 'students.export', 'classes.view'
)
WHERE r.`role_key` = 'profile_staff';
