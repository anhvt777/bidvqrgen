# BIDV QR Engine V1.0.0 – hợp đồng tích hợp dùng chung

**Trạng thái:** Trưng Vương đang thử nghiệm trên 15 học sinh giả lập. Không dùng QR tạo từ dữ liệu DEMO để nộp tiền thật.

## Một nguồn tạo QR

- `bidv-qr-core.js`: UMD không phụ thuộc bên thứ ba, phát sinh **payload VietQR/EMV + CRC** từ BIN BIDV 970418, tài khoản định danh, tên thụ hưởng, số tiền nguyên dương và nội dung chuyển khoản.
- `bidv-qr-renderer.js`: tạo ảnh PNG chuẩn có hoa mai BIDV, tên học sinh và số tiền. Phần trường học có thể truyền `schoolLogoData` đã được thiết lập.
- Trình duyệt dùng `window.BIDVQREngine.generate(data)`, `window.BIDVQREngine.verify(data,payload)` và `await window.BIDVQRBrand.render(payload,{label,amount,schoolLogoData})`. Hai thư viện phải cùng phiên bản **1.0.0**.
- Cổng phụ huynh dùng bản QR đã duyệt, hoặc API quản trị tạo payload từ **thông tin đã xác minh và lưu trong D1**, không dùng tài khoản lấy từ biểu mẫu của người dùng cuối.

### Dữ liệu đầu vào

```json
{
  "bankBin": "970418",
  "accountNumber": "<tai_khoan_dinh_danh_da_xac_minh>",
  "accountName": "<ten_thu_huong_dung_ben_ngan_hang>",
  "amount": 400000,
  "remark": "<noi_dung_dinh_danh_chuan_da_duyet>"
}
```

**Danh tính khoản thu:** `school_id + student_uid + charge_id + period_id`. Mã tài khoản định danh không được thay đổi sau phát sinh thu. Mỗi tháng là một kỳ riêng; tháng 11 và 12 không chia sẻ mã khoản thu.

**Quy tắc số dư:** `remaining = max(0, amount_due - sum(confirmed allocations))`. Không dùng tổng giao dịch chưa đối chiếu hoặc bản nháp đang chờ duyệt. Khi còn thiếu bằng 0, API không phát hành QR.

**Đồng bộ mẫu:** web Trưng Vương xuất Excel 11 cột → bidvqrgen tạo EMV và ảnh theo cùng thư viện → công cụ chuyển QR đã tạo đến `/admin/qr-review` qua Cloudflare Access → cán bộ xác minh QR trên ứng dụng ngân hàng → ghi bản QR đã duyệt và phiên bản vào D1. QR hiện trên Cổng phụ huynh chỉ khi số tiền QR bằng số dư hiện tại.

### API trên Cloudflare (Trưng Vương DEMO)

- `GET /admin/qr-engine`: giao diện QA được bảo vệ Cloudflare Access.
- `GET /api/admin/qr-engine/list`: đọc danh mục 60 khoản giả lập và số dư của từng món.
- `POST /api/admin/qr-engine/preview` với `X-QR-Engine: v1`, JSON `{"charge_id":"tv_charge_..."}`: không xuất mã thanh toán khi tài khoản/chủ tài khoản chưa được xác minh; trả trạng thái `BANK_ACCOUNT_UNVERIFIED`, `ALREADY_PAID`, `STALE_QR_AMOUNT`, `REAPPROVAL_REQUIRED` hoặc `PREVIEW_VERIFIED_QR`.
- `POST /api/admin/qr-review`: kiểm tra payload/PNG, tài khoản BIDV, số dư, tên học sinh/lớp/kỳ. Chỉ cho công bố khi cán bộ xác minh, nguồn QR Engine/Renderer 1.0.0.
- `POST /api/lookup`: phụ huynh xác thực thông tin và mã cá nhân; chỉ trả **ảnh QR đã duyệt, còn hiệu lực, đúng Engine/Renderer V1.0.0**.

### Kiểm thử an toàn

- Trên D1 hiện có **15 học sinh/60 khoản/7 giao dịch đã ghi nhận, tổng 2.043.100đ**; 58 món còn thiếu và 2 món thu đủ (tại ngày 08/11/2026).
- Đối chiếu phát sinh payload cho 58 khoản chưa thu đủ trên hai bản core GitHub: **58/58 giống nhau, CRC hợp lệ**. Mã tài khoản sử dụng để thử thuật toán chưa được xác minh do ngân hàng cấp.
- 6/6 thử nghiệm trạng thái API đạt: unverified, fully paid, stale QR, sai phiên bản, payload đã xác minh giả lập, chặn request khác origin.
- Không có QR thật được ghi vào D1 trong đợt này: `qr_verified=0` cho toàn bộ 60 món.
- Trường hợp muốn test hình ảnh: mở `https://anhvt777.github.io/trungvuong/qr-engine-v1-demo.html`; mã có chữ `DEMOONLY`, không phải tài khoản dùng thanh toán.

### Mở rộng sang trường khác

Giữ nguyên hai thư viện, thay đổi chính sách mã học sinh/khoản/kỳ qua bộ adapter trường; không nhúng danh sách học sinh hoặc bí mật đăng nhập vào thư viện. Mỗi trường dùng namespace dữ liệu và phân quyền riêng. Chỉ nâng phiên bản QR Engine sau khi kiểm thử hồi quy CRC và ảnh QR tại cả web trường, công cụ hàng loạt và cổng phụ huynh.
