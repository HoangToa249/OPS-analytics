# 🏗️ Hướng dẫn các thông số Khai thác Cơ sở hạ tầng (Infrastructure Metrics)

## Tổng quan

Module **Khai thác (Infrastructure)** trong Analytics cung cấp các chỉ số chi tiết về sử dụng các tài nguyên cơ sở hạ tầng chính của sân bay:
- **Gate (Cổng)** - Cổng hạ cánh/cất cánh
- **Stand (Vị trí)** - Vị trí đỗ máy bay
- **Belt/Carousel (Dây chuyền)** - Dây chuyền xử lý hành lý

---

## 1. GATE (CỔng Hạ cánh/Cất cánh)

### Định nghĩa
Gate là cơ sở vật chất nối máy bay với nhà ga, cho phép hành khách lên/xuống máy bay an toàn. Mỗi máy bay sử dụng một gate cho một lượt bay.

### Thông số chính

#### 📊 **Gate Utilization (%)**
- **Công thức**: `(Tổng phút sử dụng / Tổng phút trong ngày) × 100`
- **Ý nghĩa**: Phần trăm thời gian cổng được sử dụng trong ngày
- **Phạm vi**: 0% - 100%
- **Giải thích**:
  - **< 30%**: Cổng sử dụng nhẹ, dư năng lực
  - **30% - 60%**: Sử dụng bình thường, cân bằng tốt
  - **60% - 80%**: Sử dụng cao, gần tới giới hạn
  - **> 80%**: Sử dụng rất cao, có rủi ro tắc nghẽn

#### ✈️ **Flight Count** (Số chuyến)
- **Định nghĩa**: Số lượng máy bay sử dụng cổng trong khoảng thời gian
- **Ý nghĩa**: Chỉ lưu lượng giao thông tại cổng
- **Cách tính**: Đếm tổng số chuyến bay (cả đến và đi)

#### ⏱️ **Average Utilization Time** (Thời gian sử dụng trung bình)
- **Công thức**: `Tổng phút sử dụng / Số chuyến bay`
- **Đơn vị**: Phút (minutes)
- **Ý nghĩa**: Bình quân mỗi chuyến bay dừng bao lâu tại cổng
- **Giải thích**:
  - **15-30 phút**: Thời gian ngắn (hợp lý cho dòng chảy tốt)
  - **30-60 phút**: Thời gian trung bình
  - **> 60 phút**: Thời gian dài (có thể có chậm trễ)

#### 🚨 **Gate Conflicts** (Xung đột cổng)
- **Định nghĩa**: Số lần 2 chuyến bay có lịch sử dụng cổng chồng lập
- **Ý nghĩa**: Xung đột cho thấy vấn đề lập lịch hoặc chậm trễ
- **Ảnh hưởng**: Gây chậm trễ, phải điều chỉnh chuyến bay sang cổng khác
- **Giải pháp**:
  - Xem xét tăng số cổng available
  - Điều chỉnh lịch bay để tránh tập trung
  - Cải thiện hiệu suất xử lý

#### 📈 **Peak Hour** (Giờ cao điểm)
- **Định nghĩa**: Giờ trong ngày có số chuyến bay hoặc sử dụng cao nhất
- **Ý nghĩa**: Xác định thời gian tải cao nhất
- **Ứng dụng**: Lập kế hoạch nhân sự, bảo trì, khai thác

### Heatmap (Bản đồ nhiệt theo giờ)
- **Hiển thị**: Tỷ lệ sử dụng mỗi cổng từng giờ (0-23h)
- **Màu sắc**:
  - 🟦 Xanh nhạt (0-25%): Sử dụng nhẹ
  - 🟦 Xanh trung (25-50%): Sử dụng trung bình
  - 🟦 Xanh đậm (50-75%): Sử dụng cao
  - 🟦 Xanh rất đậm (75-100%): Sử dụng rất cao

### Scatter Plot: Conflicts vs Traffic
- **Trục X**: Số chuyến bay (Traffic)
- **Trục Y**: Số xung đột (Conflicts)
- **Ý nghĩa**: Xác định cổng "vấn đề" 
  - Cổng bên phải cao: Lưu lượng cao nhưng ít xung đột → Quản lý tốt
  - Cổng bên phải-cao: Lưu lượng cao + xung đột nhiều → Cần cải thiện

