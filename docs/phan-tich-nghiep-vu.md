# Phân tích nghiệp vụ — Hệ thống quản lý học viên & điểm danh HappyKidsCK

Tài liệu Giai đoạn 1. Nguồn: `Yeucauhethong.md`. Đối tượng: 2 cơ sở Tân Nhựt và Càng Long.

## 1. Mục tiêu & phạm vi

- Thay thế quản lý bằng Excel hiện tại bằng phần mềm web tập trung: hồ sơ học viên, lớp học, điểm danh, học phí, nhân viên, báo cáo, nhật ký.
- Dữ liệu 2 cơ sở tách biệt nhưng dùng chung một hệ thống; Admin xem/quản lý toàn bộ.
- Bảo mật dữ liệu trẻ em (thông tin cá nhân, CCCD), vận hành thực tế ổn định, có khả năng mở rộng.
- Công nghệ: PHP thuần MVC + PDO MySQL, Bootstrap 5 self-host, JS thuần, Chart.js, PhpSpreadsheet, Dompdf, Google OAuth 2.0.

## 2. Tác nhân & phạm vi quyền

| Vai trò | Quyền chính | Phạm vi cơ sở |
|---|---|---|
| Super Admin | Toàn quyền: cơ sở, nhân viên, cấu hình, chuyển đổi giữa 2 cơ sở | Cả 2 cơ sở |
| Quản lý cơ sở | Quản lý dữ liệu cơ sở được giao: học viên, lớp, điểm danh (kể cả sửa/khoá sổ), học phí, báo cáo | Cơ sở được phân công |
| Nhân viên điểm danh | Điểm danh, xem danh sách trẻ, xem lịch sử điểm danh | Cơ sở được phân công |
| Nhân viên hồ sơ | Thêm/sửa hồ sơ, import/export danh sách, xem lớp | Cơ sở được phân công |

- Admin (Super Admin) đăng nhập bằng **Google OAuth 2.0**, chỉ tài khoản Google được chỉ định (email đã khai báo trong hệ thống).
- Nhân viên đăng nhập bằng tài khoản/mật khẩu do Admin cấp; tài khoản có thể bị khoá/mở.
- Một nhân viên được phân công 1 hoặc 2 cơ sở; phiên làm việc gắn "cơ sở đang làm việc".
- Kiểm tra quyền ở **cả giao diện lẫn backend** — không chỉ ẩn nút.

## 3. Phân hệ chức năng

### 3.1. Đăng nhập & phân quyền
Google OAuth cho Admin (allowlist email), đăng nhập nội bộ cho nhân viên, quản lý phiên, đăng xuất, khoá/mở tài khoản, phân quyền theo vai trò + theo cơ sở, nhật ký đăng nhập.

### 3.2. Quản lý cơ sở
Thông tin 2 cơ sở (mã, tên, địa chỉ, điện thoại, logo), nhân viên từng cơ sở, thống kê riêng từng cơ sở, chuyển đổi cơ sở làm việc.

### 3.3. Quản lý hồ sơ học viên (phân hệ trọng tâm)
13 trường dữ liệu bắt buộc (giữ đúng tên trường theo yêu cầu — xem ánh xạ CSDL), ảnh học viên upload từ máy. Chức năng: thêm, sửa, xoá mềm/khôi phục, xem chi tiết, tìm kiếm, lọc theo lớp/cơ sở/trạng thái, import/export Excel, lưu lịch sử chỉnh sửa, chuyển giữa 2 cơ sở, quản lý trạng thái đang học / tạm nghỉ / đã nghỉ.

### 3.4. Quản lý lớp học
Thêm/sửa lớp, ngừng hoạt động, gán và chuyển lớp cho học viên, xem danh sách học viên theo lớp, thống kê số lượng, lưu lịch sử chuyển lớp.

### 3.5. Điểm danh
Chọn cơ sở → ngày → lớp → ca/buổi; hiển thị danh sách, điểm danh từng học viên hoặc tất cả có mặt, sửa theo quyền, ghi lý do nghỉ, tìm kiếm, lịch sử điểm danh, lưu người thực hiện + thời gian, khoá dữ liệu khi hoàn tất.
Trạng thái: Có mặt, Vắng có phép, Vắng không phép, Đi muộn, Nghỉ có kế hoạch. Chống trùng: mỗi học viên tối đa 1 bản ghi trong 1 phiên (lớp + ngày + ca).

### 3.6. Quản lý học phí
Học phí thoả thuận theo tháng của từng học viên. Quy định tính tiền do **Admin cấu hình** (không hard-code công thức): lưu trong `system_settings`. Theo dõi ngày có mặt/nghỉ trong kỳ, giảm trừ, tổng phải thu, đã thu/chưa thu, ngày thanh toán (cho phép thu nhiều lần), ghi chú, xuất bảng học phí tháng và báo cáo gửi phụ huynh (Excel/PDF).

