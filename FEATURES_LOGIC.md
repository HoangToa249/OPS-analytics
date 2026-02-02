# Ứng Dụng Lịch Bay - Hướng Dẫn Chi Tiết Tính Năng

## 📌 Tổng Quan

Hướng dẫn này giải thích cơ chế hoạt động của từng tính năng chính và cách chúng tương tác với nhau.

---

## 🔄 1. Tính Năng Smart Upsert (Chèn Thông Minh)

### Khái Niệm Cơ Bản

**Smart Upsert** là quy trình tự động so khớp dữ liệu nhập với dữ liệu hiện có trong cơ sở dữ liệu. Thay vì luôn chèn mới hoặc luôn cập nhật, nó:
- **Chèn** các bản ghi không tồn tại
- **Cập nhật** các bản ghi đã tồn tại

### Cơ Chế So Khớp

Ứng dụng sử dụng **Khóa Tổng Hợp** (Composite Key) để nhận dạng bản ghi duy nhất:

```
Chuyến bay Đến: (arr_flight, DATE(sta))
Chuyến bay Đi:  (dep_flight, DATE(std))
```

**Ví Dụ:**
```
Chuyến bay:     UA456
Ngày Hạ Cánh:   2026-02-15
→ Khóa: (UA456, 2026-02-15) → Duy nhất
```

### Quy Trình Chi Tiết

```
1. Tải Tệp Excel
   ↓
2. Phân Tích Cột & Chọn Cột Cập Nhật
   ↓
3. Với Mỗi Bản Ghi Trong Tệp:
   a. Tạo khóa composite từ arr_flight + sta
   b. Tạo khóa composite từ dep_flight + std
   c. Kiểm Tra Bản Ghi Tồn Tại:
      - TÓN TẠI → Cập nhật (UPDATE)
      - KHÔNG TÓN TẠI → Chèn mới (INSERT)
   d. Ghi lại thống kê (inserted/updated/failed)
   ↓
4. Hiển Thị Kết Quả Cuối Cùng
```

### Mã Giả Xử Lý

```javascript
for (const record of excelData) {
  // Tạo khóa cho chuyến bay đến
  const arrivalKey = (
    record.arr_flight, 
    record.sta  // yyyy-mm-dd
  );
  
  // Kiểm tra tồn tại
  const existingArrival = database.find(arrivalKey);
  
  if (existingArrival) {
    // CẬP NHẬT bản ghi tồn tại
    database.update(arrivalKey, record);
    statistics.updated++;
  } else {
    // CHÈN bản ghi mới
    database.insert(record);
    statistics.inserted++;
  }
}
```

### Ưu Điểm

✅ **Tự Động:** Không cần chọn INSERT hay UPDATE thủ công  
✅ **An Toàn:** Không trùng lặp bản ghi  
✅ **Nhanh:** Chỉ cập nhật những gì cần thiết  

---

## ⏰ 2. Tính Năng Phạm Vi Thời Gian (Time Range)

### Mục Đích

Cho phép import và cập nhật chỉ các bản ghi trong khoảng ngày/giờ cụ thể.

**Ví Dụ Sử Dụng:**
- Nhập chỉ chuyến bay từ 8:00 AM đến 5:00 PM trong ngày 2026-02-15
- Cập nhật chỉ chuyến bay từ ngày 2026-02-10 đến 2026-02-20

### Cách Hoạt Động

#### 1. Chọn Khoảng Thời Gian (Giao Diện)

```
Bật Time Range? [✓ Có]
  Từ: 2026-02-15 09:00 (ngày + giờ:phút)
  Đến: 2026-02-15 17:00
```

#### 2. Bộ Lọc Trong Xử Lý

```javascript
// Kiểm tra bản ghi có nằm trong khoảng không
function isDateInRange(recordDate, startTime, endTime) {
  return recordDate >= startTime && recordDate <= endTime;
}

// Áp dụng cho mỗi bản ghi
if (timeRangeEnabled) {
  if (!isDateInRange(record.sta, timeFrom, timeTo)) {
    // BỎ QUAT bản ghi này
    continue;
  }
}
```

