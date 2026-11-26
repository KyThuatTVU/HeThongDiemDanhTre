-- ============================================================
-- HappyKidsCK - Tạo cơ sở dữ liệu
-- Chạy file này trước, sau đó CHỌN database `happykidsck` trên
-- phpMyAdmin (hoặc dùng tham số -D happykidsck nếu import bằng CLI)
-- rồi lần lượt import 001 -> 007 và thư mục ../seeds/
-- ============================================================

CREATE DATABASE IF NOT EXISTS `happykidsck`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
