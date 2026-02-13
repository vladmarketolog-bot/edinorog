<?php
/**
 * Simple PHP Proxy for RSS Feeds
 * Avoids CORS issues and fetches content from external sources.
 */

// Allow access from any origin (CORS)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Get the URL parameter
$url = isset($_GET['url']) ? $_GET['url'] : '';

if (empty($url)) {
    http_response_code(400);
    echo json_encode(["error" => "Missing 'url' parameter"]);
    exit;
}

// Security: Basic validation to prevent arbitrary open proxy abuse
// Only allow specific domains related to RSS/Telegram
$allowed_domains = ['rsshub.app', 'tg.i-c-a.su', 'briefly.ru', 'telegram', 't.me'];
$parsed_url = parse_url($url);
$host = isset($parsed_url['host']) ? $parsed_url['host'] : '';

$is_allowed = false;
foreach ($allowed_domains as $domain) {
    if (strpos($host, $domain) !== false) {
        $is_allowed = true;
        break;
    }
}

// Uncomment the block below to enforce domain restriction (recommended for production)
/*
if (!$is_allowed) {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden domain"]);
    exit;
}
*/

// Initialize cURL session
$ch = curl_init();

// Set cURL options
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 15); // Reverted to 15s for reliability
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (compatible; PolyglotProxy/1.0)');

// Enable Error Reporting for Debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// --- UPSTREAM PROXY CONFIGURATION (Disabled - causing 500/403) ---
// curl_setopt($ch, CURLOPT_PROXY, '190.111.162.173');
// curl_setopt($ch, CURLOPT_PROXYPORT, 9372);
// curl_setopt($ch, CURLOPT_PROXYUSERPWD, 'kA5aYF:nXWsAw');
// curl_setopt($ch, CURLOPT_PROXYTYPE, CURLPROXY_HTTP); 
// ---------------------------------------------------- 
// ----------------------------------------------------

// Execute cURL request
$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$content_type = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$curl_error = curl_error($ch);

curl_close($ch);

// Check for errors
if ($http_code >= 400 || $response === false) {
    http_response_code($http_code ?: 500);
    echo json_encode([
        "error" => "Failed to fetch resource",
        "details" => $curl_error,
        "status" => $http_code
    ]);
    exit;
}

// Set the Content-Type header to match the original response (e.g., text/xml, application/json)
header("Content-Type: " . $content_type);

// Output the response
echo $response;
?>
