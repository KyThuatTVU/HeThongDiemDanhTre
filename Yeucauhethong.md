\# PROMPT XÂY DỰNG HỆ THỐNG QUẢN LÝ HỌC VIÊN VÀ ĐIỂM DANH HAPPYKIDSCK



\## 1. VAI TRÒ CỦA AI



Bạn là Senior Full-stack Developer, Software Architect và chuyên gia phân tích thiết kế hệ thống quản lý giáo dục.



Nhiệm vụ của bạn là phân tích, thiết kế và phát triển một hệ thống quản lý học viên, hồ sơ trẻ, điểm danh và học phí cho Trung tâm HappyKidsCK.



Đây là dự án triển khai thực tế, thay thế phương thức quản lý dữ liệu bằng Excel hiện tại.



Yêu cầu: Phần mềm phải hoạt động ổn định, giao diện chuyên nghiệp, dễ sử dụng, bảo mật dữ liệu trẻ em và có khả năng mở rộng.



\## 2. THÔNG TIN DỰ ÁN



Tên dự án: Hệ thống quản lý học viên và điểm danh HappyKidsCK.



Hệ thống quản lý tập trung hai cơ sở:



\- Cơ sở Tân Nhựt.

\- Cơ sở Càng Long.



Mỗi cơ sở có dữ liệu học viên, nhân viên và điểm danh riêng. Admin có thể quản lý toàn bộ dữ liệu của cả hai cơ sở.



\## 3. CÔNG NGHỆ BẮT BUỘC



\### Frontend



\- HTML5.

\- CSS3.

\- JavaScript thuần (Vanilla JavaScript).

\- Bootstrap 5.

\- Bootstrap Icons.

\- AJAX / Fetch API khi cần xử lý dữ liệu bất đồng bộ.

\- Chart.js để hiển thị biểu đồ thống kê.



\### Backend



\- PHP.

\- Kiến trúc MVC (Model - View - Controller).

\- PHP thuần theo mô hình MVC.

\- PDO để kết nối MySQL.

\- RESTful API nội bộ khi cần thiết.



\### Database



\- MySQL.

\- Thiết kế quan hệ dữ liệu rõ ràng.

\- Sử dụng khóa chính, khóa ngoại và Index phù hợp.

\- Hỗ trợ Transaction đối với các nghiệp vụ quan trọng.



\### Thư viện hỗ trợ



\- Google OAuth 2.0: Đăng nhập Admin bằng Google.

\- PhpSpreadsheet: Import và Export Excel.

\- Dompdf: Xuất báo cáo PDF.

\- Chart.js: Biểu đồ thống kê.



\### Quy định công nghệ



KHÔNG sử dụng:



\- React.

\- Vue.js.

\- Angular.

\- Node.js.

\- Laravel.

\- Các framework frontend/backend thay thế kiến trúc đã chỉ định.



Không tự ý thay đổi stack công nghệ.



\## 4. CÁC PHÂN HỆ CHỨC NĂNG



\### 4.1. Đăng nhập và phân quyền



\- Admin đăng nhập bằng Google OAuth 2.0.

\- Chỉ cho phép tài khoản Google được Admin chỉ định.

\- Admin tạo tài khoản và mật khẩu cho nhân viên.

\- Nhân viên đăng nhập bằng tài khoản được cấp.

\- Quản lý phiên đăng nhập và đăng xuất.

\- Khóa và mở khóa tài khoản.

\- Phân quyền theo vai trò.

\- Phân quyền theo cơ sở.

\- Một nhân viên có thể được phân công một hoặc hai cơ sở.



Các vai trò:



1\. Super Admin: Toàn quyền hệ thống.

2\. Quản lý cơ sở: Quản lý dữ liệu cơ sở được giao.

3\. Nhân viên điểm danh: Thực hiện điểm danh và xem danh sách trẻ.

4\. Nhân viên hồ sơ: Quản lý hồ sơ theo quyền được cấp.



