-- ============================================================
-- DELETE FLIGHT SCHEDULE DATA - MULTIPLE OPTIONS
-- ============================================================
-- Chạy các queries này trong Supabase SQL Editor
-- https://app.supabase.com/project/[your-project]/sql

-- ============================================================
-- OPTION 1: Xóa toàn bộ data trong flight_schedule
-- ============================================================
-- ⚠️ CẢNH BÁO: Xóa TẤT CẢ dữ liệu - KHÔNG CÓ UNDO
DELETE FROM flight_schedule;

-- Verify đã xóa:
SELECT COUNT(*) as remaining_rows FROM flight_schedule;


-- ============================================================
-- OPTION 2: Xóa data theo ngày cụ thể
-- ============================================================
-- Xóa tất cả flights có STD trong khoảng ngày (ví dụ: 2024-12-25)
DELETE FROM flight_schedule 
WHERE DATE(std) = '2024-12-25';

-- Hoặc xóa theo range ngày
DELETE FROM flight_schedule 
WHERE std >= '2024-12-25'::timestamp 
  AND std < '2024-12-26'::timestamp;

-- Verify:
SELECT COUNT(*) as remaining_rows FROM flight_schedule;


-- ============================================================
-- OPTION 3: Xóa data theo flight numbers cụ thể
-- ============================================================
-- Xóa flights có mã bắt đầu bằng "VN"
DELETE FROM flight_schedule 
WHERE dep_flight LIKE 'VN%' 
   OR arr_flight LIKE 'VN%';

-- Xóa flights cụ thể
DELETE FROM flight_schedule 
WHERE dep_flight IN ('VN001', 'VN002', 'VN003')
   OR arr_flight IN ('VN001', 'VN002', 'VN003');

-- Verify:
SELECT COUNT(*) as remaining_rows FROM flight_schedule;


-- ============================================================
-- OPTION 4: Xóa data theo airline (2 ký tự đầu của flight)
-- ============================================================
-- Xóa tất cả Vietnam Airlines (VN)
DELETE FROM flight_schedule 
WHERE SUBSTRING(COALESCE(dep_flight, arr_flight), 1, 2) = 'VN';

-- Verify:
SELECT COUNT(*) as remaining_rows FROM flight_schedule;


-- ============================================================
-- OPTION 5: Xóa data sau ngày cụ thể
-- ============================================================
-- Xóa tất cả flights sau 2024-12-25
DELETE FROM flight_schedule 
WHERE std > '2024-12-25'::timestamp;

-- Verify:
SELECT COUNT(*) as remaining_rows FROM flight_schedule;


-- ============================================================
-- OPTION 6: Xóa data cũ hơn N ngày
-- ============================================================
-- Xóa tất cả flights có STD cách đây hơn 30 ngày
DELETE FROM flight_schedule 
WHERE std < NOW() - INTERVAL '30 days';

-- Verify:
SELECT COUNT(*) as remaining_rows FROM flight_schedule;


-- ============================================================
-- OPTION 7: Xem dữ liệu trước khi xóa (SAFE)
-- ============================================================
-- Xem những dữ liệu sẽ bị xóa TRƯỚC khi thực hiện xóa
-- Run cái này TRƯỚC khi delete để chắc chắn!

-- Xem flights theo ngày
SELECT dep_flight, arr_flight, std, sta, ac_type 
FROM flight_schedule 
WHERE DATE(std) = '2024-12-25'
LIMIT 10;

-- Xem flights theo airline
SELECT dep_flight, arr_flight, std, sta, ac_type 
FROM flight_schedule 
WHERE SUBSTRING(COALESCE(dep_flight, arr_flight), 1, 2) = 'VN'
LIMIT 10;

-- Xem tổng số rows
SELECT COUNT(*) as total_rows FROM flight_schedule;


-- ============================================================
-- OPTION 8: Backup trước khi xóa
-- ============================================================
-- Tạo backup bảng trước khi xóa (an toàn)
CREATE TABLE flight_schedule_backup AS 
SELECT * FROM flight_schedule;

-- Sau đó xóa dữ liệu
DELETE FROM flight_schedule;

-- Nếu cần khôi phục:
-- INSERT INTO flight_schedule SELECT * FROM flight_schedule_backup;


-- ============================================================
-- OPTION 9: Xóa và reset ID sequence
-- ============================================================
-- Xóa tất cả data
DELETE FROM flight_schedule;

-- Reset ID sequence (nếu có ID auto-increment)
-- Thay "flight_schedule_id_seq" bằng tên sequence thực tế
ALTER SEQUENCE flight_schedule_id_seq RESTART WITH 1;


-- ============================================================
-- OPTION 10: Xóa từng batch an toàn
-- ============================================================
-- Xóa 100 hàng cùng lúc (tránh timeout)
-- Run multiple times

DELETE FROM flight_schedule 
WHERE id IN (
  SELECT id FROM flight_schedule 
  LIMIT 100
);

-- Kiểm tra còn bao nhiêu rows
SELECT COUNT(*) as remaining_rows FROM flight_schedule;


-- ============================================================
-- QUERIES HỮU DỤNG KHÁC
-- ============================================================

-- Xem thống kê data
SELECT 
  COUNT(*) as total_rows,
  COUNT(DISTINCT dep_flight) as unique_dep_flights,
  COUNT(DISTINCT arr_flight) as unique_arr_flights,
  COUNT(DISTINCT DATE(std)) as unique_dates,
  MIN(std) as earliest_flight,
  MAX(std) as latest_flight
FROM flight_schedule;

-- Xem breakdown theo ngày
SELECT 
  DATE(std) as flight_date,
  COUNT(*) as flight_count,
  COUNT(DISTINCT SUBSTRING(COALESCE(dep_flight, arr_flight), 1, 2)) as unique_airlines
FROM flight_schedule
GROUP BY DATE(std)
ORDER BY flight_date DESC;

-- Xem breakdown theo airline
SELECT 
  SUBSTRING(COALESCE(dep_flight, arr_flight), 1, 2) as airline_code,
  COUNT(*) as flight_count
FROM flight_schedule
GROUP BY airline_code
ORDER BY flight_count DESC;

-- Xem flights với gate/counter info
SELECT 
  dep_flight, arr_flight, std, sta, gate, counters
FROM flight_schedule
WHERE gate IS NOT NULL 
   OR counters IS NOT NULL
LIMIT 20;