---

## 2. STAND (VỊ TRÍ ĐỖ MÁY BAY)

### Định nghĩa
Stand là vị trí ngoài nhà ga (remote stand) hoặc cổng (gate position) nơi máy bay được đỗ để xử lý hành khách, hành lý, nhiên liệu, và bảo dưỡng.

### Loại Stand

#### 🛬 **Arrival Stand** (Vị trí hạ cánh)
- Chỉ dùng cho chuyến bay đến
- Máy bay hạ cánh → Đỗ tại stand → Hành khách xuống

#### 🛫 **Departure Stand** (Vị trí cất cánh)
- Chỉ dùng cho chuyến bay đi
- Hành khách lên → Máy bay ở stand → Cất cánh

#### 🔄 **Mixed Stand** (Vị trí hỗn hợp)
- Dùng cho cả đến lẫn đi
- Linh hoạt nhưng yêu cầu quản lý phức tạp

### Thông số chính

#### 📊 **Stand Utilization (%)**
- **Công thức**: `(Tổng phút sử dụng / Tổng phút trong ngày) × 100`
- **Ý nghĩa**: Phần trăm thời gian stand được sử dụng
- **Mục tiêu tối ưu**: 50-70% (cho phép bảo dưỡng, buffer)

#### 🔄 **Turnaround Time** (Thời gian xoay vòng)
- **Định nghĩa**: Thời gian giữa khi một máy bay hạ cánh/đỗ và khi máy bay tiếp theo sử dụng stand
- **Công thức**: `Thời gian đến của chuyến tiếp theo - Thời gian cất cánh/rời của chuyến trước`
- **Đơn vị**: Phút (minutes)
- **Ý nghĩa**: Tốc độ xoay vòng máy bay, cao hơn = hiệu suất tốt hơn
- **Ví dụ**:
  - 15-20 phút: Rất tốt (máy bay xoay nhanh)
  - 30-45 phút: Bình thường
  - > 60 phút: Chậm, cần cải thiện quy trình

#### ✈️ **Flight Count** (Số chuyến)
- **Định nghĩa**: Số chuyến bay sử dụng stand
- **Ý nghĩa**: Mức độ sử dụng stand

#### 📈 **Peak Hour** (Giờ cao điểm)
- **Định nghĩa**: Giờ trong ngày có lưu lượng cao nhất

#### 🚨 **Stand Conflicts** (Xung đột vị trí)
- **Định nghĩa**: Số lần 2 chuyến bay có lịch sử sử dụng stand chồng lập
- **Ảnh hưởng**: Gây chậm trễ, phải điều chỉnh chuyến bay

### Phân bố Stand theo loại
- **Arrival Only** (%): Phần trăm stand chỉ dùng hạ cánh
- **Departure Only** (%): Phần trăm stand chỉ dùng cất cánh
- **Mixed A/D** (%): Phần trăm stand hỗn hợp

### Biểu đồ Turnaround Time
- Cho thấy xu hướng thời gian xoay vòng theo giờ
- Stand có turnaround dài → Quy trình xử lý chậm → Cần tối ưu hóa

---

## 3. BELT / CAROUSEL (DÂY CHUYỀN HÀNH LÝ)

### Định nghĩa
Belt/Carousel là hệ thống dây chuyền hoặc bàn quay tự động xử lý hành lý hàng loạt:
- **Arrival Belt**: Xử lý hành lý hạ xuống từ máy bay
- **Departure Belt**: Nhập hành lý lên máy bay
- **Transfer Belt**: Chuyển hành lý giữa các chuyến bay

### Thông số chính

#### 📦 **Throughput (pax/hour)** (Lưu lượng hành khách/giờ)
- **Công thức**: `Tổng hành khách xử lý / Tổng giờ hoạt động`
- **Đơn vị**: Hành khách/giờ (pax/hr)
- **Ý nghĩa**: Năng lực xử lý hành lý mỗi giờ
- **Ví dụ**:
  - Một belt xử lý 300 pax/hr
  - Nếu đó là belt hạ hành lý (baggage claim), có thể xử lý ~2-3 chuyến bay/giờ

