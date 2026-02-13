<?php
/**
 * API Endpoint for fetching Telegram cached feed.
 * Returns JSON array of posts.
 * Utilizes server-side caching from RSSFetcher.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Allow local dev

// Enable Error Reporting
error_reporting(E_ALL);
ini_set('display_errors', 0); // Disable output to screen (breaks JSON), log instead if possible

require_once 'php/RSSFetcher.php';

// Start Output Buffering to catch any PHP warnings/HTML
ob_start();

try {
    $fetcher = new RSSFetcher();
    $posts = $fetcher->getAllPosts();
    
    // Clear buffer (remove any warnings printed so far)
    ob_clean();
    
    echo json_encode($posts, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    // Clear buffer to ensure no HTML mixed with JSON
    ob_clean();
    http_response_code(500);
    echo json_encode([
        "error" => "Failed to fetch feed",
        "details" => $e->getMessage()
    ]);
} catch (Error $e) {
    // Catch Fatal Errors (PHP 7+)
    ob_clean();
    http_response_code(500);
    echo json_encode([
        "error" => "Fatal Error",
        "details" => $e->getMessage()
    ]);
} finally {
    ob_end_flush();
}
?>