### 3.7. Quản lý nhân viên
Thêm/sửa nhân viên, tạo tài khoản, phân quyền, phân công cơ sở, khoá/mở, đặt lại mật khẩu, xem lịch sử đăng nhập, theo dõi thao tác điểm danh và chỉnh sửa hồ sơ.

### 3.8. Dashboard & báo cáo
Dashboard: tổng/đang học/tạm nghỉ/đã nghỉ, có mặt – vắng hôm nay, tỷ lệ chuyên cần, thống kê và so sánh 2 cơ sở. Báo cáo: danh sách học viên, điểm danh, chuyên cần tháng, học viên nghỉ học, học phí, biến động học viên — hỗ trợ Excel và PDF.

### 3.9. Nhật ký & sao lưu
Lịch sử đăng nhập, lịch sử thêm/sửa/xoá hồ sơ, lịch sử chỉnh sửa điểm danh, người + thời gian thao tác; sao lưu CSDL định kỳ và phục hồi.

## 4. Quy tắc nghiệp vụ then chốt

1. Mã học viên duy nhất toàn hệ thống; mỗi học viên thuộc đúng 1 cơ sở tại một thời điểm.
2. Điểm danh duy nhất theo (phiên = lớp + ngày + ca, học viên); sổ đã khoá thì chỉ người có quyền `attendance.edit`/`attendance.lock` mới mở lại, mọi thay đổi ghi nhật ký.
3. Chuyển lớp: đóng lịch sử lớp cũ (`left_at`), mở lịch sử lớp mới, cập nhật `students.current_class_id` — trong cùng transaction.
4. Chuyển cơ sở: ghi `student_branch_histories`, cập nhật cơ sở + đóng lớp cũ nếu lớp thuộc cơ sở cũ, giữ nguyên lịch sử điểm danh/học phí cũ (snapshot).
5. Học phí: chốt `base_amount` tại kỳ, giảm trừ là các bản ghi riêng, `paid_amount`/`status` cập nhật trong transaction khi thu tiền; không xoá cứng dữ liệu tài chính.
6. Xoá mềm học viên (`deleted_at`), có khôi phục; không xoá lịch sử quan trọng.
7. Phân quyền kép: vai trò (permissions) + phạm vi cơ sở (user_branches) kiểm tra ở middleware backend.
8. Mọi thao tác quan trọng ghi `activity_logs` (ai, làm gì, khi nào, giá trị cũ/mới).

## 5. Dữ liệu & bảo mật

- PDO prepared statements; validate đầu vào; CSRF cho mọi form/AJAX thay đổi dữ liệu; escape output chống XSS; `password_hash`/`password_verify`.
- Ảnh (học viên, nhân viên, logo cơ sở): **upload từ máy** (file input), không lưu URL; validate đuôi + MIME + dung lượng (≤ 2MB), đổi tên ngẫu nhiên, lưu ngoài webroot; hiển thị qua controller có kiểm quyền.
- CCCD/mã định danh: chỉ vai trò có quyền hồ sơ được xem; có thể che một phần trên danh sách (giai đoạn UI).
- Backup: dump định kỳ ra `storage/backups/`, ngoài webroot.

## 6. Điểm cần Admin xác nhận (chưa chốt)

1. Email Google của Admin được phép đăng nhập OAuth + Google Client ID/Secret (đưa vào `.env`).
2. Quy định tính học phí thực tế (đơn giá, miễn giảm ngày nghỉ, làm tròn) — sẽ nhập vào `system_settings` qua giao diện Admin.
3. Số ca/buổi mỗi ngày của trung tâm (mặc định 1 ca tên "Chính"; tên ca nhập được, không cố định trong code).
4. Quy tắc sinh Mã HV (tự sinh theo cơ sở hay nhập tay) và định dạng.
5. Lịch sao lưu định kỳ (hàng ngày/tuần) và nơi lưu bản sao.

## 7. Đối chiếu 10 giai đoạn triển khai

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 1 | Phân tích nghiệp vụ | ✅ tài liệu này |
| 2 | ERD + CSDL MySQL | ✅ `docs/thiet-ke-co-so-du-lieu.md` + `backend/database/` |
| 3 | Khung PHP MVC + đăng nhập | chờ duyệt |
| 4 | Phân quyền + quản lý cơ sở | chưa |
| 5 | Hồ sơ học viên + lớp học | chưa |
| 6 | Điểm danh | chưa |
| 7 | Học phí | chưa |
| 8 | Dashboard + báo cáo | chưa |
| 9 | Kiểm thử, bảo mật, tối ưu | chưa |
| 10 | Triển khai hosting/VPS | chưa |
