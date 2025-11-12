<?php
// ملف: /api/tracker.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// إعدادات الملفات
$visitsFile = '../data/visits_log.json';
$bannedFile = '../data/banned_visitors.json';
$backupDir = '../data/backups/';

// التأكد من وجود المجلدات
if (!file_exists('../data')) mkdir('../data', 0755, true);
if (!file_exists($backupDir)) mkdir($backupDir, 0755, true);

// قراءة البيانات المرسلة
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid data']);
    exit;
}

try {
    // معالجة البيانات
    $result = processTrackingData($input, $visitsFile, $bannedFile, $backupDir);
    
    echo json_encode([
        'status' => 'success',
        'message' => 'Data saved successfully',
        'timestamp' => date('c'),
        'data' => $result
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Processing failed',
        'message' => $e->getMessage()
    ]);
}

function processTrackingData($data, $visitsFile, $bannedFile, $backupDir) {
    $timestamp = date('Y-m-d H:i:s');
    
    // تحضير سجل الزيارة
    $visitRecord = [
        'timestamp' => $timestamp,
        'action' => $data['action'] ?? 'unknown',
        'visitor_id' => $data['visitor']['visitorId'] ?? 'unknown',
        'fingerprint' => $data['visitor']['fingerprint'] ?? 'unknown',
        'session_id' => $data['visitor']['sessionId'] ?? 'unknown',
        'page_title' => $data['pageInfo']['title'] ?? 'unknown',
        'page_url' => $data['pageInfo']['url'] ?? 'unknown',
        'entry_time' => $data['session']['entryTime'] ?? null,
        'exit_time' => $data['session']['exitTime'] ?? null,
        'time_spent' => $data['session']['timeSpent'] ?? 0,
        'scroll_depth' => $data['session']['scrollDepth'] ?? 0,
        'clicks' => $data['session']['clicks'] ?? 0,
        'user_agent' => $data['deviceInfo']['userAgent'] ?? 'unknown',
        'ip_address' => getClientIP(),
        'device_info' => $data['deviceInfo'] ?? [],
        'statistics' => $data['statistics'] ?? []
    ];
    
    // حفظ في ملف الزيارات
    saveToJSONFile($visitsFile, $visitRecord);
    
    // نسخ احتياطي
    $backupFile = $backupDir . 'visits_backup_' . date('Y-m-d') . '.json';
    saveToJSONFile($backupFile, $visitRecord);
    
    // التحقق من الحظر
    $isBanned = checkIfBanned(
        $data['visitor']['fingerprint'] ?? '',
        $data['visitor']['visitorId'] ?? '',
        $bannedFile
    );
    
    return [
        'saved' => true,
        'banned' => $isBanned,
        'visit_id' => uniqid('visit_', true)
    ];
}

function saveToJSONFile($filename, $data) {
    $lock = fopen($filename . '.lock', 'w');
    flock($lock, LOCK_EX);
    
    $existingData = [];
    if (file_exists($filename)) {
        $content = file_get_contents($filename);
        $existingData = json_decode($content, true) ?? [];
    }
    
    $existingData[] = $data;
    
    // الاحتفاظ بآخر 10000 سجل فقط
    if (count($existingData) > 10000) {
        $existingData = array_slice($existingData, -10000);
    }
    
    file_put_contents($filename, json_encode($existingData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    flock($lock, LOCK_UN);
    fclose($lock);
}

function checkIfBanned($fingerprint, $visitorId, $bannedFile) {
    if (!file_exists($bannedFile)) {
        return false;
    }
    
    $bannedData = json_decode(file_get_contents($bannedFile), true) ?? ['banned' => []];
    
    foreach ($bannedData['banned'] as $banned) {
        if ($banned['fingerprint'] === $fingerprint || $banned['visitorId'] === $visitorId) {
            return true;
        }
    }
    
    return false;
}

function getClientIP() {
    $keys = [
        'HTTP_X_FORWARDED_FOR',
        'HTTP_X_REAL_IP',
        'HTTP_CLIENT_IP',
        'REMOTE_ADDR'
    ];
    
    foreach ($keys as $key) {
        if (!empty($_SERVER[$key])) {
            $ip = trim(explode(',', $_SERVER[$key])[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }
    
    return 'unknown';
}
?>