#### 3. Ảnh Hưởng Đến Import

```
Nếu Khoảng Thời Gian = 2026-02-15 09:00 đến 17:00:

Tệp Excel:
  UA101  STA=2026-02-15 08:30  ← BỎ QUA (trước 09:00)
  UA102  STA=2026-02-15 10:00  ← NHẬP (trong khoảng)
  UA103  STA=2026-02-15 18:00  ← BỎ QUA (sau 17:00)
  UA104  STA=2026-02-16 10:00  ← BỎ QUA (khác ngày)
```

#### 4. Ảnh Hưởng Đến Xóa

```javascript
// Khi bật "Xóa Trước" + Time Range
if (deleteExisting && timeRangeEnabled) {
  // XÓA tất cả bản ghi trong khoảng thời gian
  // từ cơ sở dữ liệu TRƯỚC khi nhập
  DELETE FROM flight_schedule
  WHERE sta BETWEEN '2026-02-15 09:00' AND '2026-02-15 17:00'
     OR std BETWEEN '2026-02-15 09:00' AND '2026-02-15 17:00'
}
```

### Các Trường Hợp Sử Dụng

| Tình Huống | Cấu Hình |
|-----------|---------|
| Nhập chuyến bay hôm nay | Từ: Hôm nay 00:00 → Đến: Hôm nay 23:59 |
| Nhập chuyến bay buổi sáng | Từ: Hôm nay 06:00 → Đến: Hôm nay 12:00 |
| Cập nhật tuần này | Từ: Thứ 2 tuần này → Đến: Chủ nhật tuần này |
| Khôi phục dữ liệu | Xóa khoảng cũ, nhập dữ liệu mới |

### Sơ Đồ Luồng Dữ Liệu

```
Tải Tệp Excel
    ↓
Bật Time Range?
    ├─ KHÔNG → Xử lý tất cả bản ghi
    └─ CÓ:
        ↓
        Lấy Từ Ngày/Giờ: 2026-02-15 09:00
        Lấy Đến Ngày/Giờ: 2026-02-15 17:00
        ↓
        Xóa Bản Ghi Trong Khoảng (nếu cần)
        ↓
        Lọc & Nhập Chỉ Bản Ghi Trong Khoảng
        ↓
        Bỏ Qua Các Bản Ghi Ngoài Khoảng
        ↓
        Hiển Thị Thống Kê Kết Quả
```

---

## 🎯 3. Tính Năng Cập Nhật Cột Chọn Lọc (Selective Column Update)

### Vấn Đề Giải Quyết

Khi nhập dữ liệu từ nhiều nguồn khác nhau, bạn có thể:
- Chỉ muốn cập nhật thời gian thực tế (ata, atd)
- Không muốn ghi đè lên cửa ra (gate) - vì có nguồn tin khác cập nhật
- Chỉ cập nhật số hành khách (arr_pax, dep_pax)

### Cơ Chế

```
Trước khi cập nhật, chỉ bao gồm các cột được chọn:

Bản ghi trong Excel:
{
  arr_flight: "UA456",
  sta: "2026-02-15 10:00",
  ata: "2026-02-15 10:15",
  gate: "A12",
  carousel: "5"
}

Cột Đã Chọn: [ata, carousel]  ← Chỉ cập nhật này

Lệnh UPDATE được tạo:
UPDATE flight_schedule
SET 
  ata = '2026-02-15 10:15',
  carousel = '5'
WHERE arr_flight = 'UA456' AND DATE(sta) = '2026-02-15'

Ghi Chú: gate='A12' từ Excel BỊ BỎ QUA
```

### Giao Diện Chọn Cột

