# BIDV QR thu hộ trường học

Ba chức năng: Tạo QR, Thông báo nộp tiền, Thông báo lựa chọn QR.

## Thông báo lựa chọn QR

Mỗi dòng nguồn là một QR đã có định danh, số tiền và tài khoản riêng. Không cộng hai lựa chọn BHYT và BHYT+BHTT thành nghĩa vụ phải thu, không tự sinh mã thanh toán, không suy ra mã học sinh bằng cách cắt mã khoản. Dữ liệu học sinh chỉ nằm trong bộ nhớ phiên; cách trình bày được lưu riêng theo tên trường.

Bấm **Tải mẫu Excel mới** trong tab để lấy mẫu có hướng dẫn. Ví dụ trong file là dữ liệu giả, phải thay bằng thông tin đã đăng ký trước khi phát hành.

Cột bắt buộc: StudentID (mã học sinh gốc), StudentName, Class, CustomerCode (mã thu duy nhất), FeeName (tên lựa chọn), Amount (số tiền của QR), AccountNumber, BankBin, AccountName.

Cột mở rộng: Remark (trống dùng CustomerCode), ChoiceGroup (trống dùng DOT_THU), Includes (khoản bao gồm), ChoiceNote (giải thích), ChoiceOrder (thứ tự). Các trường mã và tài khoản cần đặt dạng Text trong Excel để giữ số 0 đầu. Remark cần 1–25 ký tự không dấu gồm chữ, số, khoảng trắng, `_ . -`; không tự cắt hoặc thay nội dung nguồn.

Gom theo StudentID + ChoiceGroup. Một học sinh có thể có nhiều nhóm độc lập; trong mỗi nhóm chỉ chọn một QR. Họ tên/lớp của cùng StudentID phải thống nhất. Mã thu không trùng trong file. Hai lựa chọn cùng ngân hàng, tài khoản và nội dung sẽ bị chặn vì không phân biệt được thông tin QR. Lựa chọn bị thiếu dòng chỉ còn một QR sẽ có cảnh báo.

Ảnh A5 có tối đa hai QR/trang; nhóm nhiều lựa chọn có nhiều trang với số trang và lời nhắc chọn một QR trong toàn nhóm. ZIP theo lớp chứa PNG, PDF cả lớp và CSV đối chiếu đúng thông tin từng lựa chọn.

Nạp riêng tại tab này sẽ nhận diện và cho ghép cột. Nạp ở tab Tạo QR rồi dùng lại cũng hỗ trợ các cột mở rộng; mã thu có thể lấy Remark của dữ liệu cũ nếu CustomerCode chưa có. Với dữ liệu cần giữ mã dạng Text, ưu tiên nạp riêng tại tab lựa chọn.

Web tạo QR chuyển khoản từ file; không đăng ký khoản định danh ở ngân hàng, không cập nhật trạng thái thu, không tự khóa mã lựa chọn còn lại. Includes là mô tả, không phải sổ phân bổ kế toán. Không đặt số tiền gộp vào tài khoản định danh dành riêng cho khoản đơn lẻ: tài khoản trong file phải là thông tin được cấp cho đúng lựa chọn.

## Kiểm tra

`node tests/insurance.test.cjs`
