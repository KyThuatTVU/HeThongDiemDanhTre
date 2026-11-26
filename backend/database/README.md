# Database HappyKidsCK — hướng dẫn import

CSDL: `happykidsck` · MySQL/MariaDB (XAMPP) · InnoDB · utf8mb4 · utf8mb4_unicode_ci

## Cách nhanh nhất: import 1 file duy nhất

Import file `happykidsck_full.sql` (đã gồm toàn bộ 19 bảng + seed, tự tạo database `happykidsck`).
Chỉ cần: phpMyAdmin → tab **Import** → chọn file → **Go**.

Muốn chạy từng bước để kiểm soát (hoặc dùng cho migrate runner sau này) thì dùng bảng thứ tự bên dưới.

## Thứ tự import (bắt buộc)

| Bước | File | Nội dung |
|---|---|---|
| 1 | `migrations/000_create_database.sql` | Tạo database `happykidsck` |
| 2 | `migrations/001_create_branches.sql` | Cơ sở |
| 3 | `migrations/002_create_auth_tables.sql` | Vai trò, quyền, tài khoản, phân công cơ sở, lịch sử đăng nhập |
| 4 | `migrations/003_create_classes.sql` | Lớp học |
| 5 | `migrations/004_create_students.sql` | Học viên + lịch sử chuyển lớp / chuyển cơ sở |
| 6 | `migrations/005_create_attendance.sql` | Phiên điểm danh + điểm danh |
| 7 | `migrations/006_create_tuition.sql` | Học phí, giảm trừ, thanh toán |
| 8 | `migrations/007_create_logs_settings.sql` | Nhật ký hoạt động + cấu hình |
| 9 | `migrations/008_alter_students_add_left_at.sql` | Thêm cột `students.left_at` (ngày nghỉ học, phục vụ báo cáo biến động) |
| 10 | `migrations/009_create_user_permissions.sql` | Quyền riêng của từng nhân viên (cấp thêm / thu hồi so với vai trò) |
| 11 | `seeds/001_seed_branches.sql` | 2 cơ sở: Tân Nhựt, Càng Long |
| 12 | `seeds/002_seed_roles_permissions.sql` | 4 vai trò + 29 quyền + gán quyền |
| 13 | `seeds/003_seed_super_admin.sql` | Tài khoản Super Admin (chờ gán email Google) |
| 14 | `seeds/004_seed_dev_admin_password.sql` | Mật khẩu dev `admin / Admin@123` cho Super Admin (dev-only) |
| 15 | `seeds/005_assign_google_admin.sql` | Gán email Google duy nhất được đăng nhập admin |

## Cách import bằng phpMyAdmin

1. Mở `http://localhost/phpmyadmin` → tab **Import**.
2. Import `000_create_database.sql`.
3. Bấm chọn database `happykidsck` ở cột trái.
4. Lần lượt **Import** các file từ bước 2 đến bước 12 (mỗi lần import 1 file).
5. Charset để mặc định `utf-8` — file đã khai báo utf8mb4.

## Import bằng dòng lệnh (nếu cần)

Di chuyển vào thư mục này và chạy lần lượt theo bảng trên, ví dụ:

`mysql -u root -p happykidsck < migrations/001_create_branches.sql`

## Lưu ý

- **Đã import CSDL trước bản cập nhật này?** Chỉ cần chạy thêm `migrations/008_alter_students_add_left_at.sql` (nếu chưa có cột `left_at`), `migrations/009_create_user_permissions.sql` (bảng quyền riêng từng nhân viên) và `seeds/005_assign_google_admin.sql` (gán email Google cho tài khoản `admin`). Không cần import lại. File `happykidsck_full.sql` đã bao gồm các thay đổi cho lần import mới.
- Để đăng nhập khi phát triển, chạy thêm `seeds/004_seed_dev_admin_password.sql` — tạo tài khoản `admin / Admin@123` cho Super Admin (chỉ khi tài khoản còn trống). Trước khi vận hành thật hãy đổi mật khẩu và gán email Google bằng `seeds/005_assign_google_admin.sql`.
- Muốn làm lại từ đầu: `DROP DATABASE happykidsck;` rồi import lại (chỉ làm khi chưa có dữ liệu thật).
- Nếu đổi tên database, cập nhật `backend/config/database.php` ở giai đoạn 3.
