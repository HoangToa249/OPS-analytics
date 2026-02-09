# 📊 Giải Thích Các Chỉ Số Phân Tích - Gate, Belt, Stand

## 🚪 GATE ANALYTICS (Cổng Khí Tượng)

### Chỉ Số Chính

| Chỉ Số | Ý Nghĩa | Công Thức | Ví Dụ |
|--------|---------|----------|------|
| **Total Flights** | Tổng số chuyến bay sử dụng cổng | Đếm số lượng chuyến | Gate A1: 45 chuyến |
| **Utilization %** | Tỷ lệ thời gian cổng được sử dụng trong ngày | `(tổng phút sử dụng / 1440 phút) × 100%` | 65% = cổng được sử dụng 936 phút trong ngày |
| **Avg Use (min)** | Thời gian sử dụng trung bình mỗi chuyến | `tổng phút / số chuyến` | 30 phút = chuyến bay trung bình dùng cổng 30 phút |
| **Peak Hour** | Giờ có nhiều chuyến bay nhất | Giờ (0-23) với số chuyến max | 14:00 = 14h có 8 chuyến |
| **Conflicts** | Số xung đột lịch trình (2+ chuyến trùng thời gian) | Đếm cặp chuyến bay có thời gian trùng | 3 xung đột = 3 lần có chuyến bay chờ |

### Cách Tính Utilization % (Quan trọng nhất)

```
Utilization % = (Tổng phút sử dụng / 1440 phút) × 100

Ví dụ:
- Gate A1 được sử dụng từ 06:00-08:00 (120 phút) và 14:00-17:00 (180 phút)
- Tổng = 300 phút
- Utilization = (300 / 1440) × 100 = 20.8%
```

### Màu Sắc Chỉ Báo Utilization

- 🟢 **Xanh** (<50%): Bình thường, chưa tập trung
- 🟡 **Vàng** (50-70%): Trung bình, tập trung vừa phải
- 🔴 **Đỏ** (>70%): Cao, rất tập trung, có nguy cơ quá tải

---

## 🏢 STAND ANALYTICS (Sân Đỗ)

### Chỉ Số Chính

| Chỉ Số | Ý Nghĩa | Công Thức | Ví Dụ |
|--------|---------|----------|------|
| **Stand Type** | Loại sân đỗ | `arr` (Hạ cánh), `dep` (Cất cánh), `mixed` (Hỗn hợp) | Bay S01: Arrival (chỉ hạ cánh) |
| **Total Flights** | Tổng số chuyến bay sử dụng sân | Đếm chuyến | 38 chuyến |
| **Utilization %** | Tỷ lệ thời gian sân được chiếm dụng | `(tổng phút / 1440) × 100%` | 52% = 748 phút/ngày |
| **Turnaround (min)** | Thời gian trung bình giữa 2 chuyến bay liên tiếp | Khoảng cách thời gian = Hạ cánh chuyến 1 → Cất cánh chuyến 2 | 45 phút = trung bình 45 phút để chuẩn bị bay tiếp |
| **Peak Hour** | Giờ bận nhất sân | Giờ có chiều dài sử dụng tổng cộng max | 15:00 |
| **Conflicts** | Xung đột sử dụng sân (2+ chuyến trùng thời gian) | Đếm cặp chuyến trùng | 2 xung đột |

### Khác Biệt: Sân Đỗ Có Hạ + Cất (Paired Stand)

```
Sân hỗn hợp (Mixed) = Cùng 1 sân vừa hạ cánh vừa cất cánh

Ví dụ:
- Chuyến VN100: Hạ cánh S01 lúc 10:00, Cất cánh S01 lúc 11:30
- Lúc 10:00-11:30, sân S01 bị chiếm dụng 90 phút
- Sau 11:30, sân S01 mới được sử dụng cho chuyến khác

⚠️ Nếu là sân riêng hạ (S01) và riêng cất (S02):
- S01: 10:00-10:30 (30 phút hạ cánh)
- S02: 10:45-11:30 (45 phút cất cánh)
- Thời gian trung bị là 15 phút (10:30 → 10:45)
```

### Turnaround Time Chi Tiết

```
Turnaround = Thời gian chuẩn bị máy bay giữa hạ cánh và cất cánh

Tính toán:
- Hạ cánh lúc 10:30
- Cất cánh lúc 11:45
- Turnaround = 11:45 - 10:30 = 75 phút

Điều kiện để có turnaround:
1. Chuyến 1 hạ cánh ở sân X
2. Chuyến 2 cất cánh ở sân X
3. Máy bay là cùng chiếc (same aircraft)
4. Chuyến 2 là tiếp theo sau chuyến 1 ở sân X

Nếu không thỏa → Không tính turnaround
```