```
Chọn Cột Cập Nhật:
  [✓] Thời Gian Hạ Cánh Thực Tế (ata)
  [✓] Cửa Ra (gate)
  [ ] Cửa Cánh (carousel)
  [ ] Hành Khách Hạ Cánh (arr_pax)
  
  [Chọn Tất Cả] [Bỏ Chọn Tất Cả]
```

### Lợi Ích

✅ **Ngăn Ghi Đè Không Mong Muốn:** Bảo vệ dữ liệu từ các nguồn khác  
✅ **Nhập Từ Nhiều Nguồn:** Mỗi nguồn cập nhật những cột riêng  
✅ **Linh Hoạt:** Thay đổi cột tuỳ theo nhu cầu  

### Ví Dụ Thực Tế

```
Sáng: Nhập Dữ Liệu Dự Kiến
  Cột: [sta, std, gate] ← Từ lịch trình sân bay

Chiều: Nhập Thời Gian Thực Tế
  Cột: [ata, atd] ← Từ hệ thống radar

Tối: Nhập Dữ Liệu Hành Khách
  Cột: [arr_pax, dep_pax] ← Từ hệ thống kiểm soát

Kết Quả: Cơ sở dữ liệu có dữ liệu đầy đủ từ 3 nguồn
```

---

## 📂 4. Các Chế Độ Import (Import Modes)

### Chế Độ Smart Upsert (Mặc Định)

```
Hành Động:
  - Bản ghi KHÔNG tồn tại → CHÈN
  - Bản ghi ĐÃ tồn tại → CẬP NHẬT

Phù Hợp Khi:
  - Nhập dữ liệu từ các nguồn khác nhau
  - Muốn hệ thống tự động quyết định
  - Không muốn trùng lặp
```

### Chế Độ Chỉ Chèn (Insert Only)

```
Hành Động:
  - Bản ghi KHÔNG tồn tại → CHÈN
  - Bản ghi ĐÃ tồn tại → BỎ QUA

Phù Hợp Khi:
  - Nhập dữ liệu lịch sử (không được phép cập nhật)
  - Chỉ muốn thêm các chuyến bay mới
  - Tệp Excel chứa dữ liệu bị cũ
  
Ví Dụ:
  Tệp có UA456 nhưng UA456 đã tồn tại
  → Bản ghi từ tệp BỊ BỎ QUA, giữ nguyên dữ liệu cũ
```

### Chế Độ Chỉ Cập Nhật (Update Only)

```
Hành Động:
  - Bản ghi KHÔNG tồn tại → BỎ QUA
  - Bản ghi ĐÃ tồn tại → CẬP NHẬT

Phù Hợp Khi:
  - Cập nhật dữ liệu hiện có (như ata, atd)
  - Không muốn chèn bản ghi mới
  - Chỉ có dữ liệu cho các chuyến bay được biết
  
Ví Dụ:
  Tệp có UA456 nhưng UA789 không có
  → Chỉ cập nhật UA456, không chèn UA789
```

### Bảng So Sánh

| Chế Độ | Không Tồn Tại | Tồn Tại |
|--------|---------------|---------|
| Smart Upsert | CHÈN | CẬP NHẬT |
| Chỉ Chèn | CHÈN | BỎ QUA |
| Chỉ Cập Nhật | BỎ QUA | CẬP NHẬT |

---

## 🔐 5. Kiểm Soát Truy Cập Dựa Trên Vai Trò (RBAC)

### Vai Trò Có Sẵn

#### 1. Admin (Quản Trị Viên)
```
Quyền:
  - Xem toàn bộ dữ liệu
  - Import dữ liệu (tất cả chế độ)
  - Xóa dữ liệu
  - Quản lý người dùng
  - Thay đổi cài đặt ứng dụng
```

#### 2. Dispatcher (Nhân Viên Điều Độ)
```
Quyền:
  - Xem dữ liệu chuyến bay
  - Import dữ liệu (smart upsert & update)
  - Xóa dữ liệu trong time range
  - Không thể xóa dữ liệu lớn
```

