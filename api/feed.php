<?php
/**
 * Backend API for Validated Telegram Cache
 * Returns the full merged history from RSSFetcher
 */

require_once '../php/RSSFetcher.php';

header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

try {
    $fetcher = new RSSFetcher();
    // getAllPosts returns the MERGED list from cache/fresh
    $posts = $fetcher->getAllPosts();
    
    if ($posts) {
        echo json_encode($posts);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to load posts']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