#### ✈️ **Flight Count** (Số chuyến sử dụng)
- **Định nghĩa**: Số chuyến bay có hành lý qua belt
- **Ý nghĩa**: Mức độ phụ thuộc vào belt

#### 👥 **Total Passengers** (Tổng hành khách)
- **Định nghĩa**: Tổng số hành khách với hành lý qua belt
- **Ý nghĩa**: Khối lượng công việc tổng

#### 📊 **Utilization (%)**
- **Công thức**: `(Tổng phút sử dụng / Tổng phút trong ngày) × 100`
- **Ý nghĩa**: Phần trăm thời gian belt hoạt động
- **Mục tiêu**: 40-70% (cho phép bảo trì, buffer)
- **> 80%**: Rủi ro tắc nghẽn, hành lý bị chậm

#### 📈 **Peak Hour** (Giờ cao điểm)
- **Định nghĩa**: Giờ trong ngày có lưu lượng hành khách cao nhất
- **Ứng dụng**: Lập kế hoạch nhân sự, bảo trì

### Biểu đồ Hourly Distribution
- **Hiển thị**: Số hành khách qua mỗi belt từng giờ
- **Ý nghĩa**: Xác định thời gian tải cao
- **Ứng dụng**: Lập lịch bảo trì, điều chỉnh nhân sự

### Top Belts by Throughput
- Xác định belt nào có lưu lượng cao nhất
- Giúp ưu tiên bảo trì, cải thiện

---

## 4. KPI DASHBOARD (BẢNG ĐIỂM CHÍNH)

### KPI chính hiển thị
| KPI | Ý nghĩa | Mục tiêu |
|-----|---------|---------|
| **Total Flights** | Tổng số chuyến bay | - |
| **Avg Gate Util %** | Tỷ lệ sử dụng cổng trung bình | 40-60% |
| **Avg Stand Util %** | Tỷ lệ sử dụng stand trung bình | 50-70% |
| **Avg Belt Throughput** | Năng lực xử lý hành lý trung bình | Tùy kiến trúc |
| **Gate Conflicts** | Tổng số xung đột cổng | 0 (mục tiêu) |
| **Stand Conflicts** | Tổng số xung đột stand | 0 (mục tiêu) |

---

## 5. GIẢI THÍCH TÌNH HUỐNG & GIẢI PHÁP

### 5.1 Gate Utilization cao (> 80%)

**Nguyên nhân có thể**:
- Lịch bay tập trung (peak period)
- Máy bay chậm (slow turnaround)
- Maintenance được lên lịch kém

**Giải pháp**:
```
✓ Phân tán lịch bay trong ngày
✓ Tối ưu turnaround time (đỡ máy bay nhanh hơn)
✓ Tăng số gate (nếu có thể)
✓ Điều chỉnh gate assignments
```

### 5.2 Gate Conflicts nhiều

**Nguyên nhân**:
- Chuyến bay bị chậm → chiếm cổng lâu hơn dự kiến
- Lập lịch quá chặt (gap nhỏ giữa các chuyến)
- Hành khách lên/xuống chậm

**Giải pháp**:
```
✓ Tăng buffer time giữa các chuyến
✓ Tối ưu quy trình lên/xuống hành khách
✓ Cập nhật lịch bay thực tế
✓ Chuẩn bị gate sớm hơn
```

### 5.3 Stand Turnaround dài

**Nguyên nhân**:
- Xử lý hành lý chậm (baggage handling)
- Xử lý hành khách chậm
- Vệ sinh/bảo dưỡng lâu

**Giải pháp**:
```
✓ Cải thiện quy trình xử lý hành lý
✓ Tăng nhân sự ground handling
✓ Tối ưu vệ sinh nhanh chóng
✓ Điều chỉnh lịch bảo dưỡng
```

### 5.4 Belt Utilization cao (> 80%)

**Nguyên nhân**:
- Hành lý tập trung (peak hours)
- Belt bị hư hỏng, số lượng belt ít
- Lịch bay tập trung

