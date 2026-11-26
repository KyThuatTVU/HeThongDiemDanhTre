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
