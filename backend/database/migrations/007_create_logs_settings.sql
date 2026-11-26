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
