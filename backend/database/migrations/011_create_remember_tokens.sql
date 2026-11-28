-- ============================================================
-- 011 - Token giữ đăng nhập nhiều ngày trên thiết bị cá nhân
-- Không tốn RAM máy chủ; chỉ lưu hash SHA-256 của validator.
-- Tự vô hiệu hoá ngay khi đăng xuất, đổi mật khẩu, hoặc khoá tài khoản.
-- ============================================================

CREATE TABLE IF NOT EXISTS `user_remember_tokens` (
  `id`                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`              INT UNSIGNED    NOT NULL,
  `selector`             VARCHAR(64)     NOT NULL COMMENT 'Định danh công khai của token trên thiết bị',
  `token_hash`           CHAR(64)        NOT NULL COMMENT 'SHA-256 của validator (không lưu token gốc)',
  `password_fingerprint` CHAR(64)        NOT NULL COMMENT 'SHA-256 của password_hash lúc cấp token',
  `branch_id`            INT UNSIGNED    NULL     COMMENT 'Cơ sở làm việc gần nhất trên thiết bị',
  `ip_address`           VARCHAR(45)     NULL,
  `user_agent`           VARCHAR(255)    NULL,
  `last_used_at`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at`           DATETIME        NOT NULL,
  `created_at`           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_remember_selector` (`selector`),
  KEY `idx_remember_user` (`user_id`),
  KEY `idx_remember_expires` (`expires_at`),
  CONSTRAINT `fk_remember_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_remember_tokens_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Token giữ đăng nhập nhiều ngày trên thiết bị cá nhân';
