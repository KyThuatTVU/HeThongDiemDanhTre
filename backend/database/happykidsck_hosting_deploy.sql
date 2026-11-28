-- ============================================================
-- HappyKidsCK — Hosting Full Deploy (1-Click Import / Re-Import)
-- Xuất lúc: 2026-11-28 08:46:46 (UTC+7)
-- Dùng cho lần đầu đưa lên host hoặc khi muốn đồng bộ đè toàn bộ (tự DROP/CREATE từng bảng, không cần xóa DB).
-- Tương thích: MariaDB 10.2+ & MySQL 5.7/8.0+ (ByetHost/cPanel)
-- Lưu ý: KHÔNG có CREATE DATABASE / USE / LOCK TABLES.
--        Chỉ cần chọn sẵn database trên phpMyAdmin -> Import -> Go.
-- ============================================================

SET NAMES utf8mb4;
SET TIME_ZONE = '+07:00';
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- ------------------------------------------------------------
-- Bảng `branches`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `branches`;
CREATE TABLE `branches` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL COMMENT 'Mã cơ sở, vd: TN, CL',
  `name` varchar(120) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `logo_path` varchar(255) DEFAULT NULL COMMENT 'Đường dẫn logo upload từ máy (lưu ngoài webroot), KHÔNG lưu URL',
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_branches_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cơ sở của trung tâm';

INSERT INTO `branches` (`id`, `code`, `name`, `address`, `phone`, `logo_path`, `status`, `created_at`, `updated_at`) VALUES
(1, 'TN', 'Cơ sở Tân Nhựt', NULL, NULL, NULL, 'active', '2026-11-26 14:36:46', '2026-11-26 14:36:46'),
(2, 'CL', 'Cơ sở Càng Long', NULL, NULL, NULL, 'active', '2026-11-26 14:36:46', '2026-11-26 14:36:46');

