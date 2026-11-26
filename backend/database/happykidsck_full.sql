-- ============================================================
-- HappyKidsCK — Toàn bộ cơ sở dữ liệu trong 1 file
-- Gồm: 19 bảng (schema, đã gồm cột students.left_at) + seed:
--       2 cơ sở, 4 vai trò, 29 quyền, tài khoản Super Admin
-- Cách dùng: phpMyAdmin → Import → chọn file này → Go
-- (Nếu đổi tên database, sửa 2 dòng CREATE DATABASE / USE bên dưới)
-- ============================================================

CREATE DATABASE IF NOT EXISTS `happykidsck` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `happykidsck`;

-- ============================================================
-- SECTION: migrations/001_create_branches.sql
-- ============================================================

-- ============================================================
-- 001 - Cơ sở (Tân Nhựt, Càng Long)
-- ============================================================

CREATE TABLE `branches` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code`       VARCHAR(20)  NOT NULL COMMENT 'Mã cơ sở, vd: TN, CL',
  `name`       VARCHAR(120) NOT NULL,
  `address`    VARCHAR(255) NULL,
  `phone`      VARCHAR(30)  NULL,
  `logo_path`  VARCHAR(255) NULL COMMENT 'Đường dẫn logo upload từ máy (lưu ngoài webroot), KHÔNG lưu URL',
  `status`     ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_branches_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cơ sở của trung tâm';

-- ============================================================
-- SECTION: migrations/002_create_auth_tables.sql
-- ============================================================

-- ============================================================
-- 002 - Phân hệ đăng nhập & phân quyền
-- roles, permissions, role_permissions, users, user_branches,
-- login_histories
-- ============================================================

CREATE TABLE `roles` (
  `id`          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `role_key`    VARCHAR(50)  NOT NULL COMMENT 'super_admin, branch_manager, attendance_staff, profile_staff',
  `name`        VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_role_key` (`role_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Vai trò';

CREATE TABLE `permissions` (
  `id`             SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `permission_key` VARCHAR(100) NOT NULL COMMENT 'vd: students.create, attendance.lock',
  `module`         VARCHAR(50)  NOT NULL COMMENT 'students, classes, attendance, tuition, staff, branches, reports, logs, settings',
  `name`           VARCHAR(150) NOT NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permissions_key` (`permission_key`),
  KEY `idx_permissions_module` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh mục quyền chi tiết';

CREATE TABLE `role_permissions` (
  `role_id`       TINYINT UNSIGNED  NOT NULL,
  `permission_id` SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Gán quyền cho vai trò';

CREATE TABLE `users` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `role_id`       TINYINT UNSIGNED NOT NULL,
  `username`      VARCHAR(50)  NULL COMMENT 'Tài khoản nội bộ; NULL nếu chỉ đăng nhập Google',
  `email`         VARCHAR(150) NULL COMMENT 'Email Google được Admin chỉ định (dùng cho Super Admin)',
  `google_id`     VARCHAR(191) NULL COMMENT 'ID tài khoản Google sau lần đăng nhập OAuth đầu tiên',
  `password_hash` VARCHAR(255) NULL COMMENT 'password_hash(); NULL nếu tài khoản chỉ đăng nhập Google',
  `full_name`     VARCHAR(120) NOT NULL,
  `phone`         VARCHAR(30)  NULL,
  `avatar_path`   VARCHAR(255) NULL COMMENT 'Ảnh đại diện upload từ máy, lưu ngoài webroot - KHÔNG lưu URL',
  `status`        ENUM('active','locked') NOT NULL DEFAULT 'active',
  `last_login_at` DATETIME NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_google_id` (`google_id`),
  KEY `idx_users_role` (`role_id`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tài khoản admin & nhân viên';

CREATE TABLE `user_branches` (
  `user_id`     INT UNSIGNED NOT NULL,
  `branch_id`   INT UNSIGNED NOT NULL,
  `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `branch_id`),
  CONSTRAINT `fk_user_branches_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_branches_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phân công nhân viên theo cơ sở (tối đa 2 cơ sở)';

CREATE TABLE `user_permissions` (
  `user_id`       INT UNSIGNED      NOT NULL,
  `permission_id` SMALLINT UNSIGNED NOT NULL,
  `effect`        ENUM('allow','deny') NOT NULL DEFAULT 'allow'
                  COMMENT 'allow: cấp thêm ngoài vai trò; deny: thu hồi quyền của vai trò',
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `permission_id`),
  KEY `idx_user_permissions_permission` (`permission_id`),
  CONSTRAINT `fk_user_permissions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Quyền riêng từng nhân viên (ghi đè vai trò)';

CREATE TABLE `login_histories` (
  `id`                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`              INT UNSIGNED NULL,
  `attempted_identifier` VARCHAR(150) NULL COMMENT 'Email/tên đăng nhập đã thử (kể cả khi thất bại)',
  `login_method`         ENUM('google','password') NOT NULL,
  `status`               ENUM('success','failed') NOT NULL,
  `ip_address`           VARCHAR(45)  NULL,
  `user_agent`           VARCHAR(255) NULL,
  `created_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_login_histories_user_time` (`user_id`, `created_at`),
  KEY `idx_login_histories_time` (`created_at`),
  CONSTRAINT `fk_login_histories_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch sử đăng nhập';

-- ============================================================
-- SECTION: migrations/003_create_classes.sql
-- ============================================================

-- ============================================================
-- 003 - Lớp học
-- ============================================================

CREATE TABLE `classes` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id`  INT UNSIGNED NOT NULL,
  `name`       VARCHAR(120) NOT NULL,
  `note`       VARCHAR(255) NULL,
  `status`     ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'inactive = ngừng hoạt động',
  `created_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_classes_branch_name` (`branch_id`, `name`),
  KEY `idx_classes_status` (`branch_id`, `status`),
  CONSTRAINT `fk_classes_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_classes_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lớp học theo cơ sở';

-- ============================================================
-- SECTION: migrations/004_create_students.sql
-- ============================================================

-- ============================================================
-- 004 - Hồ sơ học viên + lịch sử chuyển lớp / chuyển cơ sở
-- ============================================================

CREATE TABLE `students` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id`        INT UNSIGNED NOT NULL,
  `current_class_id` INT UNSIGNED NULL,
  `student_code`     VARCHAR(30)  NOT NULL COMMENT 'Mã HV - duy nhất toàn hệ thống',
  `full_name`        VARCHAR(120) NOT NULL,
  `dob`              DATE NULL,
  `gender`           ENUM('male','female','other') NULL,
  `study_format`     VARCHAR(100) NULL COMMENT 'Hình thức / Lớp học - giữ đúng dữ liệu hồ sơ gốc',
  `monthly_fee`      DECIMAL(12,0) NOT NULL DEFAULT 0 COMMENT 'Mức học phí thoả thuận (đồng/tháng)',
  `guardian_name`    VARCHAR(120) NULL,
  `guardian_phone`   VARCHAR(30)  NULL,
  `address`          VARCHAR(255) NULL,
  `enrollment_date`  DATE NULL,
  `status`           ENUM('active','paused','left') NOT NULL DEFAULT 'active'
                       COMMENT 'active=đang học, paused=tạm nghỉ, left=đã nghỉ',
  `notes`            TEXT NULL COMMENT 'Ghi chú hồ sơ / chuyên cần',
  `identity_code`    VARCHAR(20) NULL COMMENT 'Mã định danh CCCD/ĐD - dữ liệu nhạy cảm, hạn chế hiển thị',
  `avatar_path`      VARCHAR(255) NULL COMMENT 'Ảnh học viên upload từ máy, lưu ngoài webroot - KHÔNG lưu URL',
  `deleted_at`       DATETIME NULL COMMENT 'Xoá mềm',
  `deleted_by`       INT UNSIGNED NULL,
  `created_by`       INT UNSIGNED NULL,
  `updated_by`       INT UNSIGNED NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_students_code` (`student_code`),
  UNIQUE KEY `uq_students_identity` (`identity_code`),
  KEY `idx_students_branch_status` (`branch_id`, `status`),
  KEY `idx_students_class` (`current_class_id`),
  KEY `idx_students_name` (`full_name`),
  KEY `idx_students_guardian_phone` (`guardian_phone`),
  KEY `idx_students_deleted` (`deleted_at`),
  CONSTRAINT `fk_students_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_students_class` FOREIGN KEY (`current_class_id`) REFERENCES `classes` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_students_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_students_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_students_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Hồ sơ học viên';

CREATE TABLE `student_class_histories` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id` INT UNSIGNED NOT NULL,
  `class_id`   INT UNSIGNED NOT NULL,
  `joined_at`  DATE NOT NULL,
  `left_at`    DATE NULL COMMENT 'NULL = còn học lớp này',
  `reason`     VARCHAR(255) NULL,
  `created_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sch_student` (`student_id`, `joined_at`),
  KEY `idx_sch_class` (`class_id`),
  CONSTRAINT `fk_sch_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sch_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sch_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch sử gán / chuyển lớp';

CREATE TABLE `student_branch_histories` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id`     INT UNSIGNED NOT NULL,
  `from_branch_id` INT UNSIGNED NOT NULL,
  `to_branch_id`   INT UNSIGNED NOT NULL,
  `moved_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reason`         VARCHAR(255) NULL,
  `performed_by`   INT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sbh_student` (`student_id`, `moved_at`),
  CONSTRAINT `fk_sbh_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sbh_from_branch` FOREIGN KEY (`from_branch_id`) REFERENCES `branches` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sbh_to_branch` FOREIGN KEY (`to_branch_id`) REFERENCES `branches` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sbh_performed_by` FOREIGN KEY (`performed_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch sử chuyển cơ sở';

-- ============================================================
-- SECTION: migrations/005_create_attendance.sql
-- ============================================================

-- ============================================================
-- 005 - Điểm danh: phiên điểm danh (buổi) + bản ghi điểm danh
-- ============================================================

CREATE TABLE `attendance_sessions` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id`    INT UNSIGNED NOT NULL,
  `class_id`     INT UNSIGNED NOT NULL,
  `session_date` DATE NOT NULL,
  `slot_name`    VARCHAR(50) NOT NULL DEFAULT 'Chính' COMMENT 'Tên ca/buổi (Chính, Sáng, Chiều, Tối...)',
  `is_locked`    TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = đã khoá sổ, không cho sửa',
  `locked_at`    DATETIME NULL,
  `locked_by`    INT UNSIGNED NULL,
  `created_by`   INT UNSIGNED NULL,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sessions_class_date_slot` (`class_id`, `session_date`, `slot_name`),
  KEY `idx_sessions_branch_date` (`branch_id`, `session_date`),
  CONSTRAINT `fk_sessions_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sessions_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sessions_locked_by` FOREIGN KEY (`locked_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_sessions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phiên điểm danh (một lớp, một ngày, một ca)';

CREATE TABLE `attendance` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `attendance_session_id` INT UNSIGNED NOT NULL,
  `student_id`            INT UNSIGNED NOT NULL,
  `status`                ENUM('present','excused_absent','unexcused_absent','late','planned_leave') NOT NULL
                            COMMENT 'Có mặt / Vắng có phép / Vắng không phép / Đi muộn / Nghỉ có kế hoạch',
  `note`                  VARCHAR(255) NULL COMMENT 'Lý do nghỉ / đi muộn',
  `recorded_by`           INT UNSIGNED NULL,
  `recorded_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_by`            INT UNSIGNED NULL,
  `updated_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attendance_session_student` (`attendance_session_id`, `student_id`),
  KEY `idx_attendance_student` (`student_id`, `status`),
  CONSTRAINT `fk_attendance_session` FOREIGN KEY (`attendance_session_id`) REFERENCES `attendance_sessions` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_recorded_by` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bản ghi điểm danh từng học viên trong phiên';

-- ============================================================
-- SECTION: migrations/006_create_tuition.sql
-- ============================================================

-- ============================================================
-- 006 - Học phí: bảng thu theo kỳ, giảm trừ, thanh toán
-- Công thức không cố định trong CSDL: quy định tính tiền lưu ở
-- system_settings để Admin tự cấu hình (xem migration 007).
-- ============================================================

CREATE TABLE `tuition_records` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id`       INT UNSIGNED NOT NULL,
  `branch_id`        INT UNSIGNED NOT NULL COMMENT 'Snapshot cơ sở tại kỳ thu',
  `period_year`      SMALLINT UNSIGNED NOT NULL,
  `period_month`     TINYINT UNSIGNED NOT NULL COMMENT '1-12',
  `base_amount`      DECIMAL(12,0) NOT NULL DEFAULT 0 COMMENT 'Học phí thoả thuận chốt tại kỳ',
  `present_days`     TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số ngày có mặt trong kỳ',
  `absent_days`      TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Số ngày nghỉ trong kỳ',
  `deduction_amount` DECIMAL(12,0) NOT NULL DEFAULT 0 COMMENT 'Tổng giảm trừ của kỳ',
  `final_amount`     DECIMAL(12,0) NOT NULL DEFAULT 0 COMMENT 'Số phải thu sau giảm trừ',
  `paid_amount`      DECIMAL(12,0) NOT NULL DEFAULT 0 COMMENT 'Tổng đã thu (cập nhật trong transaction)',
  `status`           ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  `note`             VARCHAR(255) NULL,
  `created_by`       INT UNSIGNED NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tuition_student_period` (`student_id`, `period_year`, `period_month`),
  KEY `idx_tuition_branch_period` (`branch_id`, `period_year`, `period_month`, `status`),
  CONSTRAINT `fk_tuition_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_tuition_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_tuition_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Học phí từng học viên theo kỳ tháng';

CREATE TABLE `tuition_adjustments` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tuition_record_id` BIGINT UNSIGNED NOT NULL,
  `amount`           DECIMAL(12,0) NOT NULL COMMENT 'Số tiền giảm trừ (đồng)',
  `reason`           VARCHAR(255) NOT NULL,
  `created_by`       INT UNSIGNED NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tuition_adj_record` (`tuition_record_id`),
  CONSTRAINT `fk_tuition_adj_record` FOREIGN KEY (`tuition_record_id`) REFERENCES `tuition_records` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_tuition_adj_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Các khoản giảm trừ học phí';

CREATE TABLE `tuition_payments` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tuition_record_id` BIGINT UNSIGNED NOT NULL,
  `amount`           DECIMAL(12,0) NOT NULL,
  `paid_on`          DATE NOT NULL,
  `method`           ENUM('cash','transfer','other') NOT NULL DEFAULT 'cash',
  `note`             VARCHAR(255) NULL,
  `received_by`      INT UNSIGNED NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tuition_pay_record` (`tuition_record_id`, `paid_on`),
  CONSTRAINT `fk_tuition_pay_record` FOREIGN KEY (`tuition_record_id`) REFERENCES `tuition_records` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_tuition_pay_received_by` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phiếu thu học phí (cho phép thu nhiều lần)';

-- ============================================================
-- SECTION: migrations/007_create_logs_settings.sql
-- ============================================================

-- ============================================================
-- 007 - Nhật ký hoạt động + cấu hình hệ thống
-- ============================================================

CREATE TABLE `activity_logs` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED NULL,
  `action`      VARCHAR(50) NOT NULL COMMENT 'login/logout/create/update/delete/restore/lock/unlock/collect/import/export...',
  `module`      VARCHAR(50) NOT NULL COMMENT 'students, classes, attendance, tuition, staff, branches, settings...',
  `target_type` VARCHAR(50) NULL COMMENT 'student, attendance, tuition_record...',
  `target_id`   BIGINT UNSIGNED NULL,
  `description` VARCHAR(255) NULL,
  `old_values`  JSON NULL COMMENT 'Giá trị trước khi sửa (lịch sử chỉnh sửa hồ sơ/điểm danh)',
  `new_values`  JSON NULL COMMENT 'Giá trị sau khi sửa',
  `ip_address`  VARCHAR(45)  NULL,
  `user_agent`  VARCHAR(255) NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity_user_time` (`user_id`, `created_at`),
  KEY `idx_activity_module_target` (`module`, `target_type`, `target_id`),
  KEY `idx_activity_time` (`created_at`),
  CONSTRAINT `fk_activity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Nhật ký thao tác toàn hệ thống';

CREATE TABLE `system_settings` (
  `id`            SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `setting_key`   VARCHAR(100) NOT NULL COMMENT 'vd: tuition.rule (quy định tính học phí do Admin nhập)',
  `setting_value` TEXT NULL COMMENT 'Giá trị, có thể là JSON tuỳ quy định',
  `setting_group` VARCHAR(50) NOT NULL DEFAULT 'general',
  `description`   VARCHAR(255) NULL,
  `updated_by`    INT UNSIGNED NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settings_key` (`setting_key`),
  KEY `idx_settings_group` (`setting_group`),
  CONSTRAINT `fk_settings_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cấu hình hệ thống (quy định học phí...)';

-- ============================================================
-- SECTION: migrations/008_alter_students_add_left_at.sql
-- ============================================================

-- ============================================================
-- 008 - Bổ sung ngày nghỉ học cho học viên
-- Cần cho báo cáo biến động (danh sách học viên đã nghỉ theo tháng)
-- ============================================================

ALTER TABLE `students`
  ADD COLUMN `left_at` DATE NULL COMMENT 'Ngày nghỉ học (gán khi chuyển status = left)' AFTER `status`;

-- ============================================================
-- SECTION: seeds/001_seed_branches.sql
-- ============================================================

-- ============================================================
-- SEED 001 - Hai cơ sở thực tế của trung tâm
-- Chạy SAU khi đã import đủ migrations 001 -> 007
-- ============================================================

INSERT INTO `branches` (`code`, `name`, `status`) VALUES
('TN', 'Cơ sở Tân Nhựt', 'active'),
('CL', 'Cơ sở Càng Long', 'active');

-- ============================================================
-- SECTION: seeds/002_seed_roles_permissions.sql
-- ============================================================

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

-- ============================================================
-- SECTION: seeds/003_seed_super_admin.sql
-- ============================================================

-- ============================================================
-- SEED 003 - Tài khoản Super Admin đầu tiên (CHỈ DÙNG KHI PHÁT TRIỂN)
-- Chạy SAU 002_seed_roles_permissions.sql
--
-- Tài khoản chưa thể đăng nhập cho đến khi được gán email Google của Admin.
-- ============================================================

INSERT INTO `users` (`role_id`, `username`, `email`, `password_hash`, `full_name`, `status`)
SELECT r.`id`, NULL, NULL, NULL,
       'Quản trị hệ thống', 'active'
FROM `roles` r
WHERE r.`role_key` = 'super_admin';

-- ============================================================
-- SECTION: seeds/004_seed_dev_admin_password.sql
-- ============================================================

-- ============================================================
-- SEED 004 - Mật khẩu dev cho Super Admin (CHỈ DÙNG KHI PHÁT TRIỂN)
-- Tên đăng nhập: admin · Mật khẩu: Admin@123
-- ============================================================

UPDATE `users` u
JOIN `roles` r ON r.`id` = u.`role_id`
SET u.`username` = 'admin',
    u.`password_hash` = '$2y$10$S.bbKciw8gDMEr0/xKOc5ehPm10LblmSwaFrfSsAhqEseccbYmvSa'
WHERE r.`role_key` = 'super_admin'
  AND u.`username` IS NULL
  AND u.`password_hash` IS NULL;
