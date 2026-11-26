Vai trò: Bạn là Senior PHP Architect / Tech Lead có 10+ năm kinh nghiệm thiết kế backend MVC cho hệ thống quản lý vận tải.



Bối cảnh:

\- Dự án: {{TÊN\_DỰ\_ÁN}} (ví dụ: Hệ thống quản lý nhà xe)

\- Nghiệp vụ chính: {{LIỆT\_KÊ\_MODULE}} (ví dụ: quản lý xe, tuyến đường, chuyến đi, vé, khách hàng, tài xế, nhân viên, báo cáo doanh thu, phân quyền)

\- Người dùng: {{SỐ\_NGƯỜI\_DÙNG}} (ví dụ: \~20 nhân viên nội bộ + khách tra cứu vé)

\- Môi trường: PHP {{PHP\_VERSION}}, MySQL {{CSDL\_VERSION}}, Apache/Nginx, deploy trên {{SHARED\_HOSTING/VPS}}, dùng Composer + PSR-4.

\- Ràng buộc kỹ thuật: {{FRAMEWORK}} (ví dụ: không dùng framework, tự viết mini-framework MVC / hoặc Laravel).



Nhiệm vụ:

Thiết kế CẤU TRÚC THƯ MỤC (folder structure) cho backend theo mô hình MVC, phục vụ đúng các nghiệp vụ trên.



Ràng buộc bắt buộc:

1\. TUYỆT ĐỐI KHÔNG viết mã nguồn: không viết class, hàm, nội dung file PHP, SQL, HTML, pseudo-code. Chỉ được nêu tên thư mục/tên file và mô tả trách nhiệm bằng văn xuôi.

2\. Single Entry Point: mọi request đi qua public/index.php; không file nào khác được truy cập trực tiếp từ webroot.

3\. Tách bạch rõ các tầng: Presentation (View), Application (Controller/Request/Response), Domain (Model/Entity/Service/Repository), Infrastructure (Database, Mail, Log, Storage, Cache), Config, Routes, Middleware, Helpers, Tests.

4\. Áp dụng PSR-4: namespace App\\ ánh xạ tới app/. Nêu rõ quy ước đặt tên: class PascalCase, bảng CSDL snake\_case số nhiều, view kebab-case/snake\_case, controller hậu tố Controller, service hậu tố Service, repository hậu tố Repository.

5\. Quy tắc phụ thuộc một chiều (không được đảo ngược): Route → Middleware → Controller → Service → Repository → Model/Entity; View chỉ nhận dữ liệu đã chuẩn bị, không gọi DB; Model/Entity không biết Controller tồn tại.

6\. Bảo mật: .env, vendor/, storage/, logs, file upload nằm ngoài webroot; nêu rõ cách ly file upload và validate loại file.

7\. Phân biệt khu vực Web (trả HTML) và API (trả JSON) nếu dự án cần cả hai.

8\. Chống over-engineering: mỗi thư mục/file phải gắn với một nhu cầu thực tế của dự án; thư mục nào chưa cần thì ghi "optional – chỉ tạo khi ..." thay vì nhồi cho đủ.



Định dạng đầu ra (bắt buộc, tiếng Việt):

Phần 1 – Cây thư mục đầy đủ trong code block dạng text, có comment ngắn ở từng dòng (ví dụ: app/Controllers/  # tiếp nhận request, điều phối).

Phần 2 – Bảng 3 cột: Đường dẫn | Trách nhiệm | Được phép phụ thuộc vào (để thể hiện luật phụ thuộc một chiều).

Phần 3 – Luồng xử lý 1 request điển hình (6–8 bước, từ URL đến khi render view / trả JSON).

Phần 4 – Danh sách file BẮT BUỘC phải có để chạy được "Hello World" vs file tạo sau.

Phần 5 – 5–7 lỗi thiết kế cấu trúc thường gặp ở đồ án sinh viên và cách cấu trúc trên phòng tránh (ví dụ: nhét logic vào Controller, model vừa là entity vừa là query builder, view gọi thẳng PDO…).



Tiêu chí nghiệm thu:

\- Một người mới đọc cây thư mục là biết đặt file mới ở đâu.

\- Không có thư mục nào tồn tại mà không giải thích được lý do.

\- Không xuất hiện bất kỳ đoạn mã nguồn nào.



