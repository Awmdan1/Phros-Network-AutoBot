# Pharos-Network Script

## Mục đích
Tự động login, nhận faucet, checkin, gửi ETH và xác minh task cho nhiều ví trên Pharos Network testnet.

## Hướng dẫn sử dụng

### 1. Cài đặt
- Cài Node.js >= 16
- Cài các package cần thiết:
  ```
  npm install
  npm install http-proxy-agent https-proxy-agent
  ```

### 2. Chuẩn bị file cấu hình
- **key.txt**: Mỗi dòng 1 private key (không có dòng trống).
- **proxy.txt** (tuỳ chọn): Mỗi dòng 1 proxy dạng `http://user:pass@host:port` hoặc `http://host:port`. Nếu để trống sẽ không dùng proxy.

### 3. Cấu hình script
- Mở file `pharos.js`, chỉnh các biến ở đầu file:
  - `ENABLE_FAUCET`: Bật/tắt nhận faucet.
  - `ENABLE_CHECKIN`: Bật/tắt checkin.
  - `ENABLE_SEND`: Bật/tắt gửi ETH và verify task.
  - `SEND_TIMES`: Số lần gửi mỗi ví.
  - `SEND_AMOUNT`: Số ETH gửi mỗi lần.
  - `VERIFY_TASK_ID_SEND`: Task ID dùng để verify.

### 4. Chạy script
```
node pharos.js
```

### 5. Lưu ý
- Không chia sẻ file `key.txt` và `proxy.txt` cho bất kỳ ai.
- Script sẽ tự động xoay vòng proxy nếu có nhiều proxy.
- Log sẽ hiển thị màu sắc giúp dễ theo dõi trạng thái.

---

Nếu gặp lỗi hoặc cần hỗ trợ, hãy liên hệ người phát triển script. 