# Database HappyKidsCK — hướng dẫn import

CSDL: `happykidsck` · MySQL/MariaDB · InnoDB · utf8mb4 · utf8mb4_unicode_ci

## Đưa lên Hosting (ByetHost / cPanel / DirectAdmin) — 1 lần bấm là vào

Không cần xóa CSDL hay xóa bảng cũ thủ công. Trên phpMyAdmin của hosting: **bấm chọn database của bạn ở cột trái** → tab **Import** → chọn 1 trong 2 tệp dưới đây → **Go**:

1. **`happykidsck_hosting_deploy.sql` (Khuyên dùng lần đầu đưa lên host / đồng bộ đè toàn bộ)**
   - Không chứa `CREATE DATABASE`, `USE`, `LOCK TABLES` (tránh lỗi phân quyền hosting).
   - Tự chuẩn hóa tương thích cả **MariaDB 10.2+** lẫn **MySQL 5.7 / 8.0+**.
   - Tự `DROP TABLE IF EXISTS` + tạo lại đủ 19 bảng + nạp toàn bộ dữ liệu thật (2 cơ sở, 7 lớp, 4 tài khoản, phân quyền, 87 học viên) và bỏ qua nhật ký test trên máy local.
   - ⚠️ **Lưu ý**: Chỉ dùng lần đầu hoặc khi muốn ghi đè toàn bộ từ máy lên host (không dùng sau khi giáo viên đã bắt đầu chấm điểm danh thật trên host).

2. **`happykidsck_hosting_safe_sync.sql` (Đồng bộ an toàn — KHÔNG mất dữ liệu cũ trên host)**
   - Dùng `CREATE TABLE IF NOT EXISTS` + `INSERT ... ON DUPLICATE KEY UPDATE` cho danh mục/hồ sơ (cơ sở, lớp, tài khoản, phân quyền, học viên).
   - **Không đụng tới** điểm danh (`attendance*`), học phí (`tuition_*`) và nhật ký đang có trên host.
   - Có thể import lặp lại nhiều lần trên host đang chạy thật mà không báo lỗi trùng khóa hay mất dữ liệu điểm danh.

### Xuất lại 2 tệp SQL hosting sau khi chỉnh sửa dữ liệu trên máy local
```bash
D:\xampp\php\php.exe backend/bin/export-hosting-sql.php
```
(Thêm `--include-logs` nếu muốn chép kèm cả nhật ký hoạt động & lịch sử đăng nhập.)

---

## Cách nhanh cho máy local (XAMPP): import 1 file duy nhất

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
| 14 | `seeds/005_assign_google_admin.sql` | Gán email Google duy nhất được đăng nhập admin |

Sau khi import, tạo mật khẩu super-admin bằng CLI (mật khẩu ngẫu nhiên in ra một lần):

`php backend/bin/reset-admin-password.php --username=admin --email=dothienvu84tv@gmail.com`

## Cách import bằng phpMyAdmin

1. Mở `http://localhost/phpmyadmin` → tab **Import**.
2. Import `000_create_database.sql`.
3. Bấm chọn database `happykidsck` ở cột trái.
4. Lần lượt **Import** các file từ bước 2 đến bước 14 (mỗi lần import 1 file).
5. Charset để mặc định `utf-8` — file đã khai báo utf8mb4.

## Import bằng dòng lệnh (nếu cần)

Di chuyển vào thư mục này và chạy lần lượt theo bảng trên, ví dụ:

`mysql -u root -p happykidsck < migrations/001_create_branches.sql`

## Lưu ý

- **Đã import CSDL trước bản cập nhật này?** Chỉ cần chạy thêm `migrations/008_alter_students_add_left_at.sql` (nếu chưa có cột `left_at`), `migrations/009_create_user_permissions.sql` (bảng quyền riêng từng nhân viên) và `seeds/005_assign_google_admin.sql` (gán email Google cho tài khoản `admin`). Không cần import lại. File `happykidsck_full.sql` đã bao gồm các thay đổi cho lần import mới.
- Không còn seed mật khẩu mặc định. Chạy `php backend/bin/reset-admin-password.php` để đặt mật khẩu super-admin; công cụ sinh mật khẩu mạnh và chỉ in ra một lần. Gán email Google bằng `seeds/005_assign_google_admin.sql`.
- Muốn làm lại từ đầu: `DROP DATABASE happykidsck;` rồi import lại (chỉ làm khi chưa có dữ liệu thật).
- Nếu đổi tên database, cập nhật `backend/config/database.php` ở giai đoạn 3.
