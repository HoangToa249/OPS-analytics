# 🗑️ Hướng Dẫn Xóa Dữ Liệu Flight Schedule

## ⚠️ CẢNH BÁO

- **Xóa dữ liệu là VĨNH VIỄN** - Không thể hoàn tác (trừ khi có backup)
- **Kiểm tra kỹ trước khi xóa** - Xem preview trước khi delete
- **Backup trước nếu cần** - Dùng OPTION 8

---

## 📋 Các Tùy Chọn Xóa Dữ Liệu

### **🔴 OPTION 1: Xóa Toàn Bộ Data**

**Khi nào dùng**: Muốn reset hoàn toàn, xóa tất cả flights

**SQL Command**:
```sql
DELETE FROM flight_schedule;
```

**Verify** (xem còn bao nhiêu rows):
```sql
SELECT COUNT(*) FROM flight_schedule;
```

**⚠️ CẢN THẬN**: Xóa TẤT CẢ - Không thể undo!

---

### **🟠 OPTION 2: Xóa Data Theo Ngày**

**Khi nào dùng**: Xóa flights của 1 ngày cụ thể (ví dụ: 2024-12-25)

**SQL Command**:
```sql
DELETE FROM flight_schedule 
WHERE DATE(std) = '2024-12-25';
```

**Hoặc xóa range ngày**:
```sql
DELETE FROM flight_schedule 
WHERE std >= '2024-12-25'::timestamp 
  AND std < '2024-12-26'::timestamp;
```

**Verify**:
```sql
SELECT COUNT(*) FROM flight_schedule WHERE DATE(std) = '2024-12-25';
```

---

### **🟡 OPTION 3: Xóa Flights Cụ Thể**

**Khi nào dùng**: Xóa vài flights nhất định (VN001, VN002, etc.)

**SQL Command**:
```sql
DELETE FROM flight_schedule 
WHERE dep_flight IN ('VN001', 'VN002', 'VN003')
   OR arr_flight IN ('VN001', 'VN002', 'VN003');
```

**Verify**:
```sql
SELECT * FROM flight_schedule 
WHERE dep_flight IN ('VN001', 'VN002', 'VN003');
```

---

### **🟢 OPTION 4: Xóa Theo Airline**

**Khi nào dùng**: Xóa tất cả flights của 1 hãng (VN, VJ, QH, etc.)

**SQL Command**:
```sql
-- Xóa tất cả Vietnam Airlines (VN)
DELETE FROM flight_schedule 
WHERE SUBSTRING(COALESCE(dep_flight, arr_flight), 1, 2) = 'VN';
```

**Verify**:
```sql
SELECT COUNT(DISTINCT SUBSTRING(COALESCE(dep_flight, arr_flight), 1, 2)) 
FROM flight_schedule;
```

---

### **🔵 OPTION 5: Xóa Data Cũ**

**Khi nào dùng**: Xóa flights cách đây hơn N ngày

**SQL Command** (xóa data cách đây > 30 ngày):
```sql
DELETE FROM flight_schedule 
WHERE std < NOW() - INTERVAL '30 days';
```

**Verify**:
```sql
SELECT MIN(std), MAX(std) FROM flight_schedule;
```

---

### **🟣 OPTION 6: Xóa Batch An Toàn**

**Khi nào dùng**: File quá lớn, muốn xóa từng batch

**SQL Command** (xóa 100 hàng cùng lúc):
```sql
DELETE FROM flight_schedule 
WHERE id IN (
  SELECT id FROM flight_schedule LIMIT 100
);

-- Lặp lại cho đến khi COUNT(*) = 0
```

**Verify sau mỗi batch**:
```sql
SELECT COUNT(*) FROM flight_schedule;
```

---

## ✅ Cách Làm An Toàn

### **Bước 1: Xem Preview Trước Khi Xóa**

**LUÔN luôn run cái này TRƯỚC delete**:

