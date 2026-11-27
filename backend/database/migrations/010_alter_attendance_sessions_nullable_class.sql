-- ============================================================
-- 010 - Cho phép điểm danh học viên chưa xếp lớp
-- attendance_sessions.class_id cho phép NULL (phiên dành cho
-- học viên chưa xếp lớp trong cơ sở).
-- ============================================================

ALTER TABLE `attendance_sessions`
  DROP FOREIGN KEY `fk_sessions_class`,
  DROP INDEX `uq_sessions_class_date_slot`;

ALTER TABLE `attendance_sessions`
  MODIFY COLUMN `class_id` INT UNSIGNED NULL COMMENT 'NULL = học viên chưa xếp lớp trong cơ sở',
  ADD COLUMN `class_scope` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 = chưa xếp lớp; ngược lại = class_id (phục vụ khoá duy nhất)' AFTER `class_id`,
  ADD UNIQUE KEY `uq_sessions_branch_class_date_slot` (`branch_id`, `class_scope`, `session_date`, `slot_name`),
  ADD CONSTRAINT `fk_sessions_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE `attendance_sessions` SET `class_scope` = IFNULL(`class_id`, 0);
