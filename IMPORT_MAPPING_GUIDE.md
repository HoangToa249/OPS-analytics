# 📊 Hướng Dẫn Sử Dụng Tính Năng Import & Mapping Thông Minh

## 🎯 Tổng Quan

Tính năng import dữ liệu flight schedule đã được nâng cấp với **3 tính năng chính**:

### 1. ✨ Auto-Detect Thông Minh (Fuzzy Matching)
- **Tự động quét các cột** trong Excel và so khớp với cấu trúc database
- **Hỗ trợ đa ngôn ngữ**: Tiếng Anh, Tiếng Việt, và các biến thể tên cột
- **Confidence Score**: Hiển thị % độ chính xác của mapping (0-100%)
  - **🟢 90%+**: Match hoàn hảo
  - **🔵 70-89%**: Match tốt
  - **🟡 50-69%**: Match có thể chọn
  - **⚪ <50%**: Không khuyên dùng

### 2. 🔍 Xác Thực Dữ Liệu Trước Upload
- **Kiểm tra required fields** trước khi upload
- **Thống kê hàng hợp lệ** - Bao nhiêu hàng có đủ required fields
- **Cảnh báo lỗi & cảnh báo** hiển thị rõ ràng:
  - ❌ **Lỗi**: Dữ liệu thiếu required fields
  - ⚠️ **Cảnh báo**: Những hàng sẽ bị bỏ qua

### 3. 📝 Preview Dữ Liệu Sau Mapping
- **Xem mẫu 5 hàng đầu** với dữ liệu thực sau khi mapping
- **Thống kê từng cột**:
  - Kiểu dữ liệu được detect (string, number, datetime)
  - Số lượng hàng có dữ liệu
  - Các ví dụ thực tế từ file

---

## 📋 Quy Trình Import (Step-by-step)

### **Bước 1: Upload File Excel**
1. Click **"Select Excel File"**
2. Chọn file Excel (.xlsx, .xls) có dữ liệu chuyến bay
3. File sẽ được đọc tự động

### **Bước 2: Xem Mapping Tự Động**
Hệ thống sẽ **tự động scan** các cột và mapping với schema database:

```
Input Columns:          → Auto-Detected Fields
"Mã chuyến bay"         → flight (100% ✓)
"Cất cánh dự tính"      → std (95% ✓)
"Thời gian hạ cánh"     → sta (87% ✓)
"Loại máy bay"          → acType (92% ✓)
...
```

**Nếu mapping không chính xác:**
- Nhấn dropdown và chọn cột đúng
- Confidence score sẽ cập nhật
- Nếu không tìm được, chọn **"-- Select Column --"** (sẽ bỏ qua field này)

### **Bước 3: Cấu Hình & Xác Thực**
- ✓ **Date Format**: Auto-detect hoặc chọn thủ công
- ✓ **Timezone Fix**: Tích nếu cần fix lệch timezone từ Excel
- ✓ **Validation Status**: Hệ thống kiểm tra:
  - Có bao nhiêu hàng hợp lệ?
  - Có lỗi gì không?
  - Có hàng nào bị bỏ qua không?

**Ví dụ Validation Result:**
```
✓ Data Valid
  245 of 250 rows valid
  ⚠ 5 rows have missing required fields and will be skipped
```

### **Bước 4: Preview (Tùy Chọn)**
Click **"Show Preview"** để:
- Xem 5 hàng đầu sau mapping
- Kiểm tra dữ liệu có đúng không
- Xem thống kê từng cột (type, examples)

### **Bước 5: Launch**
- Click **"Launch Dashboard"** khi:
  - ✓ Tất cả required fields được mapping
  - ✓ Validation status = "Data Valid"
- Dữ liệu sẽ được upload vào database ngay lập tức

---

## 🗂️ Cấu Trúc Schema (flight_schedule)

### **Required Fields** (PHẢI có):
| Field | Tên Hiển Thị | Kiểu | Ghi Chú |
|-------|-------------|------|--------|
| `flight` | Flight Number | string | Mã chuyến bay (VD: VN123) |
| `std` | STD | datetime | Scheduled Departure Time |

### **Optional Fields** (CÓ THỂ có):
| Field | Tên Hiển Thị | Kiểu | Ví Dụ |
|-------|-------------|------|-------|
| `arrFlt` | Arrival Flight | string | VN456 |
| `sta` | STA | datetime | Scheduled Arrival Time |
| `atd` | ATD | datetime | Actual Departure Time |
| `ata` | ATA | datetime | Actual Arrival Time |
| `acType` | Aircraft Type | string | A320, B787 |
| `depSts` | Departure Status | string | ON TIME, DELAYED, CANCELLED |
| `arrSts` | Arrival Status | string | ON TIME, DELAYED, CANCELLED |
| `gate` | Gate / Stand | string | G01, STAND A |
| `depGate` | Departure Gate | string | G02 |
| `arrBelt` | Arrival Belt | string | B1, B2 |
| `counters` | Counters | string | C1-C5 |
| `depPax` | Departure Passengers | number | 180 |
| `arrPax` | Arrival Passengers | number | 200 |
| `from` | Origin | string | HAN, SGN |
| `to` | Destination | string | BKK, ICN |

---

## 🔤 Supported Column Names (Auto-Detection)

Hệ thống tự động nhận ra các tên cột sau:

### **Flight Number Aliases:**
```
flight, flight_no, flt, dep_flight, dep_flt, mã chuyến, 
mã chuyến bay, số hiệu, flight_code, flt_num, arr_flight, arr_flt
```