-- ------------------------------------------------------------
-- Bảng `roles`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` tinyint(3) unsigned NOT NULL AUTO_INCREMENT,
  `role_key` varchar(50) NOT NULL COMMENT 'super_admin, branch_manager, attendance_staff, profile_staff',
  `name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_role_key` (`role_key`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Vai trò';

INSERT INTO `roles` (`id`, `role_key`, `name`, `description`, `created_at`) VALUES
(1, 'super_admin', 'Super Admin', 'Toàn quyền hệ thống, quản lý cả hai cơ sở', '2026-11-26 14:36:46'),
(2, 'branch_manager', 'Quản lý cơ sở', 'Quản lý dữ liệu cơ sở được giao', '2026-11-26 14:36:46'),
(3, 'attendance_staff', 'Nhân viên điểm danh', 'Thực hiện điểm danh và xem danh sách trẻ', '2026-11-26 14:36:46'),
(4, 'profile_staff', 'Nhân viên hồ sơ', 'Quản lý hồ sơ theo quyền được cấp', '2026-11-26 14:36:46');

-- ------------------------------------------------------------
-- Bảng `permissions`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `permissions`;
CREATE TABLE `permissions` (
  `id` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
  `permission_key` varchar(100) NOT NULL COMMENT 'vd: students.create, attendance.lock',
  `module` varchar(50) NOT NULL COMMENT 'students, classes, attendance, tuition, staff, branches, reports, logs, settings',
  `name` varchar(150) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permissions_key` (`permission_key`),
  KEY `idx_permissions_module` (`module`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh mục quyền chi tiết';

INSERT INTO `permissions` (`id`, `permission_key`, `module`, `name`, `created_at`) VALUES
(1, 'students.view', 'students', 'Xem hồ sơ học viên', '2026-11-26 14:36:46'),
(2, 'students.create', 'students', 'Thêm học viên', '2026-11-26 14:36:46'),
(3, 'students.update', 'students', 'Sửa hồ sơ học viên', '2026-11-26 14:36:46'),
(4, 'students.delete', 'students', 'Xoá mềm hồ sơ học viên', '2026-11-26 14:36:46'),
(5, 'students.restore', 'students', 'Khôi phục hồ sơ học viên', '2026-11-26 14:36:46'),
(6, 'students.import', 'students', 'Import học viên từ Excel', '2026-11-26 14:36:46'),
(7, 'students.export', 'students', 'Export danh sách học viên', '2026-11-26 14:36:46'),
(8, 'students.transfer', 'students', 'Chuyển học viên giữa hai cơ sở', '2026-11-26 14:36:46'),
(9, 'classes.view', 'classes', 'Xem lớp học', '2026-11-26 14:36:46'),
(10, 'classes.create', 'classes', 'Thêm lớp học', '2026-11-26 14:36:46'),
(11, 'classes.update', 'classes', 'Sửa / ngừng hoạt động lớp', '2026-11-26 14:36:46'),
(12, 'classes.assign', 'classes', 'Gán / chuyển lớp cho học viên', '2026-11-26 14:36:46'),
(13, 'attendance.view', 'attendance', 'Xem điểm danh và lịch sử điểm danh', '2026-11-26 14:36:46'),
(14, 'attendance.save', 'attendance', 'Thực hiện điểm danh', '2026-11-26 14:36:46'),
(15, 'attendance.edit', 'attendance', 'Chỉnh sửa điểm danh đã ghi', '2026-11-26 14:36:46'),
(16, 'attendance.lock', 'attendance', 'Khoá / mở khoá sổ điểm danh', '2026-11-26 14:36:46'),
(17, 'tuition.view', 'tuition', 'Xem học phí', '2026-11-26 14:36:46'),
(18, 'tuition.generate', 'tuition', 'Tạo bảng học phí kỳ tháng', '2026-11-26 14:36:46'),
(19, 'tuition.adjust', 'tuition', 'Nhập giảm trừ học phí', '2026-11-26 14:36:46'),
(20, 'tuition.collect', 'tuition', 'Thu học phí', '2026-11-26 14:36:46'),
(21, 'tuition.export', 'tuition', 'Xuất bảng học phí', '2026-11-26 14:36:46'),
(22, 'staff.view', 'staff', 'Xem danh sách nhân viên', '2026-11-26 14:36:46'),
(23, 'staff.manage', 'staff', 'Quản lý nhân viên và tài khoản', '2026-11-26 14:36:46'),
(24, 'branches.view', 'branches', 'Xem cơ sở', '2026-11-26 14:36:46'),
(25, 'branches.manage', 'branches', 'Quản lý cơ sở', '2026-11-26 14:36:46'),
(26, 'reports.view', 'reports', 'Xem báo cáo', '2026-11-26 14:36:46'),
(27, 'reports.export', 'reports', 'Xuất báo cáo Excel / PDF', '2026-11-26 14:36:46'),
(28, 'logs.view', 'logs', 'Xem nhật ký hoạt động', '2026-11-26 14:36:46'),
(29, 'settings.manage', 'settings', 'Quản lý cấu hình hệ thống', '2026-11-26 14:36:46');

-- ------------------------------------------------------------
-- Bảng `role_permissions`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `role_permissions`;
CREATE TABLE `role_permissions` (
  `role_id` tinyint(3) unsigned NOT NULL,
  `permission_id` smallint(5) unsigned NOT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `fk_role_permissions_permission` (`permission_id`),
  CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Gán quyền cho vai trò';

INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES
(1, 1),
(1, 2),
(1, 3),
(1, 4),
(1, 5),
(1, 6),
(1, 7),
(1, 8),
(1, 9),
(1, 10),
(1, 11),
(1, 12),
(1, 13),
(1, 14),
(1, 15),
(1, 16),
(1, 17),
(1, 18),
(1, 19),
(1, 20),
(1, 21),
(1, 22),
(1, 23),
(1, 24),
(1, 25),
(1, 26),
(1, 27),
(1, 28),
(1, 29),
(2, 1),
(2, 2),
(2, 3),
(2, 4),
(2, 5),
(2, 6),
(2, 7),
(2, 8),
(2, 9),
(2, 10),
(2, 11),
(2, 12),
(2, 13),
(2, 14),
(2, 15),
(2, 16),
(2, 17),
(2, 18),
(2, 19),
(2, 20),
(2, 21),
(2, 22),
(2, 24),
(2, 26),
(2, 27),
(2, 28),
(3, 1),
(3, 9),
(3, 13),
(3, 14),
(4, 1),
(4, 2),
(4, 3),
(4, 6),
(4, 7),
(4, 9);

-- ------------------------------------------------------------
-- Bảng `users`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `role_id` tinyint(3) unsigned NOT NULL,
  `username` varchar(50) DEFAULT NULL COMMENT 'Tài khoản nội bộ; NULL nếu chỉ đăng nhập Google',
  `email` varchar(150) DEFAULT NULL COMMENT 'Email Google được Admin chỉ định (dùng cho Super Admin)',
  `google_id` varchar(191) DEFAULT NULL COMMENT 'ID tài khoản Google sau lần đăng nhập OAuth đầu tiên',
  `password_hash` varchar(255) DEFAULT NULL COMMENT 'password_hash(); NULL nếu tài khoản chỉ đăng nhập Google',
  `full_name` varchar(120) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `avatar_path` varchar(255) DEFAULT NULL COMMENT 'Ảnh đại diện upload từ máy, lưu ngoài webroot - KHÔNG lưu URL',
  `status` enum('active','locked') NOT NULL DEFAULT 'active',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_google_id` (`google_id`),
  KEY `idx_users_role` (`role_id`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tài khoản admin & nhân viên';

INSERT INTO `users` (`id`, `role_id`, `username`, `email`, `google_id`, `password_hash`, `full_name`, `phone`, `avatar_path`, `status`, `last_login_at`, `created_at`, `updated_at`) VALUES
(1, 1, 'admin', 'dothienvu84tv@gmail.com', '105227688268935859438', '$2y$10$S.bbKciw8gDMEr0/xKOc5ehPm10LblmSwaFrfSsAhqEseccbYmvSa', 'Thiên Vũ Đỗ', NULL, NULL, 'active', '2026-11-28 08:19:07', '2026-11-26 14:36:46', '2026-11-28 08:19:07'),
(2, 3, 'thuatnguyen123', 'nguyenhuynhkithuat84tv@gmail.com', NULL, '$2y$10$h7rw0KC43oxEB5O364uUBOmEwRNuaibI919MGVIFTdgjX9zB/Vnpy', 'Nguyễn Huỳnh Kỹ Thuật', '0388854044', NULL, 'active', NULL, '2026-11-27 19:30:32', '2026-11-27 19:30:32'),
(3, 3, 'vuimamnonlx', 'vuimamnonlx@gmail.com', NULL, '$2y$10$rqKZeKTl2xjroxuoDNVK8.E9M4jOXIl25wHZSae21F2z1X4D1WG.m', 'Cô Vui', NULL, NULL, 'active', '2026-11-28 07:53:37', '2026-11-27 23:27:10', '2026-11-28 07:53:37'),
(4, 3, 'vothingocthi', 'vothingocthi2211@gmail.com', NULL, '$2y$10$3L4uXzMYIxwmHUoBtS67JeFvq4SXMDq8qr3xad/C6gc6xugoVvLzq', 'Võ Thị Ngọc Thi', NULL, NULL, 'active', '2026-11-28 07:54:22', '2026-11-27 23:27:10', '2026-11-28 07:54:22'),
(5, 3, 'trannhuhuynh', 'trannhuhuynh4203@gmail.com', NULL, '$2y$10$COOgPxp7IJan5J3LRGdA6uJDXAkkdHMFvWyT/qx5kvz06em6Du7ma', 'Trần Như Huỳnh', NULL, NULL, 'active', '2026-11-28 08:32:40', '2026-11-28 08:32:39', '2026-11-28 08:32:40'),
(6, 3, 'ngoctram', 'ngoctram@happykidsck.vn', NULL, '$2y$10$JrqPeYEa164m/C2zK5Fqp.s9EEXOrSkRaM2NJ48WZ7O0ULj53rvw.', 'Ngọc Trâm', NULL, NULL, 'active', '2026-11-28 08:46:01', '2026-11-28 08:46:00', '2026-11-28 08:46:01');

-- ------------------------------------------------------------
-- Bảng `user_branches`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `user_branches`;
CREATE TABLE `user_branches` (
  `user_id` int(10) unsigned NOT NULL,
  `branch_id` int(10) unsigned NOT NULL,
  `assigned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`branch_id`),
  KEY `fk_user_branches_branch` (`branch_id`),
  CONSTRAINT `fk_user_branches_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_branches_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phân công nhân viên theo cơ sở (tối đa 2 cơ sở)';

INSERT INTO `user_branches` (`user_id`, `branch_id`, `assigned_at`) VALUES
(2, 2, '2026-11-27 21:01:45'),
(3, 1, '2026-11-28 07:56:11'),
(4, 2, '2026-11-28 07:55:50'),
(5, 1, '2026-11-28 08:32:39'),
(6, 2, '2026-11-28 08:46:00');

-- ------------------------------------------------------------
-- Bảng `user_permissions`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `user_permissions`;
CREATE TABLE `user_permissions` (
  `user_id` int(10) unsigned NOT NULL,
  `permission_id` smallint(5) unsigned NOT NULL,
  `effect` enum('allow','deny') NOT NULL DEFAULT 'allow' COMMENT 'allow: cấp thêm ngoài vai trò; deny: thu hồi quyền của vai trò',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`permission_id`),
  KEY `idx_user_permissions_permission` (`permission_id`),
  CONSTRAINT `fk_user_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_permissions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Quyền riêng từng nhân viên (ghi đè vai trò)';

INSERT INTO `user_permissions` (`user_id`, `permission_id`, `effect`, `created_at`) VALUES
(2, 2, 'allow', '2026-11-27 21:01:45'),
(2, 3, 'allow', '2026-11-27 21:01:45'),
(2, 4, 'allow', '2026-11-27 21:01:45'),
(2, 5, 'allow', '2026-11-27 21:01:45'),
(2, 6, 'allow', '2026-11-27 21:01:45'),
(2, 7, 'allow', '2026-11-27 21:01:45'),
(2, 8, 'allow', '2026-11-27 21:01:45'),
(2, 10, 'allow', '2026-11-27 21:01:45'),
(2, 11, 'allow', '2026-11-27 21:01:45'),
(2, 12, 'allow', '2026-11-27 21:01:45'),
(2, 15, 'allow', '2026-11-27 21:01:45'),
(2, 26, 'allow', '2026-11-27 21:01:45'),
(2, 27, 'allow', '2026-11-27 21:01:45'),
(3, 2, 'allow', '2026-11-28 07:56:11'),
(3, 3, 'allow', '2026-11-28 07:56:11'),
(3, 4, 'allow', '2026-11-28 07:56:11'),
(3, 5, 'allow', '2026-11-28 07:56:11'),
(3, 8, 'allow', '2026-11-28 07:56:11'),
(3, 10, 'allow', '2026-11-28 07:56:11'),
(3, 11, 'allow', '2026-11-28 07:56:11'),
(3, 12, 'allow', '2026-11-28 07:56:11'),
(3, 15, 'allow', '2026-11-28 07:56:11'),
(3, 16, 'allow', '2026-11-28 07:56:11'),
(4, 2, 'allow', '2026-11-28 07:55:50'),
(4, 3, 'allow', '2026-11-28 07:55:50'),
(4, 4, 'allow', '2026-11-28 07:55:50'),
(4, 5, 'allow', '2026-11-28 07:55:50'),
(4, 8, 'allow', '2026-11-28 07:55:50'),
(4, 10, 'allow', '2026-11-28 07:55:50'),
(4, 11, 'allow', '2026-11-28 07:55:50'),
(4, 12, 'allow', '2026-11-28 07:55:50'),
(4, 15, 'allow', '2026-11-28 07:55:50'),
(4, 16, 'allow', '2026-11-28 07:55:50');

-- ------------------------------------------------------------
-- Bảng `user_remember_tokens` (chỉ cấu trúc, không chép dữ liệu)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `user_remember_tokens`;
CREATE TABLE `user_remember_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `selector` varchar(64) NOT NULL COMMENT 'Định danh công khai của token trên thiết bị',
  `token_hash` char(64) NOT NULL COMMENT 'SHA-256 của validator (không lưu token gốc)',
  `password_fingerprint` char(64) NOT NULL COMMENT 'SHA-256 của password_hash lúc cấp token',
  `branch_id` int(10) unsigned DEFAULT NULL COMMENT 'Cơ sở làm việc gần nhất trên thiết bị',
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `last_used_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_remember_selector` (`selector`),
  KEY `idx_remember_user` (`user_id`),
  KEY `idx_remember_expires` (`expires_at`),
  KEY `fk_remember_tokens_branch` (`branch_id`),
  CONSTRAINT `fk_remember_tokens_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_remember_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Token giữ đăng nhập nhiều ngày trên thiết bị cá nhân';

-- ------------------------------------------------------------
-- Bảng `classes`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `classes`;
CREATE TABLE `classes` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `branch_id` int(10) unsigned NOT NULL,
  `name` varchar(120) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'inactive = ngừng hoạt động',
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_classes_branch_name` (`branch_id`,`name`),
  KEY `idx_classes_status` (`branch_id`,`status`),
  KEY `fk_classes_created_by` (`created_by`),
  CONSTRAINT `fk_classes_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_classes_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lớp học theo cơ sở';

INSERT INTO `classes` (`id`, `branch_id`, `name`, `note`, `status`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 1, 'Lớp 1', NULL, 'active', 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(2, 1, 'Lớp 2', NULL, 'active', 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(3, 1, 'Lớp 3', NULL, 'active', 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(4, 1, 'Lớp 5', NULL, 'active', 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(5, 2, 'Lớp Tiểu học', NULL, 'active', 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(6, 2, 'Lớp Bán trú', NULL, 'active', 1, '2026-11-27 21:44:07', '2026-11-27 21:44:07'),
(7, 2, 'Lớp Can thiệp', NULL, 'active', 1, '2026-11-27 22:01:31', '2026-11-27 22:01:31');

-- ------------------------------------------------------------
-- Bảng `students`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `students`;
CREATE TABLE `students` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `branch_id` int(10) unsigned NOT NULL,
  `current_class_id` int(10) unsigned DEFAULT NULL,
  `student_code` varchar(30) NOT NULL COMMENT 'Mã HV - duy nhất toàn hệ thống',
  `full_name` varchar(120) NOT NULL,
  `dob` date DEFAULT NULL,
  `gender` enum('male','female','other') DEFAULT NULL,
  `study_format` varchar(100) DEFAULT NULL COMMENT 'Hình thức / Lớp học - giữ đúng dữ liệu hồ sơ gốc',
  `monthly_fee` decimal(12,0) NOT NULL DEFAULT 0 COMMENT 'Mức học phí thoả thuận (đồng/tháng)',
  `guardian_name` varchar(120) DEFAULT NULL,
  `guardian_phone` varchar(30) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `enrollment_date` date DEFAULT NULL,
  `status` enum('active','paused','left') NOT NULL DEFAULT 'active' COMMENT 'active=đang học, paused=tạm nghỉ, left=đã nghỉ',
  `left_at` date DEFAULT NULL COMMENT 'Ngày nghỉ học (gán khi chuyển status = left)',
  `notes` text DEFAULT NULL COMMENT 'Ghi chú hồ sơ / chuyên cần',
  `identity_code` varchar(20) DEFAULT NULL COMMENT 'Mã định danh CCCD/ĐD - dữ liệu nhạy cảm, hạn chế hiển thị',
  `avatar_path` varchar(255) DEFAULT NULL COMMENT 'Ảnh học viên upload từ máy, lưu ngoài webroot - KHÔNG lưu URL',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Xoá mềm',
  `deleted_by` int(10) unsigned DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `updated_by` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_students_code` (`student_code`),
  UNIQUE KEY `uq_students_identity` (`identity_code`),
  KEY `idx_students_branch_status` (`branch_id`,`status`),
  KEY `idx_students_class` (`current_class_id`),
  KEY `idx_students_name` (`full_name`),
  KEY `idx_students_guardian_phone` (`guardian_phone`),
  KEY `idx_students_deleted` (`deleted_at`),
  KEY `fk_students_deleted_by` (`deleted_by`),
  KEY `fk_students_created_by` (`created_by`),
  KEY `fk_students_updated_by` (`updated_by`),
  CONSTRAINT `fk_students_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_students_class` FOREIGN KEY (`current_class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_students_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_students_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_students_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=89 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Hồ sơ học viên';

INSERT INTO `students` (`id`, `branch_id`, `current_class_id`, `student_code`, `full_name`, `dob`, `gender`, `study_format`, `monthly_fee`, `guardian_name`, `guardian_phone`, `address`, `enrollment_date`, `status`, `left_at`, `notes`, `identity_code`, `avatar_path`, `deleted_at`, `deleted_by`, `created_by`, `updated_by`, `created_at`, `updated_at`) VALUES
(1, 1, 2, 'TN0001', 'An Khang', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(2, 1, 3, 'TN0002', 'Bảo Châu', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(3, 1, 2, 'TN0003', 'Ngọc Tuyền', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(4, 1, 4, 'TN0004', 'Thế An', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(5, 1, 3, 'TN0005', 'Tuấn Kiệt', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(6, 1, 2, 'TN0006', 'Kim Hà', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(7, 1, 1, 'TN0007', 'Đức Phúc', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(8, 1, 3, 'TN0008', 'Quân Bảo', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(9, 1, 2, 'TN0009', 'Đông Nhi', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(10, 1, 2, 'TN0010', 'Diệu Anh', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(11, 1, 2, 'TN0011', 'Gia Phát', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(12, 1, 2, 'TN0012', 'Duy Trọng', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(13, 1, 2, 'TN0013', 'Gia Huy', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(14, 1, 2, 'TN0014', 'Chí Khang', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(15, 1, 2, 'TN0015', 'Minh Quân', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(16, 1, 3, 'TN0016', 'Minh Thành', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(17, 1, 2, 'TN0017', 'Khánh Ân', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(18, 1, 1, 'TN0018', 'Thư', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(19, 1, NULL, 'TN0019', 'Chí Khang', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(20, 1, NULL, 'TN0020', 'Tuấn Khang', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(21, 1, NULL, 'TN0021', 'Bảo Hân', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(22, 1, NULL, 'TN0022', 'Hoàng Huy', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(23, 1, NULL, 'TN0023', 'Nghi', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(24, 1, NULL, 'TN0024', 'Phúc', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(25, 1, NULL, 'TN0025', 'Đức Chí', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 19:28:13', '2026-11-27 19:28:13'),
(26, 2, 5, 'CL0001', 'Trọng Nhân', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(27, 2, 5, 'CL0002', 'Kiều Vy', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(28, 2, 5, 'CL0003', 'Phạm T. Phúc (GTT)', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(29, 2, 5, 'CL0004', 'Gia Huy (L1)', NULL, 'male', 'Can thiệp cá nhân', '2100000', NULL, NULL, 'Cơ sở Càng Long, tỉnh Vĩnh Long', '2026-10-01', 'active', NULL, 'Mã HV cũ: HV058', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 23:25:39'),
(30, 2, 5, 'CL0005', 'Đông', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(31, 2, 5, 'CL0006', 'Trung Nhân', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(32, 2, 5, 'CL0007', 'Đức Trí', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(33, 2, 5, 'CL0008', 'Quốc Bảo', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(34, 2, 5, 'CL0009', 'P. Khải', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(35, 2, 5, 'CL0010', 'H. Phát', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(36, 2, 5, 'CL0011', 'T. Phát', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(37, 2, 5, 'CL0012', 'Mẫn', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(38, 2, 5, 'CL0013', 'Nguyễn Hoàng Gia Thịnh', '2021-11-11', 'male', 'Bán trú can thiệp', '6160000', NULL, '0358754523 / 0387302721', 'Ấp Trường Thọ, xã Trung Ngãi, tỉnh Vĩnh Long', '2026-08-12', 'active', NULL, 'Mã HV cũ: HV012 | Cha: 0358754523 · Mẹ: 0387302721', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 23:25:39'),
(39, 2, 5, 'CL0014', 'Lệ Hằng', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(40, 2, 5, 'CL0015', 'Thiên Ân', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(41, 2, 5, 'CL0016', 'Gia Minh', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(42, 2, 5, 'CL0017', 'Minh Khang', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(43, 2, 5, 'CL0018', 'Tuấn', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(44, 2, 5, 'CL0019', 'Gia Quý', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(45, 2, 5, 'CL0020', 'Gia Mỹ', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(46, 2, 5, 'CL0021', 'Phú (GTT)', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(47, 2, 5, 'CL0022', 'Đô La (Kiệt)', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(48, 2, 5, 'CL0023', 'Thúy', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(49, 2, 5, 'CL0024', 'Thư', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(50, 2, 5, 'CL0025', 'Quỳnh', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(51, 2, 5, 'CL0026', 'Thiên Phúc', NULL, NULL, NULL, '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:37:46', '2026-11-27 21:37:46'),
(52, 2, 6, 'CL0027', 'Bùi Quốc Bảo', '2016-01-07', 'male', 'Bán trú can thiệp', '5500000', NULL, '0948878008 / 0916665459', 'Ấp Rạch Bô, xã Nhị Long, tỉnh Vĩnh Long', '2026-06-15', 'active', NULL, 'Mã HV cũ: HV025 | Cha: 0948878008 · Mẹ: 0916665459', '084216007544', NULL, NULL, NULL, 1, 1, '2026-11-27 21:44:07', '2026-11-27 23:25:39'),
(53, 2, 6, 'CL0028', 'Nguyễn Võ Như Bình', '2018-02-25', 'female', 'Bán trú can thiệp', '5880000', NULL, '0976690404 / 0383452804', 'Ấp LoCoB, xã An Trường, tỉnh Vĩnh Long', '2026-06-02', 'active', NULL, 'Mã HV cũ: HV002 | Cha: 0976690404 · Mẹ: 0383452804', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:44:07', '2026-11-27 23:25:39'),
(54, 2, 6, 'CL0029', 'Nguyễn Tuấn Khải', '2018-05-01', 'male', 'Bán trú can thiệp', '7020000', NULL, '0968242603', 'Ấp Mây Tức, xã Càng Long, tỉnh Vĩnh Long', '2026-09-23', 'active', NULL, 'Mã HV cũ: HV013 | Mẹ: 0968242603', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:44:07', '2026-11-27 23:25:39'),
(55, 2, 6, 'CL0030', 'Kim Ý', NULL, 'female', 'Bán trú can thiệp', '7800000', NULL, NULL, 'Cơ sở Càng Long, tỉnh Vĩnh Long', '2026-09-18', 'active', NULL, 'Mã HV cũ: HV055', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:44:07', '2026-11-27 23:25:39'),
(56, 2, 6, 'CL0031', 'Trần Thế Minh', '2018-11-04', 'male', 'Bán trú can thiệp', '7280000', NULL, '0945897878 / 0946101516', 'Khóm 1, phường Nguyệt Hóa, tỉnh Vĩnh Long', '2026-06-16', 'active', NULL, 'Mã HV cũ: HV020 | Cha: 0945897878 · Mẹ: 0946101516', '084218003399', NULL, NULL, NULL, 1, 1, '2026-11-27 21:44:07', '2026-11-27 23:25:39'),
(57, 2, 6, 'CL0032', 'Nguyễn Hoàng Minh', '2023-10-04', 'male', 'Bán trú can thiệp', '7020000', NULL, NULL, 'Ấp Thanh Thiện, xã Càng Long, tỉnh Vĩnh Long', '2026-06-08', 'active', NULL, 'Mã HV cũ: HV003', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:44:07', '2026-11-27 23:25:39'),
(58, 2, 6, 'CL0033', 'Trang Nhiên', NULL, 'female', 'Bán trú can thiệp', '7800000', NULL, NULL, 'Cơ sở Càng Long, tỉnh Vĩnh Long', '2026-09-27', 'active', NULL, 'Mã HV cũ: HV056', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:44:07', '2026-11-27 23:25:39'),
(59, 2, 6, 'CL0034', 'Phúc Thịnh', NULL, 'male', 'Bán trú can thiệp', '7800000', NULL, NULL, 'Cơ sở Càng Long, tỉnh Vĩnh Long', '2026-09-25', 'active', NULL, 'Mã HV cũ: HV052', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:44:07', '2026-11-27 23:25:39'),
(60, 2, 6, 'CL0035', 'Nguyễn Phạm Chí Thiện', '2021-01-08', 'male', 'Bán trú can thiệp', '8100000', NULL, '0707337869', 'Ấp Hòa Nghĩa, xã Quới An, tỉnh Vĩnh Long', '2026-08-11', 'active', NULL, 'Mã HV cũ: HV024 | Mẹ: 0707337869', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:44:08', '2026-11-27 23:25:39'),
(61, 2, 6, 'CL0036', 'Khánh Đăng', NULL, 'male', 'Bán trú can thiệp', '8100000', NULL, NULL, 'Cơ sở Càng Long, tỉnh Vĩnh Long', '2026-10-05', 'active', NULL, 'Mã HV cũ: HV059', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:44:08', '2026-11-27 23:25:39'),
(62, 2, 6, 'CL0037', 'Quốc Hưng', NULL, 'male', 'Bán trú can thiệp', '7800000', NULL, NULL, 'Cơ sở Càng Long, tỉnh Vĩnh Long', '2026-09-15', 'active', NULL, 'Mã HV cũ: HV054', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:44:08', '2026-11-27 23:25:39'),
(63, 2, 6, 'CL0038', 'Tằng Nhã Vy', '2019-09-08', 'female', 'Bán trú can thiệp', '7280000', 'Mẹ: Bùi Thị Bé Quyên · Ngoại: Mai Thị Út', '0966597607', 'Ấp 4, xã An Trường, huyện Càng Long, tỉnh Vĩnh Long', '2026-04-14', 'active', NULL, 'Mã HV cũ: HV030', '08431900317', NULL, NULL, NULL, 1, 1, '2026-11-27 21:44:08', '2026-11-27 23:25:39'),
(64, 2, 6, 'CL0039', 'Công Quyền', NULL, 'male', 'Bán trú can thiệp', '6600000', NULL, NULL, 'Cơ sở Càng Long, tỉnh Vĩnh Long', '2026-09-12', 'active', NULL, 'Mã HV cũ: HV057', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:44:08', '2026-11-27 23:25:39'),
(65, 2, 6, 'CL0040', 'Tuấn Khang', NULL, 'male', 'Bán trú can thiệp', '8100000', NULL, NULL, 'Cơ sở Càng Long, tỉnh Vĩnh Long', '2026-10-06', 'active', NULL, 'Mã HV cũ: HV048', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:44:08', '2026-11-27 23:25:39'),
(66, 2, 6, 'CL0041', 'Hưng Thịnh', NULL, 'male', 'Bán trú can thiệp', '6600000', NULL, NULL, 'Cơ sở Càng Long, tỉnh Vĩnh Long', '2026-06-08', 'active', NULL, 'Mã HV cũ: HV053', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:44:08', '2026-11-27 23:25:39'),
(67, 2, 6, 'CL0042', 'Phúc Khay', NULL, NULL, 'Ca bán trú', '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 21:44:08', '2026-11-27 21:44:08'),
(69, 2, 7, 'CL0043', 'An Huy', NULL, NULL, 'Can thiệp', '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 22:01:31'),
(70, 2, 7, 'CL0044', 'Nolal', NULL, 'male', 'Can thiệp cá nhân', '5500000', NULL, NULL, 'Cơ sở Càng Long, tỉnh Vĩnh Long', '2026-09-21', 'active', NULL, 'Mã HV cũ: HV050', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 23:25:39'),
(71, 2, 7, 'CL0045', 'Hoài Bảo', NULL, 'male', 'Can thiệp cá nhân', '1800000', NULL, NULL, 'Cơ sở Càng Long, tỉnh Vĩnh Long', '2026-05-01', 'active', NULL, 'Mã HV cũ: HV051', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 23:25:39'),
(72, 2, 7, 'CL0046', 'Trọng (Mun)', NULL, NULL, 'Can thiệp', '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 22:01:31'),
(73, 2, 7, 'CL0047', 'Thiên Phúc (Bo)', NULL, 'male', 'Can thiệp cá nhân', '2500000', NULL, NULL, 'Cơ sở Càng Long, tỉnh Vĩnh Long', '2026-10-01', 'active', NULL, 'Mã HV cũ: HV033', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 23:25:39'),
(74, 2, 7, 'CL0048', 'Lâm Hoàng Quân', '2023-09-14', 'male', 'Can thiệp cá nhân', '2500000', NULL, '0919137841 / 0352897991', 'Xã Nhị Long, huyện Càng Long, tỉnh Vĩnh Long', '2026-05-24', 'active', NULL, 'Mã HV cũ: HV027 | Cha: 0919137841 · Mẹ: 0352897991', '084223004525', NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 23:25:39'),
(75, 2, 7, 'CL0049', 'Lâm Tấn Quốc Vinh', '2022-01-01', 'male', 'Bán trú can thiệp', '6000000', NULL, '0906228006 / 0979223603', 'Xã Trung Ngãi, huyện Vũng Liêm, tỉnh Vĩnh Long', '2026-08-15', 'active', NULL, 'Mã HV cũ: HV029 | Cha: 0906228006 · Mẹ: 0979223603', '079222000320', NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 23:25:39'),
(76, 2, 7, 'CL0050', 'Nguyễn Ngọc Tâm', NULL, 'male', 'Can thiệp cá nhân', '5500000', NULL, NULL, 'Cơ sở Càng Long, tỉnh Vĩnh Long', '2026-10-01', 'active', NULL, 'Mã HV cũ: HV034', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 23:25:39'),
(77, 2, 7, 'CL0051', 'Huỳnh Anh Hiếu', '2020-01-08', 'male', 'Can thiệp cá nhân', '6750000', 'Cha: Huỳnh Nhật Trường · Mẹ: Huỳnh Thị Kim Anh', '0909879692', 'Ấp 3, xã Trung Ngãi, tỉnh Vĩnh Long', '2026-06-17', 'active', NULL, 'Mã HV cũ: HV031', '086220000118', NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 23:25:39'),
(78, 2, 7, 'CL0052', 'Trương Huy Tiến', '2024-09-16', 'male', 'Can thiệp cá nhân', '3000000', NULL, '0708331199 / 0975760975', 'Ấp An Trung, xã Trung Thành, tỉnh Vĩnh Long', '2026-08-21', 'active', NULL, 'Mã HV cũ: HV017 | Cha: 0708331199 · Mẹ: 0975760975', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 23:25:39'),
(79, 2, 7, 'CL0053', 'Nguyễn Hoàng Nghĩa', '2023-05-17', 'male', 'Can thiệp cá nhân', '3250000', NULL, '0346891517 / 0907356698', '256/5 Thiện Chánh, xã Bình Phú, tỉnh Vĩnh Long', '2026-09-15', 'active', NULL, 'Mã HV cũ: HV015 | Cha: 0346891517 · Mẹ: 0907356698', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 23:25:39'),
(80, 2, 7, 'CL0054', 'Nguyễn Gia Huy (lớn)', '2022-03-12', 'male', 'Bán trú can thiệp', '3500000', NULL, '0362294903', 'Ấp Tân Hòa, xã Hiếu Phụng, tỉnh Vĩnh Long', '2026-09-01', 'active', NULL, 'Mã HV cũ: HV014 | Mẹ: 0362294903', '084222001188', NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 23:25:39'),
(81, 2, 7, 'CL0055', 'Phạm Lê Ánh Dương', '2021-11-25', 'female', 'Can thiệp cá nhân', '5000000', NULL, '0987069747 / 0354749960', 'Ấp Mây Tào, xã Càng Long, tỉnh Vĩnh Long', '2026-09-19', 'active', NULL, 'Mã HV cũ: HV018 | Cha: 0987069747 · Mẹ: 0354749960', '084321000288', NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 23:25:39'),
(82, 2, 7, 'CL0056', 'Khánh Hưng', NULL, NULL, 'Can thiệp', '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 22:01:31'),
(83, 2, 7, 'CL0057', 'Trần Gia Huy (ú)', NULL, 'male', 'Can thiệp cá nhân', '3750000', NULL, NULL, 'Cơ sở Càng Long, tỉnh Vĩnh Long', '2026-09-18', 'active', NULL, 'Mã HV cũ: HV049', NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 23:25:39'),
(84, 2, 7, 'CL0058', 'Bảo Ngọc', NULL, NULL, 'Can thiệp', '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 22:01:31'),
(85, 2, 7, 'CL0059', 'Tiểu Vy', NULL, NULL, 'Can thiệp', '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 22:01:31'),
(86, 2, 7, 'CL0060', 'Nguyễn Hữu Đức', '2023-10-05', 'male', 'Can thiệp cá nhân', '2500000', NULL, '0878741088 / 0373998261', 'Ấp số 2, xã Mỹ Cẩm, huyện Càng Long, tỉnh Vĩnh Long', '2026-04-22', 'active', NULL, 'Mã HV cũ: HV028 | Cha: 0878741088 · Mẹ: 0373998261', '084223005160', NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 23:25:39'),
(87, 2, 7, 'CL0061', 'Lê Ngọc Thiên Vy', '2019-11-03', 'female', 'Can thiệp cá nhân', '5500000', NULL, '0939297311 / 0988595061', 'Số 733 QL53, Ấp Thái Bình, xã Càng Long, tỉnh Vĩnh Long', '2026-09-15', 'active', NULL, 'Mã HV cũ: HV016 | Cha: 0939297311 · Mẹ: 0988595061', '084319001105', NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 23:25:39'),
(88, 2, 7, 'CL0062', 'Lâm Anh', NULL, NULL, 'Can thiệp', '0', NULL, NULL, NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-11-27 22:01:31', '2026-11-27 22:01:31');

-- ------------------------------------------------------------
-- Bảng `student_class_histories`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `student_class_histories`;
CREATE TABLE `student_class_histories` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `student_id` int(10) unsigned NOT NULL,
  `class_id` int(10) unsigned NOT NULL,
  `joined_at` date NOT NULL,
  `left_at` date DEFAULT NULL COMMENT 'NULL = còn học lớp này',
  `reason` varchar(255) DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sch_student` (`student_id`,`joined_at`),
  KEY `idx_sch_class` (`class_id`),
  KEY `fk_sch_created_by` (`created_by`),
  CONSTRAINT `fk_sch_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_sch_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_sch_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=82 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch sử gán / chuyển lớp';

INSERT INTO `student_class_histories` (`id`, `student_id`, `class_id`, `joined_at`, `left_at`, `reason`, `created_by`, `created_at`) VALUES
(1, 1, 2, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(2, 2, 3, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(3, 3, 2, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(4, 4, 4, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(5, 5, 3, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(6, 6, 2, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(7, 7, 1, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(8, 8, 3, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(9, 9, 2, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(10, 10, 2, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(11, 11, 2, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(12, 12, 2, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(13, 13, 2, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(14, 14, 2, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(15, 15, 2, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(16, 16, 3, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(17, 17, 2, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(18, 18, 1, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 19:28:13'),
(19, 26, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(20, 27, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(21, 28, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(22, 29, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(23, 30, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(24, 31, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(25, 32, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(26, 33, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(27, 34, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(28, 35, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(29, 36, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(30, 37, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(31, 38, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(32, 39, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(33, 40, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(34, 41, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(35, 42, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(36, 43, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(37, 44, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(38, 45, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(39, 46, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(40, 47, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(41, 48, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(42, 49, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(43, 50, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(44, 51, 5, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:37:46'),
(45, 52, 6, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:44:07'),
(46, 53, 6, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:44:07'),
(47, 54, 6, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:44:07'),
(48, 55, 6, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:44:07'),
(49, 56, 6, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:44:07'),
(50, 57, 6, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:44:07'),
(51, 58, 6, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:44:07'),
(52, 59, 6, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:44:08'),
(53, 60, 6, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:44:08'),
(54, 61, 6, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:44:08'),
(55, 62, 6, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:44:08'),
(56, 63, 6, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:44:08'),
(57, 64, 6, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:44:08'),
(58, 65, 6, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:44:08'),
(59, 66, 6, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:44:08'),
(60, 67, 6, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 21:44:08'),
(62, 69, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(63, 70, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(64, 71, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(65, 72, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(66, 73, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(67, 74, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(68, 75, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(69, 76, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(70, 77, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(71, 78, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(72, 79, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(73, 80, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(74, 81, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(75, 82, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(76, 83, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(77, 84, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(78, 85, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(79, 86, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(80, 87, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31'),
(81, 88, 7, '2026-11-27', NULL, 'Gán lớp khi tạo hồ sơ', 1, '2026-11-27 22:01:31');

-- ------------------------------------------------------------
-- Bảng `student_branch_histories`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `student_branch_histories`;
CREATE TABLE `student_branch_histories` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `student_id` int(10) unsigned NOT NULL,
  `from_branch_id` int(10) unsigned NOT NULL,
  `to_branch_id` int(10) unsigned NOT NULL,
  `moved_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reason` varchar(255) DEFAULT NULL,
  `performed_by` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sbh_student` (`student_id`,`moved_at`),
  KEY `fk_sbh_from_branch` (`from_branch_id`),
  KEY `fk_sbh_to_branch` (`to_branch_id`),
  KEY `fk_sbh_performed_by` (`performed_by`),
  CONSTRAINT `fk_sbh_from_branch` FOREIGN KEY (`from_branch_id`) REFERENCES `branches` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_sbh_performed_by` FOREIGN KEY (`performed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_sbh_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_sbh_to_branch` FOREIGN KEY (`to_branch_id`) REFERENCES `branches` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch sử chuyển cơ sở';

-- ------------------------------------------------------------
-- Bảng `attendance_sessions`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `attendance_sessions`;
CREATE TABLE `attendance_sessions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `branch_id` int(10) unsigned NOT NULL,
  `class_id` int(10) unsigned DEFAULT NULL COMMENT 'NULL = học viên chưa xếp lớp trong cơ sở',
  `class_scope` int(10) unsigned NOT NULL DEFAULT 0 COMMENT '0 = chưa xếp lớp; ngược lại = class_id',
  `session_date` date NOT NULL,
  `slot_name` varchar(50) NOT NULL DEFAULT 'Chính' COMMENT 'Tên ca/buổi (Chính, Sáng, Chiều, Tối...)',
  `is_locked` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = đã khoá sổ, không cho sửa',
  `locked_at` datetime DEFAULT NULL,
  `locked_by` int(10) unsigned DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sessions_branch_class_date_slot` (`branch_id`,`class_scope`,`session_date`,`slot_name`),
  KEY `idx_sessions_branch_date` (`branch_id`,`session_date`),
  KEY `fk_sessions_locked_by` (`locked_by`),
  KEY `fk_sessions_created_by` (`created_by`),
  KEY `fk_sessions_class` (`class_id`),
  CONSTRAINT `fk_sessions_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_sessions_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_sessions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_sessions_locked_by` FOREIGN KEY (`locked_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phiên điểm danh (một lớp, một ngày, một ca)';

-- ------------------------------------------------------------
-- Bảng `attendance`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `attendance`;
CREATE TABLE `attendance` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `attendance_session_id` int(10) unsigned NOT NULL,
  `student_id` int(10) unsigned NOT NULL,
  `status` enum('present','excused_absent','unexcused_absent','late','planned_leave') NOT NULL COMMENT 'Có mặt / Vắng có phép / Vắng không phép / Đi muộn / Nghỉ có kế hoạch',
  `note` varchar(255) DEFAULT NULL COMMENT 'Lý do nghỉ / đi muộn',
  `recorded_by` int(10) unsigned DEFAULT NULL,
  `recorded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_by` int(10) unsigned DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attendance_session_student` (`attendance_session_id`,`student_id`),
  KEY `idx_attendance_student` (`student_id`,`status`),
  KEY `fk_attendance_recorded_by` (`recorded_by`),
  KEY `fk_attendance_updated_by` (`updated_by`),
  CONSTRAINT `fk_attendance_recorded_by` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_session` FOREIGN KEY (`attendance_session_id`) REFERENCES `attendance_sessions` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bản ghi điểm danh từng học viên trong phiên';

-- ------------------------------------------------------------
-- Bảng `tuition_records`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `tuition_records`;
CREATE TABLE `tuition_records` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `student_id` int(10) unsigned NOT NULL,
  `branch_id` int(10) unsigned NOT NULL COMMENT 'Snapshot cơ sở tại kỳ thu',
  `period_year` smallint(5) unsigned NOT NULL,
  `period_month` tinyint(3) unsigned NOT NULL COMMENT '1-12',
  `base_amount` decimal(12,0) NOT NULL DEFAULT 0 COMMENT 'Học phí thoả thuận chốt tại kỳ',
  `present_days` tinyint(3) unsigned NOT NULL DEFAULT 0 COMMENT 'Số ngày có mặt trong kỳ',
  `absent_days` tinyint(3) unsigned NOT NULL DEFAULT 0 COMMENT 'Số ngày nghỉ trong kỳ',
  `deduction_amount` decimal(12,0) NOT NULL DEFAULT 0 COMMENT 'Tổng giảm trừ của kỳ',
  `final_amount` decimal(12,0) NOT NULL DEFAULT 0 COMMENT 'Số phải thu sau giảm trừ',
  `paid_amount` decimal(12,0) NOT NULL DEFAULT 0 COMMENT 'Tổng đã thu (cập nhật trong transaction)',
  `status` enum('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  `note` varchar(255) DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tuition_student_period` (`student_id`,`period_year`,`period_month`),
  KEY `idx_tuition_branch_period` (`branch_id`,`period_year`,`period_month`,`status`),
  KEY `fk_tuition_created_by` (`created_by`),
  CONSTRAINT `fk_tuition_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_tuition_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_tuition_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Học phí từng học viên theo kỳ tháng';

-- ------------------------------------------------------------
-- Bảng `tuition_adjustments`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `tuition_adjustments`;
CREATE TABLE `tuition_adjustments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tuition_record_id` bigint(20) unsigned NOT NULL,
  `amount` decimal(12,0) NOT NULL COMMENT 'Số tiền giảm trừ (đồng)',
  `reason` varchar(255) NOT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tuition_adj_record` (`tuition_record_id`),
  KEY `fk_tuition_adj_created_by` (`created_by`),
  CONSTRAINT `fk_tuition_adj_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_tuition_adj_record` FOREIGN KEY (`tuition_record_id`) REFERENCES `tuition_records` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Các khoản giảm trừ học phí';

-- ------------------------------------------------------------
-- Bảng `tuition_payments`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `tuition_payments`;
CREATE TABLE `tuition_payments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tuition_record_id` bigint(20) unsigned NOT NULL,
  `amount` decimal(12,0) NOT NULL,
  `paid_on` date NOT NULL,
  `method` enum('cash','transfer','other') NOT NULL DEFAULT 'cash',
  `note` varchar(255) DEFAULT NULL,
  `received_by` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tuition_pay_record` (`tuition_record_id`,`paid_on`),
  KEY `fk_tuition_pay_received_by` (`received_by`),
  CONSTRAINT `fk_tuition_pay_received_by` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_tuition_pay_record` FOREIGN KEY (`tuition_record_id`) REFERENCES `tuition_records` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phiếu thu học phí (cho phép thu nhiều lần)';

-- ------------------------------------------------------------
-- Bảng `system_settings`
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `system_settings`;
CREATE TABLE `system_settings` (
  `id` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL COMMENT 'vd: tuition.rule (quy định tính học phí do Admin nhập)',
  `setting_value` text DEFAULT NULL COMMENT 'Giá trị, có thể là JSON tuỳ quy định',
  `setting_group` varchar(50) NOT NULL DEFAULT 'general',
  `description` varchar(255) DEFAULT NULL,
  `updated_by` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settings_key` (`setting_key`),
  KEY `idx_settings_group` (`setting_group`),
  KEY `fk_settings_updated_by` (`updated_by`),
  CONSTRAINT `fk_settings_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cấu hình hệ thống (quy định học phí...)';

-- ------------------------------------------------------------
-- Bảng `activity_logs` (chỉ cấu trúc, không chép dữ liệu)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `activity_logs`;
CREATE TABLE `activity_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned DEFAULT NULL,
  `action` varchar(50) NOT NULL COMMENT 'login/logout/create/update/delete/restore/lock/unlock/collect/import/export...',
  `module` varchar(50) NOT NULL COMMENT 'students, classes, attendance, tuition, staff, branches, settings...',
  `target_type` varchar(50) DEFAULT NULL COMMENT 'student, attendance, tuition_record...',
  `target_id` bigint(20) unsigned DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `old_values` longtext DEFAULT NULL COMMENT 'Giá trị trước khi sửa (lịch sử chỉnh sửa hồ sơ/điểm danh)',
  `new_values` longtext DEFAULT NULL COMMENT 'Giá trị sau khi sửa',
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity_user_time` (`user_id`,`created_at`),
  KEY `idx_activity_module_target` (`module`,`target_type`,`target_id`),
  KEY `idx_activity_time` (`created_at`),
  CONSTRAINT `fk_activity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nhật ký thao tác toàn hệ thống';

-- ------------------------------------------------------------
-- Bảng `login_histories` (chỉ cấu trúc, không chép dữ liệu)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `login_histories`;
CREATE TABLE `login_histories` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned DEFAULT NULL,
  `attempted_identifier` varchar(150) DEFAULT NULL COMMENT 'Email/tên đăng nhập đã thử (kể cả khi thất bại)',
  `login_method` enum('google','password') NOT NULL,
  `status` enum('success','failed') NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_login_histories_user_time` (`user_id`,`created_at`),
  KEY `idx_login_histories_time` (`created_at`),
  CONSTRAINT `fk_login_histories_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch sử đăng nhập';

SET FOREIGN_KEY_CHECKS = 1;