Phải kiểm tra quyền ở cả giao diện và Backend. Không được chỉ ẩn nút chức năng để thay thế kiểm tra quyền.



\### 4.2. Quản lý cơ sở



\- Quản lý cơ sở Tân Nhựt.

\- Quản lý cơ sở Càng Long.

\- g ứng.

\- QuảChọn cổng làm việc tươnn lý dữ liệu từng cơ sở.

\- Quản lý nhân viên từng cơ sở.

\- Thống kê riêng từng cơ sở.

\- Admin có thể chuyển đổi giữa hai cơ sở.



\### 4.3. Quản lý hồ sơ học viên



Đây là phân hệ quan trọng.



Phải sử dụng đúng các trường dữ liệu sau:



1\. Mã HV.

2\. Họ và Tên Học Viên.

3\. Ngày Sinh.

4\. Giới Tính.

5\. Hình Thức / Lớp Học.

6\. Mức Học Phí Thỏa Thuận (đ/tháng).

7\. Họ Tên Phụ Huynh.

8\. Số Điện Thoại Liên Hệ.

9\. Địa Chỉ Thường Trú.

10\. Ngày Nhập Học.

11\. Trạng Thái Học.

12\. Ghi Chú Hồ Sơ / Chuyên Cần.

13\. Mã Định Danh (CCCD / ĐD).



STT được tạo tự động.



Các chức năng:



\- Thêm học viên.

\- Sửa hồ sơ.

\- Xóa mềm và khôi phục.

\- Xem chi tiết hồ sơ.

\- Tìm kiếm học viên.

\- Lọc theo lớp, cơ sở và trạng thái.

\- Import Excel.

\- Export Excel.

\- Lưu lịch sử chỉnh sửa.

\- Chuyển học viên giữa hai cơ sở.

\- Quản lý trạng thái đang học, tạm nghỉ, đã nghỉ.



Không tự ý bỏ hoặc thay đổi các trường dữ liệu đã được quy định.



\### 4.4. Quản lý lớp học



\- Thêm lớp.

\- Sửa lớp.

\- Ngừng hoạt động lớp.

\- Gán học viên vào lớp.

\- Chuyển lớp.

\- Xem danh sách học viên theo lớp.

\- Thống kê số lượng học viên.

\- Lưu lịch sử chuyển lớp.



\### 4.5. Quản lý điểm danh



Các chức năng:



\- Chọn cơ sở.

\- Chọn ngày.

\- Chọn lớp.

\- Hiển thị danh sách học viên.

\- Điểm danh từng học viên.

\- Điểm danh tất cả có mặt.

\- Cập nhật trạng thái.

\- Ghi chú lý do nghỉ.

\- Tìm kiếm học viên.

\- Chỉnh sửa điểm danh theo quyền.

\- Xem lịch sử điểm danh.

\- Lưu người thực hiện và thời gian.

\- Khóa dữ liệu điểm danh khi hoàn tất.



Các trạng thái:



\- Có mặt.

\- Vắng có phép.

\- Vắng không phép.

\- Đi muộn.

\- Nghỉ có kế hoạch.



Phải tránh trùng lặp dữ liệu điểm danh của một học viên trong cùng một ngày/buổi học.



\### 4.6. Quản lý học phí



Học phí được thỏa thuận theo tháng.



Các chức năng:



\- Quản lý học phí từng học viên.

\- Thống kê số ngày có mặt.

\- Thống kê số ngày nghỉ.

\- Quản lý mức giảm trừ.

\- Cho phép Admin nhập quy định tính học phí.

\- Tính tổng học phí phải thu theo quy định.

\- Theo dõi đã thu/chưa thu.

\- Ghi nhận ngày thanh toán.

\- Ghi chú học phí.

\- Xuất bảng học phí theo tháng.

\- Xuất báo cáo gửi phụ huynh.



