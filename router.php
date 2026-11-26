<?php
declare(strict_types=1);

/**
 * Front Controller cho URL thân thiện của frontend.
 * Whitelist tuyệt đối: không dùng tham số người dùng để ghép đường dẫn tệp.
 */
const PAGE_ROUTES = [
    'login' => 'auth/login',
    'select-branch' => 'auth/select-branch',
    'dashboard' => 'dashboard/overview',
    'students' => 'students/list',
    'student-form' => 'students/form',
    'student' => 'students/detail',
    'classes' => 'classes/list',
    'class-form' => 'classes/form',
    'class' => 'classes/detail',
    'attendance' => 'attendance/today',
    'attendance-board' => 'attendance/board',
    'attendance-history' => 'attendance/history',
    'tuition' => 'tuition/list',
    'tuition-board' => 'tuition/board',
    'tuition-detail' => 'tuition/detail',
    'staff' => 'staff/list',
    'staff-form' => 'staff/form',
    'branches' => 'branches/list',
    'branch-form' => 'branches/form',
    'report-students' => 'reports/students',
    'report-attendance' => 'reports/attendance',
    'report-attendance-summary' => 'reports/attendance-summary',
    'report-tuition' => 'reports/tuition',
    'report-movements' => 'reports/movements',
    'logs' => 'logs/list',
    'settings' => 'settings/tuition-rules',
    'profile' => 'profile/account',
];

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method !== 'GET' && $method !== 'HEAD') {
    http_response_code(405);
    header('Allow: GET, HEAD');
    exit;
}

$script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/router.php');
$prefix = rtrim(dirname($script), '/');
$prefix = $prefix === '.' ? '' : $prefix;

$uriPath = (string) (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
if ($prefix !== '' && str_starts_with($uriPath, $prefix)) {
    $uriPath = substr($uriPath, strlen($prefix));
}
$path = '/' . trim($uriPath, '/');
$query = (string) ($_SERVER['QUERY_STRING'] ?? '');

$withQuery = static fn (string $location): string => $query === '' ? $location : $location . '?' . $query;

$notFound = static function () use ($prefix): never {
    http_response_code(404);
    header('Content-Type: text/html; charset=UTF-8');
    $login = htmlspecialchars($prefix . '/login/', ENT_QUOTES);
    echo '<!doctype html><html lang="vi"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>404 · HappyKidsCK</title></head><body>'
        . '<h1>404 - Không tìm thấy trang</h1>'
        . '<p>Đường dẫn không tồn tại hoặc không được phép truy cập.</p>'
        . '<p><a href="' . $login . '">Về trang đăng nhập</a></p>'
        . '</body></html>';
    exit;
};

// URL vật lý cũ -> chuyển vĩnh viễn về URL thân thiện
if (preg_match('#^/frontend/pages/([a-z-]+)/([a-z-]+)(?:/index\.html)?/?$#', $path, $match)) {
    $slug = array_search($match[1] . '/' . $match[2], PAGE_ROUTES, true);
    if ($slug === false) {
        $notFound();
    }
    header('Location: ' . $withQuery($prefix . '/' . $slug . '/'), true, 301);
    exit;
}

$slug = trim($path, '/');
if ($slug === '' || $uriPath === '/router.php') {
    $notFound();
}

if (str_ends_with($slug, '/index.html')) {
    $slug = substr($slug, 0, -strlen('/index.html'));
    header('Location: ' . $withQuery($prefix . '/' . $slug . '/'), true, 301);
    exit;
}

if (!str_ends_with($uriPath, '/')) {
    header('Location: ' . $withQuery($prefix . '/' . $slug . '/'), true, 301);
    exit;
}

if (!array_key_exists($slug, PAGE_ROUTES)) {
    $notFound();
}

$file = __DIR__ . '/frontend/pages/' . PAGE_ROUTES[$slug] . '/index.html';
if (!is_file($file)) {
    $notFound();
}

$baseHref = htmlspecialchars($prefix . '/frontend/pages/' . PAGE_ROUTES[$slug] . '/', ENT_QUOTES);
$html = (string) file_get_contents($file);
$injected = preg_replace(
    '/<head(\s[^>]*)?>/i',
    '$0' . "\n    <base href=\"" . $baseHref . '">',
    $html,
    1,
    $count
);
if ($count === 0) {
    $html = '<base href="' . $baseHref . '">' . $html;
} else {
    $html = (string) $injected;
}

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-cache');
header('X-Robots-Tag: noindex, nofollow');
echo $html;
