<?php
declare(strict_types=1);

// Dự phòng khi truy cập thư mục gốc / (đảm bảo không bao giờ báo 403 Forbidden trên hosting)
header('Location: login/', true, 302);
exit;