Lưu ý: Không tự đặt công thức tính học phí cố định. Phải thiết kế dữ liệu linh hoạt để Admin cấu hình quy định tính tiền. Ngày nghỉ được xử lý theo quy định giảm trừ của trung tâm.



\### 4.7. Quản lý nhân viên



\- Thêm nhân viên.

\- Chỉnh sửa thông tin.

\- Tạo tài khoản đăng nhập.

\- Phân quyền.

\- Phân công cơ sở.

\- Khóa/mở tài khoản.

\- Đặt lại mật khẩu.

\- Xem lịch sử đăng nhập.

\- Theo dõi thao tác điểm danh.

\- Theo dõi thao tác chỉnh sửa hồ sơ.



\### 4.8. Dashboard và báo cáo



Dashboard Admin:



\- Tổng số học viên.

\- Số học viên đang học.

\- Số học viên tạm nghỉ.

\- Số học viên đã nghỉ.

\- Số học viên có mặt hôm nay.

\- Số học viên vắng hôm nay.

\- Tỷ lệ chuyên cần.

\- Thống kê từng cơ sở.

\- So sánh hai cơ sở.



Báo cáo:



\- Danh sách học viên.

\- Báo cáo điểm danh.

\- Báo cáo chuyên cần theo tháng.

\- Báo cáo học viên nghỉ học.

\- Báo cáo học phí.

\- Báo cáo biến động học viên.



Hỗ trợ xuất Excel và PDF.



\### 4.9. Nhật ký hoạt động và sao lưu



\- Lưu lịch sử đăng nhập.

\- Lưu lịch sử thêm, sửa, xóa hồ sơ.

\- Lưu lịch sử chỉnh sửa điểm danh.

\- Ghi nhận người thao tác.

\- Ghi nhận thời gian thao tác.

\- Sao lưu dữ liệu định kỳ.

\- Hỗ trợ phục hồi dữ liệu.



\## 5. YÊU CẦU GIAO DIỆN



Thiết kế theo phong cách phần mềm quản trị giáo dục hiện đại.



Yêu cầu:



\- Giao diện chuyên nghiệp, sạch sẽ.

\- Tông màu xanh dương, trắng và xanh lá.

\- Sidebar điều hướng rõ ràng.

\- Dashboard trực quan.

\- Bảng dữ liệu có tìm kiếm, phân trang, bộ lọc.

\- Form thêm và sửa dễ sử dụng.

\- Modal xác nhận trước khi xóa.

\- Toast thông báo khi thao tác thành công hoặc thất bại.

\- Responsive trên máy tính, máy tính bảng và điện thoại.

\- Tối ưu thao tác điểm danh nhanh cho nhân viên.



Không thiết kế giao diện sơ sài hoặc giống một trang quản trị Bootstrap mặc định. Cần có hệ thống thiết kế thống nhất.



\## 6. YÊU CẦU DATABASE



Thiết kế MySQL tập trung cho toàn hệ thống.



Dự kiến các bảng:



\- branches.

\- users.

\- roles.

\- permissions.

\- user\_branches.

\- students.

\- classes.

\- student\_class\_histories.

\- attendance.

\- attendance\_sessions.

\- tuition\_records.

\- tuition\_adjustments.

\- tuition\_payments.

\- activity\_logs.

\- system\_settings.



Có thể bổ sung bảng nếu cần thiết.



Yêu cầu:



\- Mã học viên không trùng lặp.

\- Mỗi học viên gắn với cơ sở.

\- Điểm danh liên kết với học viên và nhân viên.

\- Dữ liệu học phí liên kết với hồ sơ học viên và kỳ thu.

\- Hỗ trợ lịch sử chuyển lớp và chuyển cơ sở.

\- Có created\_at, updated\_at phù hợp.

\- Sử dụng Foreign Key và Index.

\- Không xóa dữ liệu lịch sử quan trọng tùy tiện.



\## 7. YÊU CẦU BẢO MẬT



\- PDO Prepared Statements chống SQL Injection.