#### 3. Supervisor (Người Giám Sát)
```
Quyền:
  - Xem dữ liệu chuyến bay
  - Chỉ xem báo cáo, không thay đổi
  - Xuất dữ liệu thành CSV
  - Không thể import
```

#### 4. Viewer (Người Xem)
```
Quyền:
  - Chỉ xem dữ liệu chuyến bay
  - Không thể thay đổi gì
  - Chỉ đọc dữ liệu
```

### Cơ Chế Kiểm Soát (RLS Policies)

```sql
-- Ví dụ: Policy cho bảng flight_schedule
CREATE POLICY "user_can_view_own_data"
ON flight_schedule
FOR SELECT
USING (
  -- Kiểm tra vai trò người dùng
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('admin', 'dispatcher', 'supervisor')
  )
);
```

### Luồng Kiểm Tra Quyền

```
Người dùng nhấp "Import"
  ↓
Ứng dụng kiểm tra: Người dùng có vai trò gì?
  ↓
  [Là Admin?] → CÓ → Cho phép tất cả chế độ
  [Là Dispatcher?] → CÓ → Cho phép upsert & update
  [Là Supervisor?] → CÓ → BỎ QUA button import
  [Không?] → BỎ QUA button import
  ↓
Nếu được phép, gửi request lên backend
  ↓
Backend kiểm tra lại quyền trước khi xử lý
  ↓
Thực hiện hoặc từ chối
```

---

## 🏗️ 6. Kiến Trúc Hệ Thống

### Các Tầng (Layers)

```
┌─────────────────────────────────────┐
│ TẦNG NGƯỜI DÙNG (UI)                │
│ - FileUpload.tsx                    │
│ - DataSync.tsx                      │
│ - TimeRangeSelector.tsx             │
│ - ColumnSelector.tsx                │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ TẦNG BUSINESS LOGIC                 │
│ - importDataService.ts              │
│   - smartUpsertData()               │
│   - deleteRecordsInTimeRange()      │
│   - filterBySelectedColumns()       │
│   - isDateInRange()                 │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ TẦNG DỮ LIỆU (Database)             │
│ - Supabase PostgreSQL               │
│ - Bảng: flight_schedule             │
│ - Bảng: roles, user_roles, etc.     │
└─────────────────────────────────────┘
```

### Quy Trình Import Hoàn Chỉnh

```
1. GIAO DIỆN (FileUpload.tsx)
   ↓
   Người dùng:
   - Chọn tệp Excel
   - Bật Time Range? [✓]
   - Chọn cột cập nhật
   - Chọn chế độ import
   - Nhấp "Import"
   ↓

2. CHUẨN BỊ (DataSync.tsx - handleDataReady)
   ↓
   - Phân tích Excel → Mảng đối tượng
   - Kiểm tra quyền người dùng
   - Chuẩn bị cấu hình
   ↓

3. BƯỚC XÓA (nếu cần)
   ↓
   deleteRecordsInTimeRange()
   - Tìm bản ghi trong khoảng thời gian
   - Xóa theo batch (50 bản ghi/lần)
   - In log tiến độ
   ↓

4. BƯỚC NHẬP (Smart Upsert)
   ↓
   smartUpsertData()
   - Duyệt qua từng bản ghi
   - Tạo khóa tổng hợp
   - Kiểm tra tồn tại
   - CHÈN hoặc CẬP NHẬT
   - Báo cáo tiến độ (callback)
   - Ghi log chi tiết
   ↓

5. HIỂN THỊ KẾT QUẢ
   ↓
   ImportProgressModal hiển thị:
   - Tổng bản ghi: 150
   - Đã xử lý: 150 (100%)
   - Chèn mới: 45
   - Cập nhật: 105
   - Thất bại: 0
```

### Bộ Nhớ Tạm (State Management)

