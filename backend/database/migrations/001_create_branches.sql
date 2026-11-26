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