\- Kiểm tra và làm sạch dữ liệu đầu vào.

\- Chống XSS.

\- CSRF Token cho biểu mẫu thay đổi dữ liệu.

\- Mật khẩu sử dụng password\_hash và password\_verify.

\- Kiểm soát quyền ở Backend.

\- Bảo vệ Session.

\- Không lưu thông tin nhạy cảm trực tiếp trong mã nguồn.

\- Không để lộ thông tin CCCD và dữ liệu trẻ cho người không có quyền.

\- Có cơ chế sao lưu dữ liệu.



\## 8. CẤU TRÚC MÃ NGUỒN MVC



Tổ chức mã nguồn rõ ràng, ví dụ:



app/

Controllers/

Models/

Views/

Middleware/

Services/

Helpers/



config/

database.php

app.php



public/

index.php

assets/

css/

js/

images/



routes/

web.php

api.php



storage/

logs/

uploads/

backups/



database/

migrations/

seeds/



Không viết toàn bộ nghiệp vụ trong một file PHP duy nhất.



\## 9. QUY TRÌNH TRIỂN KHAI



Không được tạo toàn bộ mã nguồn một cách vội vàng.



Thực hiện theo từng giai đoạn:



Giai đoạn 1: Phân tích nghiệp vụ và xác định yêu cầu.



Giai đoạn 2: Thiết kế ERD và cơ sở dữ liệu MySQL.



Giai đoạn 3: Xây dựng cấu trúc PHP MVC và hệ thống đăng nhập.



Giai đoạn 4: Xây dựng phân quyền và quản lý cơ sở.



Giai đoạn 5: Xây dựng quản lý hồ sơ học viên và lớp học.



Giai đoạn 6: Xây dựng điểm danh.



Giai đoạn 7: Xây dựng quản lý học phí.



Giai đoạn 8: Xây dựng Dashboard và báo cáo.



Giai đoạn 9: Kiểm thử, bảo mật và tối ưu.



Giai đoạn 10: Triển khai lên hosting/VPS.



Sau mỗi giai đoạn phải kiểm tra, chạy thử và sửa lỗi trước khi chuyển sang giai đoạn tiếp theo.



\## 10. NGUYÊN TẮC LÀM VIỆC CỦA AI



1\. Đọc và hiểu toàn bộ yêu cầu trước khi lập trình.

2\. Không tự ý thay đổi công nghệ.

3\. Không tự ý loại bỏ chức năng.

4\. Không tự đặt ra nghiệp vụ chưa được Admin xác nhận.

5\. Nếu thiếu thông tin quan trọng, hãy hỏi trước.

6\. Ưu tiên mã nguồn sạch, dễ bảo trì và có khả năng mở rộng.

7\. Không tạo dữ liệu giả trong môi trường thực tế.

8\. Phải kiểm thử chức năng sau khi hoàn thành.

9\. Phải đảm bảo dữ liệu hai cơ sở được phân tách đúng quyền.

10\. Phải giữ tính nhất quán giữa Database, Model, Controller và View.



\## 11. NHIỆM VỤ ĐẦU TIÊN



Trước mắt, KHÔNG viết code ngay.



Hãy thực hiện:



1\. Phân tích lại toàn bộ yêu cầu.

2\. Liệt kê các chức năng và nghiệp vụ.

3\. Xác định các bảng Database cần thiết.

4\. Thiết kế sơ đồ ERD.

5\. Đề xuất cấu trúc thư mục PHP MVC.

6\. Phân tích các rủi ro và nghiệp vụ còn thiếu.

7\. Trình bày kế hoạch triển khai từng giai đoạn.



Chờ Admin xem xét và phê duyệt trước khi bắt đầu lập trình.



Mục tiêu cuối cùng: Xây dựng một phần mềm quản lý học viên, hồ sơ trẻ, điểm danh và học phí hoàn chỉnh, vận hành thực tế tại hai cơ sở HappyKidsCK.



