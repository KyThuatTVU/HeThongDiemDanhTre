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
