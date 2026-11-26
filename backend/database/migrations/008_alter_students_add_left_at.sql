-- ============================================================
-- 008 - Bổ sung ngày nghỉ học cho học viên
-- Cần cho báo cáo biến động (danh sách học viên đã nghỉ theo tháng)
-- ============================================================

ALTER TABLE `students`
  ADD COLUMN `left_at` DATE NULL COMMENT 'Ngày nghỉ học (gán khi chuyển status = left)' AFTER `status`;
