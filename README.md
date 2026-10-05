# BIDV QR thu hộ trường học

## Tab QR Bảo hiểm · 2 phương án

1. Nhập tên trường, chọn logo ở phần đầu trang.
2. Trong tab bảo hiểm, tải mẫu CSV và điền mỗi học sinh một dòng: Mã học sinh, Họ và tên, Lớp, BHYT, BHTT, Đã nộp BHYT, Đã nộp BHTT. Có thể nhập Excel và chọn lại cột qua bước ghép cột. Mã học sinh nên định dạng văn bản để giữ số 0 đầu.
3. Hoặc lấy dữ liệu đã nhập ở tab QR: chọn đúng tên hai khoản. Các dòng phải có chung mã học sinh gốc; không ghép theo tên hay cắt đuôi mã thanh toán. Dữ liệu QR cũ không có trạng thái đã nộp nên mặc định chưa nộp; dùng mẫu riêng nếu đã thu một phần.
4. Cấu hình tài khoản nhận chung của trường, năm học/đợt thu, hạn nộp và liên hệ. Cấu hình lưu riêng theo tên trường; dữ liệu học sinh chỉ giữ trong bộ nhớ của phiên đang mở. Khi đổi trường phải nạp lại danh sách phù hợp.
5. Chọn một/nhiều lớp, xem trước, xuất ZIP: ảnh PNG từng học sinh, PDF A5 từng lớp, bảng mã CSV và bảng phân bổ JSON.

Chưa nộp: hai QR lựa chọn (BHYT; BHYT+BHTT). Đã nộp một khoản: chỉ tạo QR khoản còn lại. Đã hoàn thành: không tạo QR. Mức 0 được coi là không cần nộp khoản đó. Trạng thái do file đầu vào cung cấp, không tự đồng bộ từ website trường.

QR được tạo trên trình duyệt bằng thư viện cục bộ. Mã tham chiếu ổn định theo trường, học sinh, năm học/đợt, số tiền và tài khoản. Logo nằm ngoài vùng QR. Các tab cũ giữ cách tạo QR hiện có.

Đây là QR chuyển khoản đến tài khoản người dùng cấu hình, không tự đăng ký mã khách hàng/hóa đơn thu hộ tại BIDV. Không dùng tài khoản định danh riêng BHYT để nhận tổng BHYT+BHTT trừ khi ngân hàng đã thiết lập phù hợp. Giữ bảng mã CSV/JSON để đối chiếu; các web trường hiện chưa có chức năng tự nhập bảng mã từ bidvqrgen. QR ảnh đã phát hành không tự bị khóa sau khi thanh toán.

Kiểm thử: `node tests/insurance.test.cjs`.