```javascript
// FileUpload.tsx
const [file, setFile] = useState<File | null>(null);
const [enableTimeRange, setEnableTimeRange] = useState(false);
const [timeRangeFrom, setTimeRangeFrom] = useState<Date | null>(null);
const [timeRangeTo, setTimeRangeTo] = useState<Date | null>(null);
const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
const [isProcessing, setIsProcessing] = useState(false);

// DataSync.tsx
const [importProgress, setImportProgress] = useState({
  processed: 0,
  total: 0,
  inserted: 0,
  updated: 0,
  failed: 0
});
```

---

## 💡 7. Các Trường Hợp Sử Dụng Thực Tế

### Tình Huống 1: Cập Nhật Thời Gian Thực Tế Ngày Hôm Nay

```
Mục tiêu: Chỉ cập nhật ata/atd cho chuyến bay hôm nay (2026-02-15)

Cấu hình:
  1. Chọn tệp Excel (chỉ chứa ata, atd)
  2. Bật Time Range:
     - Từ: 2026-02-15 00:00
     - Đến: 2026-02-15 23:59
  3. Chế độ Import: Chỉ Cập Nhật
  4. Cột Cập Nhật: [ata, atd]
  5. Nhấp Import

Kết Quả:
  - Chỉ bản ghi hôm nay được cập nhật
  - Chỉ cột ata, atd được thay đổi
  - Các bản ghi khác không bị ảnh hưởng
  - Bản ghi hôm mai bị bỏ qua
```

### Tình Huống 2: Khôi Phục Dữ Liệu Tuần Trước

```
Mục tiêu: Xóa dữ liệu tuần trước và nhập lại từ backup

Cấu hình:
  1. Chọn tệp Excel (backup đầy đủ)
  2. Bật Time Range:
     - Từ: 2026-02-10 (Thứ 2 tuần trước)
     - Đến: 2026-02-14 (Thứ 6 tuần trước)
  3. Bật "Xóa Trước": [✓]
  4. Chế độ Import: Smart Upsert
  5. Nhấp Import

Quy Trình:
  1. Xóa tất cả bản ghi từ 2026-02-10 đến 2026-02-14
  2. Chèn bản ghi từ tệp Excel (chỉ trong khoảng)
  3. Cập nhật bản ghi trùng lặp

Kết Quả:
  - Tuần trước được khôi phục
  - Các tuần khác không bị ảnh hưởng
```

### Tình Huống 3: Nhập Dữ Liệu Từ 3 Nguồn Khác Nhau

```
Sáng (9:00): Nhập Lịch Trình Sân Bay
  Tệp: schedule.xlsx
  Cột: [sta, std, gate, carousel]
  Chế độ: Smart Upsert
  → Chèn tất cả chuyến bay ngày hôm nay

Chiều (14:00): Nhập Thời Gian Thực Tế
  Tệp: realtime.xlsx
  Cột: [ata, atd]
  Chế độ: Chỉ Cập Nhật
  Time Range: Từ 00:00 đến 14:00 (chỉ chuyến bay đã hạ cánh)
  → Cập nhật ata/atd mà không ghi đè gate/carousel

Tối (18:00): Nhập Dữ Liệu Hành Khách
  Tệp: passengers.xlsx
  Cột: [arr_pax, dep_pax]
  Chế độ: Chỉ Cập Nhật
  → Cập nhật số hành khách

Kết Quả:
  Cơ sở dữ liệu có thông tin đầy đủ từ 3 nguồn
  Mỗi nguồn cập nhật những cột riêng của nó
```

---

## ⚡ 8. Hiệu Năng & Tối Ưu Hóa

### Tốc Độ Import Điển Hình

```
1,000 bản ghi  → ~2-3 giây
10,000 bản ghi → ~15-20 giây
50,000 bản ghi → ~60-90 giây (có thể cần phân chia)
```

### Xóa Theo Batch

