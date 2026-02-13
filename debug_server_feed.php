<?php
// Debug Script for RSSFetcher
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'php/RSSFetcher.php';

echo "Start Debugging...\n";

try {
    $fetcher = new RSSFetcher();
    
    // Inspect private property 'rssUrls' if possible or just rely on public methods
    // We'll mimic fetchFresh logic here to see output
    
    $urls = [
        'https://rsshub.app/telegram/channel/Theedinorogblog',
        'https://tg.i-c-a.su/rss/Theedinorogblog',
        'https://creators.briefly.ru/feed/telegram/Theedinorogblog'
    ];
    
    foreach ($urls as $url) {
        echo "Fetching: $url\n";
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (SSR Fetcher)');
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        echo "HTTP Code: $httpCode\n";
        if ($error) echo "cURL Error: $error\n";
        echo "Response Length: " . strlen($response) . "\n";
        
        if ($response) {
            echo "Sample: " . substr($response, 0, 100) . "...\n";
            try {
                $xml = new SimpleXMLElement($response);
                $count = isset($xml->channel->item) ? count($xml->channel->item) : 0;
                echo "Parsed Items: $count\n\n";
                // If Successful, break
            } catch (Exception $e) {
                echo "XML Parse Error: " . $e->getMessage() . "\n\n";
            }
        } else {
            echo "Empty Response.\n\n";
        }
    }
    
    echo "Testing RSSFetcher Class...\n";
    $posts = $fetcher->getAllPosts();
    echo "RSSFetcher returned " . count($posts) . " posts.\n";

} catch (Exception $e) {
    echo "Fatal Exception: " . $e->getMessage() . "\n";
}
?>