```sql
-- Xem có bao nhiêu rows sẽ bị xóa?
SELECT COUNT(*) as rows_to_delete 
FROM flight_schedule 
WHERE DATE(std) = '2024-12-25';  -- Thay ngày/condition của bạn

-- Xem mẫu 5 hàng sẽ bị xóa
SELECT * 
FROM flight_schedule 
WHERE DATE(std) = '2024-12-25'   -- Thay ngày/condition của bạn
LIMIT 5;
```

### **Bước 2: Copy DELETE Statement**

Copy SQL command xóa từ mục trên

### **Bước 3: Run DELETE**

Paste vào SQL Editor → Click "Execute"

### **Bước 4: Verify**

Run lại COUNT(*) để kiểm tra

---

## 🔄 Cách Khôi Phục Nếu Xóa Nhầm

### **Cách 1: Dùng Backup**

Nếu bạn đã tạo backup trước:
```sql
INSERT INTO flight_schedule 
SELECT * FROM flight_schedule_backup;
```

### **Cách 2: Reload Data**

Nếu data từ Excel file:
1. Mở lại Analytics/Dispatch page
2. Upload file Excel lại
3. Import lại data

### **Cách 3: Ask Admin**

Nếu không có backup:
- Supabase có thể recover nếu trong vòng 7 ngày
- Contact Supabase support

---

## 📊 Xem Thống Kê Trước Khi Xóa

**Xem tổng data**:
```sql
SELECT COUNT(*) as total FROM flight_schedule;
```

**Xem breakdown theo ngày**:
```sql
SELECT 
  DATE(std) as date,
  COUNT(*) as flights
FROM flight_schedule
GROUP BY DATE(std)
ORDER BY date DESC;
```

**Xem breakdown theo airline**:
```sql
SELECT 
  SUBSTRING(COALESCE(dep_flight, arr_flight), 1, 2) as airline,
  COUNT(*) as flights
FROM flight_schedule
GROUP BY airline
ORDER BY flights DESC;
```

**Xem flights cụ thể**:
```sql
SELECT dep_flight, arr_flight, std, sta, ac_type, gate
FROM flight_schedule
WHERE DATE(std) = '2024-12-25'
LIMIT 20;
```

---

## 🚀 Hướng Dẫn Step-by-Step

### **Step 1: Đăng Nhập Supabase**

1. Vào https://app.supabase.com
2. Chọn project của bạn
3. Click "SQL Editor" bên trái

### **Step 2: Mở File SQL**

- Mở file `DELETE_FLIGHT_DATA.sql`
- Hoặc copy-paste SQL command từ trên

### **Step 3: Xem Preview**

```sql
-- RUN CÁI NÀY TRƯỚC
SELECT COUNT(*) FROM flight_schedule 
WHERE DATE(std) = '2024-12-25';  -- Thay giá trị của bạn
```

### **Step 4: Xóa Data**

```sql
-- RUN sau khi confirmed với Step 3
DELETE FROM flight_schedule 
WHERE DATE(std) = '2024-12-25';  -- Thay giá trị của bạn
```

### **Step 5: Verify**

```sql
-- Kiểm tra đã xóa thành công
SELECT COUNT(*) FROM flight_schedule;
```

---

## 🎯 Ví Dụ Thực Tế

### **Ví Dụ 1: Xóa Data Ngày 25/12/2024**

```sql
-- Bước 1: Xem preview
SELECT COUNT(*) as flights_to_delete 
FROM flight_schedule 
WHERE DATE(std) = '2024-12-25';
-- Result: 250 flights

-- Bước 2: Xem mẫu
SELECT * FROM flight_schedule 
WHERE DATE(std) = '2024-12-25' 
LIMIT 5;
-- Verify đúng data

-- Bước 3: Xóa
DELETE FROM flight_schedule 
WHERE DATE(std) = '2024-12-25';

-- Bước 4: Verify
SELECT COUNT(*) FROM flight_schedule;
-- Result: đã giảm 250 flights
```

### **Ví Dụ 2: Xóa Toàn Bộ**

