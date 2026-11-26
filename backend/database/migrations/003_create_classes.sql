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
