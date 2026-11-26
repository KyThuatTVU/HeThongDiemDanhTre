-- ============================================================
-- SEED 004 - Mật khẩu dev cho Super Admin (CHỈ DÙNG KHI PHÁT TRIỂN)
-- Chạy SAU 003_seed_super_admin.sql
--
-- Đặt tài khoản Super Admin đang trống (username/password NULL) thành:
--   Tên đăng nhập: admin
--   Mật khẩu:      Admin@123
-- Chỉ áp dụng khi tài khoản chưa có username/mật khẩu; không ghi đè
-- tài khoản thật đã được cấu hình.
-- ============================================================

UPDATE `users` u
JOIN `roles` r ON r.`id` = u.`role_id`
SET u.`username` = 'admin',
    u.`password_hash` = '$2y$10$S.bbKciw8gDMEr0/xKOc5ehPm10LblmSwaFrfSsAhqEseccbYmvSa'
WHERE r.`role_key` = 'super_admin'
  AND u.`username` IS NULL
  AND u.`password_hash` IS NULL;