---

## 🛄 BELT ANALYTICS (Băng Chuyên Hành Lý)

### Chỉ Số Chính

| Chỉ Số | Ý Nghĩa | Công Thức | Ví Dụ |
|--------|---------|----------|------|
| **Total Belts** | Tổng số băng chuyên hành lý | Đếm | 8 băng |
| **Total Passengers** | Tổng số hành khách hạ cánh qua tất cả băng | Tính từ field `arrPax` | 125,450 hành khách |
| **Avg Throughput** | Thông lượng trung bình (hành khách/giờ) | `tổng hành khách / tổng giờ hoạt động` | 850 hành khách/giờ |
| **Total Flights** | Số chuyến bay hạ cánh | Đếm chuyến | 248 chuyến |
| **Throughput/Belt** | Thông lượng của từng băng | `hành khách qua băng / tổng phút × 60` | Băng 4: 920 hành khách/giờ |
| **Utilization %** | Tỷ lệ băng được sử dụng | `(phút sử dụng / 1440) × 100%` | 68% |
| **Peak Hour** | Giờ nhiều hành khách nhất | Giờ với tổng `arrPax` cao nhất | 15:00 |

### Cách Tính Throughput

```
Throughput = Hành khách / Giờ

Ví dụ: Tính trong 1 ngày
- Băng 1: 5,200 hành khách
- Thời gian hoạt động: 12 giờ (08:00-20:00)
- Throughput = 5,200 / 12 = 433 hành khách/giờ

Hay:
- Từ 06:00-22:00 (16 giờ)
- Throughput = 5,200 / 16 = 325 hành khách/giờ
```

### Passenger Distribution

```
Phân bố hành khách theo băng:

Tổng 125,450 hành khách → Chia đều cho 8 băng?

Không! Một số băng có thể:
- Xử lý các chuyến lớn (A380, B777, A350)
- Hoạt động lâu hơn (cả ngày)
- Có vị trí thuận lợi

Kết quả: Một số băng xử lý 20%, số khác chỉ 8%
```

---

## 📈 PEAK HOUR (Giờ Cao Điểm)

### Định Nghĩa Cho Mỗi Loại

#### Gate Peak Hour
```
Giờ có nhiều chuyến bay nhất sử dụng cổng
- Tính: Đếm số chuyến bay có gateStart trong giờ đó
- Ví dụ: 14:00-15:00 có 12 chuyến → Peak Hour = 14:00
```

#### Stand Peak Hour
```
Giờ có chiều dài sử dụng sân dài nhất (tổng phút)
- Tính: Tổng phút sân bị chiếm dụng trong giờ
- Ví dụ: 
  - 15:00-16:00: 2 chuyến (30+45 phút) = 75 phút
  - 16:00-17:00: 3 chuyến (20+15+25 phút) = 60 phút
  - Peak Hour = 15:00 (75 phút > 60 phút)
```

#### Belt Peak Hour
```
Giờ có nhiều hành khách hạ cánh nhất
- Tính: Tổng arrPax của tất cả chuyến bay hạ cánh trong giờ
- Ví dụ:
  - 14:00-15:00: 5 chuyến (300+250+400+350+200 = 1,500 hành khách)
  - 15:00-16:00: 4 chuyến (280+320+350+200 = 1,150 hành khách)
  - Peak Hour = 14:00
```

---

## ⚠️ CONFLICTS (Xung Đột)

### Định Nghĩa

**Xung đột** = 2 hay nhiều chuyến bay yêu cầu sử dụng cùng tài nguyên (Gate/Stand) **tại cùng một thời điểm**

### Gate Conflicts

```
Ví dụ: Gate A1
- Chuyến VN100: 10:00-10:45 (gateStart-gateEnd)
- Chuyến BA200: 10:30-11:15 (gateStart-gateEnd)

Xung đột! ❌ 
- Thời gian trùng: 10:30-10:45 (15 phút)
- Một chuyến phải chờ

Tính toán xung đột:
- Kiểm tra tất cả cặp chuyến tại Gate A1
- Nếu khoảng thời gian trùng → Đếm là 1 xung đột
```

### Stand Conflicts (Phức Tạp Hơn)