```sql
-- Bước 1: Xem tổng
SELECT COUNT(*) as total FROM flight_schedule;
-- Result: 5000 flights

-- Bước 2: Xóa
DELETE FROM flight_schedule;

-- Bước 3: Verify
SELECT COUNT(*) FROM flight_schedule;
-- Result: 0
```

### **Ví Dụ 3: Xóa Vietnam Airlines**

```sql
-- Bước 1: Xem preview
SELECT COUNT(*) as vn_flights 
FROM flight_schedule 
WHERE SUBSTRING(COALESCE(dep_flight, arr_flight), 1, 2) = 'VN';
-- Result: 1500 VN flights

-- Bước 2: Xóa
DELETE FROM flight_schedule 
WHERE SUBSTRING(COALESCE(dep_flight, arr_flight), 1, 2) = 'VN';

-- Bước 3: Verify
SELECT SUBSTRING(COALESCE(dep_flight, arr_flight), 1, 2) as airline, 
       COUNT(*) 
FROM flight_schedule
GROUP BY airline;
-- VN should be gone
```

---

## ⚙️ Advanced: Batch Delete (Để Tránh Timeout)

**Nếu xóa quá nhiều dữ liệu 1 lúc**, dùng batch:

```sql
-- Xóa 500 hàng cùng lúc, lặp lại
DELETE FROM flight_schedule 
WHERE id IN (
  SELECT id FROM flight_schedule 
  LIMIT 500
);

-- Run lại cho đến khi COUNT(*) = 0
```

---

## 🛡️ Backup Before Delete (Recommended)

```sql
-- Bước 1: Tạo backup
CREATE TABLE flight_schedule_backup AS 
SELECT * FROM flight_schedule;

-- Bước 2: Xóa data (giờ đã an toàn)
DELETE FROM flight_schedule;

-- Bước 3: Nếu cần khôi phục
INSERT INTO flight_schedule 
SELECT * FROM flight_schedule_backup;

-- Bước 4: Xóa backup (tuỳ chọn)
DROP TABLE flight_schedule_backup;
```

---

## 🚫 Điều TUYỆT ĐỐI KHÔNG Nên Làm

❌ **Không xóa** không xem preview  
❌ **Không xóa** mà không backup  
❌ **Không chạy** TRUNCATE (xóa luôn tất cả)  
❌ **Không xóa** bảng (table drop)  
❌ **Không chỉnh sửa** schema khi xóa data  

---

## 📞 Khi Nào Cần Help

| Tình Huống | Cách Làm |
|-----------|---------|
| Không sure nên xóa cái nào | Run SELECT để xem preview trước |
| Xóa nhầm | Dùng backup hoặc reload data từ Excel |
| Query bị error | Check syntax, database có thể bảo vệ RLS |
| Xóa quá lâu | Dùng batch delete (500 rows/query) |
| Không thấy effect | Refresh page hoặc wait 2-3 giây |

---

## 📈 Performance Tips

- ✓ Xóa theo batch nếu >1000 rows
- ✓ Index trên `std` + `dep_flight` giúp xóa nhanh
- ✓ Xóa vào off-peak hours (không khi user đang dùng)
- ✓ Không DROP table, chỉ DELETE rows

---

## 🎓 SQL References

| Command | Dùng Cho | Ví Dụ |
|---------|---------|-------|
| DELETE ... WHERE | Xóa theo điều kiện | DELETE WHERE DATE(std) = '...' |
| TRUNCATE | Xóa toàn bộ (fast) | TRUNCATE flight_schedule |
| DROP | Xóa bảng (DANGER) | DROP TABLE flight_schedule |
| IN | Xóa list | WHERE id IN (1,2,3) |
| LIKE | Xóa pattern | WHERE flight LIKE 'VN%' |
| BETWEEN | Xóa range | WHERE std BETWEEN ... AND ... |

---

**Ghi chú cuối**: Luôn luôn **xem preview** → **backup** → **delete** → **verify**

An toàn hơn hết! 🛡️