### **STD (Scheduled Departure) Aliases:**
```
std, scheduled_departure, departure_time, dep_time, 
cất cánh, cất cánh dự tính, departure
```

### **STA (Scheduled Arrival) Aliases:**
```
sta, scheduled_arrival, arrival_time, arr_time, 
hạ cánh, hạ cánh dự tính, arrival
```

### **Aircraft Type Aliases:**
```
ac_type, aircraft, aircraft_type, aircraft_code, type, 
loại máy bay, ac, airframe
```

**Thêm aliases khác bằng cách chỉnh sửa `columnMappingService.ts`**

---

## ⚠️ Xử Lý Lỗi Thường Gặp

### **❌ "Required field is not mapped"**
**Nguyên nhân:** Cột contains flight number hoặc STD không được mapping

**Cách sửa:**
1. Click dropdown của "Flight Number" hoặc "STD"
2. Chọn cột đúng từ file Excel
3. Xem confidence score cập nhật

### **❌ "X rows have missing required fields"**
**Nguyên nhân:** Một số hàng không có dữ liệu trong flight number hoặc STD

**Cách sửa:**
- Những hàng này sẽ bị bỏ qua tự động
- Kiểm tra file Excel có dữ liệu đầy đủ không
- Có thể dùng "Show Preview" để xem hàng nào bị bỏ

### **⚠️ "Confidence score thấp (< 50%)"**
**Nguyên nhân:** Tên cột quá khác lạ, hệ thống không nhận ra

**Cách sửa:**
1. Nhấp dropdown và chọn cột đúng thủ công
2. Nếu cột không có, có thể bỏ qua (nếu là optional)

---

## 💡 Tips & Best Practices

### **✓ Best Practices**
1. **Đặt tên cột rõ ràng** trong Excel (VD: "Flight Number", "STD", "Aircraft Type")
2. **Luôn check date format** - Nếu thấy ngày lệch, enable "Excel Timezone Fix"
3. **Review Preview** trước upload - Đảm bảo dữ liệu đúng
4. **Chỉ upload hàng có required fields** - Hàng thiếu sẽ bị bỏ

### **✗ Tránh**
- Không để trống flight number hoặc STD (sẽ bị bỏ)
- Không dùng format ngày lạ (VD: "2024.12.25") - Hãy dùng "2024-12-25" hoặc "25/12/2024"
- Không mix data types trong 1 cột (VD: số và text chung lẫn)

---

## 📝 File Format Requirements

### **Excel File Format:**
- **Extensions**: .xlsx, .xls
- **First row**: Headers (tên cột)
- **Data rows**: Bắt đầu từ hàng 2
- **Max rows**: Hỗ trợ tối đa 10,000+ hàng (chunked upload)

### **Date/Time Format:**
Hệ thống tự động detect:
- ✓ "2024-12-25"
- ✓ "25/12/2024"
- ✓ "12/25/2024"
- ✓ "25-Dec-2024"
- ✓ Excel datetime serial numbers

### **Aircraft Type Format:**
- ✓ "A320", "A321", "B787", "B737"
- ✓ "Airbus A320", "Boeing 787-9"
- ✓ "320", "321", "787", "737"

---

## 🔧 Tuning Auto-Detection

### **Thêm Custom Aliases:**

Edit `utils/columnMappingService.ts`:

```typescript
acType: { 
  name: 'Aircraft Type',
  aliases: [
    // Existing...
    'ac_type', 'aircraft', 'type',
    // Add your custom names here:
    'máy bay', 'mã máy', 'acft_code',
  ],
  type: 'string',
  optional: true
}
```

---

## 📞 Troubleshooting

### **Data không upload được**
1. Kiểm tra validation status - có error không?
2. Check file Excel có corrupted không (mở lại)
3. Xem browser console (F12) để lỗi chi tiết
4. Thử lại với file mẫu

### **Mapping sai liên tục**
1. Rename columns trong Excel theo supported names
2. Dùng "Show Preview" để double-check
3. Manual mapping nếu auto-detect không hoạt động

### **Upload chậm**
- Bình thường là chunking 100 rows/request
- File 1000 hàng ≈ 10 requests
- Đợi cho đến khi thấy "✅ Successfully imported X flights"

---

## 🎬 Demo: Import File Mẫu

**File**: `flight_data_sample.xlsx`

**Columns:**
```
| Mã Chuyến | Cất Cánh DT | Hạ Cánh DT | Loại Máy | Từ  | Đến | PAX Đi | PAX Đến |
|-----------|-----------|-----------|---------|-----|-----|--------|---------|
| VN001     | 2024-12-25 | 2024-12-25 | A320    | HAN | SGN | 180    | 200     |
| VN002     | 2024-12-25 | 2024-12-25 | A321    | HAN | BKK | 230    | 250     |
```

**Auto-Detection Result:**
```
✓ flight: Mã Chuyến (100%)
✓ std: Cất Cánh DT (95%)
✓ sta: Hạ Cánh DT (94%)
✓ acType: Loại Máy (92%)
✓ from: Từ (100%)
✓ to: Đến (100%)
✓ depPax: PAX Đi (98%)
✓ arrPax: PAX Đến (96%)
```

→ **Tất cả mapped thành công! Click "Launch Dashboard" để import.**

---

## 📚 Thêm Tài Liệu

- [Column Mapping Service (columnMappingService.ts)](../utils/columnMappingService.ts)
- [FileUpload Component](../components/FileUpload.tsx)
- [Dispatch Import Handler](../pages/Dispatch.tsx#L816)