```
Sân có thể có 2 loại sử dụng:

1. Arrival (Hạ cánh): sta → ata → (nếu cùng sân) → std
   VD: 10:00 (sta) → 10:05 (ata) → 11:45 (std)

2. Departure (Cất cánh): std → atd
   VD: 11:45 (std) → 12:30 (atd)

Xung đột khi:
- Chuyến 1 hạ cánh 10:30-11:45
- Chuyến 2 cất cánh 11:00-11:50
- Trùng 11:00-11:45 ❌

Hoặc:
- Chuyến 1 hạ cánh 10:30-10:50
- Chuyến 2 hạ cánh 10:40-11:15
- Trùng 10:40-10:50 ❌
```

### Belt Conflicts

```
Văn phòng hành lý thường không có conflicts
(Không phải tài nguyên cộng dùng bắt buộc)

Nhưng nếu tính:
- Nhiều chuyến hạ cánh cùng lúc
- Vượt khả năng xử lý (throughput max)
```

---

### Vấn Đề: Tại Sao Utilization % > 100%?

**Lý do**: Khi có **conflicts (xung đột)** - 2+ chuyến bay yêu cầu sử dụng cùng tài nguyên **tại cùng thời điểm**, code cũ không merge khoảng thời gian trùng nhau, mà cộng thêm từng phút riêng lẻ.

#### Ví Dụ Bug Cũ:

```
Gate A1:
- Chuyến 1: 10:00-11:00 (60 phút)
- Chuyến 2: 10:30-11:30 (60 phút) - CONFLICT 30 phút

❌ Tính Sai:
  totalUtilMin = 60 + 60 = 120 phút
  Utilization % = (120 / 1440) × 100 = 8.33%
  ✓ Không >100% nhưng không chính xác!

✅ Tính Đúng (sau fix):
  Merge intervals: 10:00-11:30 = 90 phút
  Utilization % = (90 / 1440) × 100 = 6.25%
```

#### Khi Nào Có >100%?

```
Gate A1 có RẤT NHIỀU xung đột:
- Chuyến 1: 06:00-08:00 (120 phút)
- Chuyến 2: 07:00-10:00 (180 phút)
- Chuyến 3: 09:00-12:00 (180 phút)
- ... 20 chuyến như thế

❌ Tính Sai:
  totalUtilMin = 120 + 180 + 180 + ... = 3,800 phút
  Utilization % = (3,800 / 1440) × 100 = 264% ⚠️ >100%!

✅ Tính Đúng (sau fix):
  Merge: 06:00-12:00 = 360 phút (max)
  Utilization % = (360 / 1440) × 100 = 25%
  (+ những giờ khác ngoài 06:00-12:00)
```

### Cách Fix ✅ (Đã Áp Dụng)

1. **Thêm hàm `mergeIntervals()`**: 
   - Lấy tất cả time intervals
   - Sort theo start time
   - Merge overlapping intervals
   - Tính tổng phút từ merged intervals

2. **Cap Utilization % ≤ 100%**:
   - Dù sao cũng không thể >100% vì chỉ có 1,440 phút/ngày
   - Code: `Math.min(calculation, 100)`

3. **Áp dụng cho**:
   - ✅ Gate Stats
   - ✅ Stand Stats  
   - ✅ Belt Stats

### Công Thức Sửa

```typescript
// Cũ (SAI):
const totalUtilMin = utilizationTimes.reduce((a, b) => a + b, 0);
const utilizationPercent = (totalUtilMin / 1440) * 100;  // Có thể >100%

// Mới (ĐÚNG):
const totalUtilMin = getTotalMinutesWithoutDoubleCount(intervals);
const utilizationPercent = Math.min((totalUtilMin / 1440) * 100, 100);
```

❌ **Trước fix**: Có thể thấy Utilization % như 150%, 200% → **Bug**
✅ **Sau fix**: Utilization % max = 100% → **Đúng**

### Gate A1 - Thống Kê Hôm 8/2/2026

```
✈️ Chuyến bay:
1. VN100: Hạ cánh 06:15, Gate 06:15-06:45 (30 phút) [6:00-7:00]
2. VN200: Hạ cánh 07:30, Gate 07:30-08:10 (40 phút) [7:00-8:00]
3. BA300: Hạ cánh 08:45, Gate 08:45-09:20 (35 phút) [8:00-9:00]
...
42. AF999: Hạ cánh 22:15, Gate 22:15-22:50 (35 phút) [22:00-23:00]

📊 KPI:
- Total Flights: 42 chuyến
- Total Utilization Min: 42 × 33 = 1,386 phút
- Utilization %: (1,386 / 1,440) × 100 = 96.3% ⚠️ RẤT CAO!
- Avg Use: 1,386 / 42 = 33 phút/chuyến
- Peak Hour: 14:00 (9 chuyến bay)
- Conflicts: 0 (không có chuyến trùng lịch)

✅ Kết luận:
- Gate A1 được sử dụng 96% ngày
- Cổng này quá bận, cần phân tải
```

