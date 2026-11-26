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
