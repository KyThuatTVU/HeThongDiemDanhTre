-- ============================================================
-- SEED 005 - Gán email Google duy nhất cho tài khoản Super Admin
-- Chạy SAU 003_seed_super_admin.sql và sau khi tạo mật khẩu bằng
-- backend/bin/reset-admin-password.php (username mặc định: admin)
--
-- Tài khoản `admin` sẽ dùng email này để đăng nhập Google.
-- `google_id` được xoá để lần đăng nhập Google đầu tiên liên kết
-- đúng tài khoản Google đã cấu hình trong GOOGLE_ALLOWED_EMAILS.
--
-- Lưu ý: chỉ chạy khi đã đối chiếu đúng tài khoản `admin`.
-- ============================================================

UPDATE `users` u
JOIN `roles` r ON r.`id` = u.`role_id`
SET u.`email` = 'dothienvu84tv@gmail.com',
    u.`google_id` = NULL
WHERE r.`role_key` = 'super_admin'
  AND u.`username` = 'admin';
