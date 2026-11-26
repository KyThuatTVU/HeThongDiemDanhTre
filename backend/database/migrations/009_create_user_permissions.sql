-- ============================================================
-- 009 - Quyền riêng của từng nhân viên (ghi đè theo vai trò)
-- Cho phép Admin cấp thêm (allow) hoặc thu hồi (deny) quyền của
-- từng tài khoản so với quyền mặc định của vai trò.
-- Quyền hiệu lực = quyền vai trò + allow - deny.
-- ============================================================

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
