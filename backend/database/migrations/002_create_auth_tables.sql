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