### Stand S10 - Sân Hỗn Hợp

```
✈️ Chuyến bay (cùng máy bay A320):
1. SQ501 Hạ cánh: 07:00 (STA) → 07:05 (ATA)
   - Cất cánh: 08:30 (STD) → 08:35 (ATD)
   - Turnaround: 08:30 - 07:05 = 85 phút
   - Sân chiếm dụng: 07:05-08:35 (90 phút)

2. SQ502 Hạ cánh: 08:50 (STA) → 08:55 (ATA)
   - Cất cánh: 10:15 (STD) → 10:20 (ATD)
   - Turnaround: 10:15 - 08:35 = 100 phút (chuyến trước)
   - Sân chiếm dụng: 08:55-10:20 (85 phút)

📊 KPI:
- Total Flights: 2 chuyến (chỉ tính HK từ sân S10)
- Stand Type: mixed (vừa hạ vừa cất)
- Total Utilization: 90 + 85 = 175 phút
- Utilization %: (175 / 1,440) × 100 = 12.2%
- Avg Turnaround: 85 phút (chỉ 1 turnaround)
- Avg Utilization per flight: 175 / 2 = 87.5 phút
- Conflicts: 0

✅ Kết luận:
- Sân S10 không bận
- Turnaround thoải mái 80-100 phút
```

### Belt 4 - Hành Lý

```
✈️ Chuyến bay hạ cánh:
1. VN100: Hạ cánh 06:20, 245 hành khách → 06:00-07:00
2. BA200: Hạ cánh 07:45, 310 hành khách → 07:00-08:00
3. SQ300: Hạ cánh 08:30, 280 hành khách → 08:00-09:00
...
35. AF900: Hạ cánh 22:40, 220 hành khách → 22:00-23:00

📊 KPI:
- Total Flights: 35 chuyến hạ cánh
- Total Passengers: 9,200 hành khách
- Avg Throughput: 9,200 / 18 giờ = 511 hành khách/giờ
- Utilization %: (18 × 60 / 1,440) × 100 = 75%
- Peak Hour: 15:00 (1,050 hành khách)

✅ Kết luận:
- Belt 4 xử lý 511 pax/giờ
- Peak 15:00 cao nhất với 1,050 pax
- Băng chuyên khá bận, chuẩn bị tốt là cần thiết
```

---

## 🔄 Mối Liên Hệ Giữa Các Chỉ Số

### Công Thức Quy Đổi

```
1. Utilization % ↔ Phút sử dụng
   Utilization % × 1,440 / 100 = Phút sử dụng
   Ví dụ: 65% → 65 × 1,440 / 100 = 936 phút

2. Flights ↔ Avg Use
   Total Min / Number of Flights = Avg Use
   Ví dụ: 936 phút / 20 chuyến = 46.8 phút/chuyến

3. Passengers ↔ Throughput (Belt)
   Total Passengers / Hours = Throughput
   Ví dụ: 10,000 pax / 18 giờ = 556 pax/giờ

4. Conflicts ↔ Scheduling Pressure
   Nếu conflicts ↑ → Cần sắp xếp tốt hơn
   Nếu conflicts = 0 → Lịch trình tốt
```

### Công Thức Tối Ưu Hóa

```
Để giảm Conflicts:
- Phân tán chuyến bay đều trong ngày
- Tăng thời gian chế độ standby
- Sử dụng cổng/sân thay thế

Để giảm Turnaround:
- Tối ưu hóa quy trình chuẩn bị máy bay
- Sử dụng dịch vụ mặt đất nhanh
- Tuyên truyền hành khách lên máy sớm

Để tăng Throughput (Belt):
- Thêm băng chuyên
- Tăng tốc độ xử lý
- Cân bằng tải cho các băng
```

---

## 📌 Tóm Tắt Nhanh

| Loại | Chỉ Số Quan Trọng Nhất | Mục Tiêu Tối Ưu |
|------|----------------------|-----------------|
| **Gate** | Utilization %, Conflicts | < 70% util, 0 conflict |
| **Stand** | Utilization %, Turnaround | < 60% util, 45-90 min turnaround |
| **Belt** | Throughput, Peak Hour | > 400 pax/hr, balanced |

---

**Cập nhật lần cuối**: 8/2/2026  
**Phiên bản**: 2.0 - Đầy đủ công thức + Ví dụ thực tế
