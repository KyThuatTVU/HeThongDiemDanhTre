Vai trò: Bạn là Senior Frontend Architect, chuyên xây dựng bộ UI tĩnh (HTML + Bootstrap + JS thuần) bàn giao cho team backend ghép vào View.



Bối cảnh:

\- Dự án: {{TÊN\_DỰ\_ÁN}} — backend PHP MVC đã có cấu trúc riêng, frontend là bộ template HTML độc lập.

\- Công nghệ: HTML5, Bootstrap {{5.x}} (self-host, không CDN), CSS tự viết, JavaScript thuần (ES Module, không React/Vue/jQuery).

\- Mục đích: dựng UI để review \& demo trước, sau đó ghép vào tầng View của backend.

\- Các trang dự kiến: {{LIỆT\_KÊ\_TRANG}} (ví dụ: đăng nhập, dashboard, danh sách xe, thêm/sửa xe, danh sách tuyến, bán vé, tra cứu vé, báo cáo doanh thu, quản lý tài khoản).



Nhiệm vụ:

Thiết kế CẤU TRÚC THƯ MỤC frontend đáp ứng đúng các ràng buộc dưới đây.



Ràng buộc bắt buộc:

1\. KHÔNG viết mã nguồn: không có thẻ HTML mẫu, không đoạn CSS, không hàm JS, không pseudo-code. Chỉ nêu tên thư mục/tên file và mô tả trách nhiệm bằng văn xuôi.

2\. Tách tuyệt đối 3 loại tài nguyên: markup (.html) – style (.css) – behavior (.js). Cấm <style>, thuộc tính style="", <script> nội tuyến, onclick/onchange trong HTML. Mô tả cơ chế gắn hành vi bằng thuộc tính data-\* trỏ tới file JS tương ứng.

3\. MỖI TRANG LÀ MỘT THƯ MỤC RIÊNG: pages/<module>/<page>/index.html. Nhờ index.html làm file mặc định, URL hiển thị là /<module>/<page>/ — không có đuôi .html.

4\. Không lặp markup: mọi phần xuất hiện từ 2 trang trở lên (navbar, sidebar, footer, breadcrumb, modal, table toolbar, pagination, card thống kê, form field…) phải nằm trong components/. Mỗi component gồm bộ 3 file cùng tên (html/css/js), mô tả cơ chế nhúng: include phía server khi ghép vào PHP View, hoặc loader JS khi chạy demo tĩnh — chỉ mô tả, không viết code.

5\. layouts/ chứa khung trang dùng lại (base, auth, dashboard) với các vùng placeholder được đặt tên rõ (ví dụ: vùng sidebar, vùng nội dung, vùng thông báo).

6\. assets/css chia tầng: base (reset, biến màu, typography) → layout → components → pages; assets/js chia tầng: vendor → core/utils (http, format, validate, modal helper) → components → pages. Mỗi trang chỉ nạp CSS/JS của component mà nó dùng + file riêng của trang.

7\. Bootstrap, icon, font self-host trong assets/ (chạy được offline khi bảo vệ đồ án). Ảnh theo module: assets/img/<module>/.

8\. Quy ước đặt tên: thư mục và file kebab-case, không dấu, không khoảng trắng; class CSS tự viết theo BEM, tận dụng utility của Bootstrap; file JS đặt tên theo component/page tương ứng.

9\. Ẩn đuôi .html: nêu file cấu hình server cần có (.htaccess/nginx) và mục đích (DirectoryIndex + rewrite), KHÔNG viết nội dung cấu hình. Đồng thời nêu rõ giới hạn kỹ thuật: ẩn đuôi chỉ làm đẹp URL, không che được HTML/CSS/JS khỏi DevTools; logic và dữ liệu nhạy cảm phải xử lý ở backend, frontend chỉ hiển thị.

10\. Tránh over-engineering: không SPA, không bundler, không build step; nếu một thư mục chỉ nên tạo khi thật cần thì ghi rõ "optional – chỉ tạo khi…".



Định dạng đầu ra (bắt buộc, tiếng Việt):

Phần 1 – Cây thư mục đầy đủ trong code block text, comment ngắn mỗi dòng.

Phần 2 – Bảng 3 cột: Đường dẫn | Trách nhiệm | Được dùng ở đâu / nạp khi nào.

Phần 3 – Bảng ánh xạ trang: Tên trang | URL không đuôi | Layout sử dụng | Component sử dụng | CSS/JS nạp kèm.

Phần 4 – Thứ tự nạp bắt buộc của CSS và JS (chuỗi phụ thuộc), giải thích ngắn vì sao.

Phần 5 – Checklist 5–6 bước thêm một trang mới (tạo thư mục gì, đăng ký ở đâu, tái dùng component nào).

Phần 6 – 5 lỗi cấu trúc frontend thường gặp ở đồ án sinh viên (copy navbar vào từng trang, inline style, nạp toàn bộ JS mọi trang, ảnh đặt lung tung, URL lộ .html/đường dẫn nội bộ) và cấu trúc trên phòng tránh thế nào.



Tiêu chí nghiệm thu:

\- Người mới chỉ cần nhìn cây thư mục là biết đặt trang/component/file CSS-JS mới ở đâu.

\- Không có markup nào bị lặp ở 2 nơi.

\- Không tồn tại mã nội tuyến trong bất kỳ trang nào.

\- Mọi URL hiển thị đều không có .html.

\- Không xuất hiện bất kỳ đoạn mã nguồn nào trong câu trả lời.



