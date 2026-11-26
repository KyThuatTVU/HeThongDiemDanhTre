-- ============================================================
-- SEED 001 - Hai cơ sở thực tế của trung tâm
-- Chạy SAU khi đã import đủ migrations 001 -> 007
-- ============================================================

INSERT INTO `branches` (`code`, `name`, `status`) VALUES
('TN', 'Cơ sở Tân Nhựt', 'active'),
('CL', 'Cơ sở Càng Long', 'active');