```javascript
// Thay vì xóa tất cả cùng lúc
// Ứng dụng xóa 50 bản ghi mỗi lần

Ví dụ với 5,000 bản ghi:
  Batch 1: Xóa 50 bản ghi → Tạm dừng
  Batch 2: Xóa 50 bản ghi → Tạm dừng
  ...
  Batch 100: Xóa 50 bản ghi → Hoàn thành
  
Tổng thời gian: ~5-10 giây (thay vì 30+ giây)
```

### Chiến Lược Tối Ưu

✅ **Sử Dụng Time Range:** Giảm số lượng bản ghi xử lý  
✅ **Chọn Cột Cần Thiết:** Chỉ cập nhật những gì thay đổi  
✅ **Import Vào Giờ Rảnh:** Tránh thời gian cao điểm  
✅ **Chia Tệp Lớn:** Thay vì 100K bản ghi, chia thành 10K mỗi tệp  

---

## 📊 9. Giám Sát & Ghi Nhật Ký

### Tiền Tố Nhật Ký Console

```javascript
[Delete]  - Quy trình xóa dữ liệu
  [Delete] Found 150 records in range
  [Delete] Batch 1 deleted 50 records
  [Delete] SUCCESS: 150 records deleted

[Upsert] - Quy trình smart upsert
  [Upsert] Starting import mode: upsert with 1000 records
  [Upsert] Record 1 inserted successfully
  [Upsert] Record 5 updated successfully
  [Upsert] Record 10 insert failed: Duplicate entry
  [Upsert] COMPLETED: inserted=450 updated=520 failed=30
```

### Theo Dõi Tiến Độ

```
Thanh tiến độ cập nhật sau mỗi 50 bản ghi:

Xử lý: 50/1000 ▓▓░░░░░░░░░░░░░░░░░░░░░░░░ 5%
Chèn: 25 | Cập nhật: 20 | Lỗi: 5

Xử lý: 500/1000 ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░ 50%
Chèn: 200 | Cập nhật: 280 | Lỗi: 20

Xử lý: 1000/1000 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%
Chèn: 400 | Cập nhật: 560 | Lỗi: 40
```

---

## 🔍 10. Xử Lý Lỗi Phổ Biến

### Lỗi: "Cannot find column 'arr_flight'"

```
Nguyên nhân:
  - Tệp Excel có cột khác tên
  - Mapping cột sai
  
Giải pháp:
  1. Kiểm tra tên cột trong Excel
  2. Xác minh mapping trong ColumnSelector
  3. Kiểm tra tên cột trong cơ sở dữ liệu
  
Cột Đúng: arr_flight, dep_flight, sta, std, ata, atd, gate, carousel, arr_pax, dep_pax
```

### Lỗi: "RLS Policy Violation"

```
Nguyên nhân:
  - Người dùng không có quyền
  - Vai trò không đúng
  
Giải pháp:
  1. Kiểm tra vai trò trong database
  2. Xác minh quyền trong bảng role_permissions
  3. Liên hệ admin để cấp quyền
```

### Lỗi: "0 inserted, 0 updated"

```
Nguyên nhân:
  - Khoảng thời gian quá chặt
  - Khóa tổng hợp không khớp
  - Tất cả bản ghi đã tồn tại (chế độ Chỉ Chèn)
  
Giải pháp:
  1. Kiểm tra khoảng thời gian Time Range
  2. So sánh dữ liệu Excel với database
  3. Kiểm tra xem tất cả bản ghi đã có không
```

---

## 🎓 Kết Luận

**Smart Upsert** + **Time Range** + **Selective Columns** + **Import Modes** = Hệ thống import linh hoạt và mạnh mẽ

Sử dụng đúng cách, bạn có thể:
✅ Nhập từ nhiều nguồn mà không có xung đột  
✅ Cập nhật một phần dữ liệu mà không ghi đè toàn bộ  
✅ Kiểm soát truy cập dựa trên vai trò  
✅ Giám sát tiến độ theo thời gian thực  

---

**Cập Nhật Lần Cuối:** 2 Tháng 2, 2026  
**Phiên Bản:** 1.0
