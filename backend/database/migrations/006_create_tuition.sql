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