**Giải pháp**:
```
✓ Thêm belt xử lý nếu có thể
✓ Phân tán lịch bay
✓ Bảo trì định kỳ để tránh gián đoạn
✓ Tối ưu quy trình loading/unloading
```

---

## 6. CÔNG THỨC TÍNH CHI TIẾT

### Gate / Stand Utilization
```
Utilization (%) = (∑ Duration_i) / (24 hours × 60) × 100

Trong đó:
- ∑ Duration_i = Tổng thời gian sử dụng tất cả chuyến
- 24 hours × 60 = Tổng phút trong ngày (1440 phút)
```

### Turnaround Time
```
Turnaround (min) = Departure_Time(Flight_N+1) - Arrival_Time(Flight_N)

Hoặc đối với xoay vòng từ cất cánh:
Turnaround (min) = Arrival_Time(Flight_N+1) - Departure_Time(Flight_N)
```

### Average Utilization Time per Flight
```
Avg Duration (min) = (∑ Duration_i) / (Number of Flights)
```

### Belt Throughput
```
Throughput (pax/hr) = (∑ Passengers_i) / (∑ Duration_i in hours)
```

---

## 7. CÁCH ĐỌC BIỂU ĐỒ

### Heatmap (Bản đồ nhiệt)
- **Hàng ngang**: Giờ trong ngày (0h-23h)
- **Hàng dọc**: Gate/Stand/Belt individual
- **Màu sắc**: Càng đậm = Sử dụng cao

### Scatter Plot
- **Trục X**: Số chuyến bay (volume)
- **Trục Y**: Số xung đột hoặc chỉ số khác
- **Bọt bên phải dưới**: Tốt (lưu lượng cao, xung đột ít)
- **Bọt bên phải trên**: Cảnh báo (lưu lượng cao, xung đột nhiều)

### Line Chart (Biểu đồ đường)
- **Đường lên**: Tăng từng bước
- **Đường xuống**: Giảm từng bước
- **Đường bằng**: Ổn định

---

## 8. BEST PRACTICES (THỰC HÀNH TỐT NHẤT)

| Chỉ số | Mục tiêu | Hành động |
|--------|---------|----------|
| **Gate Util** | 40-60% | Tối ưu lịch nếu > 70% |
| **Gate Conflicts** | 0 | Điều tra & xử lý ngay |
| **Turnaround** | < 30 phút | Cải thiện quy trình |
| **Stand Util** | 50-70% | Cân bằng giữa sử dụng & bảo trì |
| **Belt Util** | < 70% | Đảm bảo buffer cho peak |
| **Peak Hours** | Quản lý tốt | Lập kế hoạch nhân sự |

---

## 9. LIÊN HỆ & ĐỊNH NGHĨA THÊM

### Thuật ngữ
- **Pax**: Hành khách (Passenger)
- **Ground Handling**: Xử lý tại mặt đất (hành lý, hành khách)
- **Turnaround**: Vòng quay (thời gian từ hạ cánh đến cất cánh)
- **Buffer**: Thời gian đệm
- **Utilization**: Tỷ lệ sử dụng
- **Throughput**: Lưu lượng xử lý

### Liên hệ giữa các chỉ số
```
Gate Utilization ← Chuyến bay dựa vào gate assignment
              ↓
Gate Conflicts ← Overlap thời gian dùng gate
              
Stand Utilization ← Chuyến bay & thời gian đỗ stand
              ↓
Turnaround Time ← Thời gian xoay vòng stand
              
Belt Utilization ← Số hành khách & hành lý
              ↓
Belt Throughput ← Năng lực xử lý
```

---

## 📌 SUMMARY

- **Gate**: Dùng cho hạ cánh/cất cánh → Quản lý sự đã cập kế
- **Stand**: Dùng cho đỗ máy bay → Quản lý turnaround & efficiency
- **Belt**: Dùng cho hành lý → Quản lý năng lực xử lý

**Mục tiêu chung**: Tối ưu hóa sử dụng cơ sở hạ tầng, giảm xung đột, cải thiện hiệu suất hoạt động sân bay. 🎯
