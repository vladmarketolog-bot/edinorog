<?php
/**
 * Dynamic XML Sitemap Generator
 * Fetches RSS feed and generates a sitemap for search engines.
 */

header("Content-Type: application/xml; charset=utf-8");

// Base URL of your website (IMPORTANT: Change this to your actual domain if different)
// Base URL of your website (Dynamically includes subfolder if deployed there)
$scriptDir = dirname($_SERVER['SCRIPT_NAME']);
$scriptDir = str_replace('\\', '/', $scriptDir);
if ($scriptDir === '/') $scriptDir = ''; // Root is empty string for concatenation

$baseUrl = "https://" . $_SERVER['HTTP_HOST'] . $scriptDir;

// RSS Feed URLs (Same as in your JS config)
$rssUrls = [
    'https://rsshub.app/telegram/channel/Theedinorogblog',
    'https://tg.i-c-a.su/rss/Theedinorogblog',
    'https://creators.briefly.ru/feed/telegram/Theedinorogblog'
];

echo '<?xml version="1.0" encoding="UTF-8"?>';
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <!-- Static Pages -->
    <url>
        <loc><?php echo $baseUrl; ?>/index.html</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc><?php echo $baseUrl; ?>/archive.html</loc>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>

// Use shared RSSFetcher to ensure consistent Slug generation and Caching
require_once 'php/RSSFetcher.php';

$fetcher = new RSSFetcher();
$posts = $fetcher->getAllPosts();

if ($posts) {
    foreach ($posts as $post) {
        // Construct Clean URL
        // If slug exists, use it; otherwise fallback to ID (though RSSFetcher should always provide slug)
        if (!empty($post['slug'])) {
            $loc = $baseUrl . '/article/' . $post['slug'];
        } else {
            $loc = $baseUrl . '/post.php?id=' . urlencode($post['guid']);
        }
        
        // Date
        $dateObj = date_create($post['isoDate']);
        $lastMod = $dateObj ? date_format($dateObj, 'Y-m-d') : date('Y-m-d');

        echo "    <url>\n";
        echo "        <loc>" . htmlspecialchars($loc) . "</loc>\n";
        echo "        <lastmod>" . $lastMod . "</lastmod>\n";
        echo "        <changefreq>monthly</changefreq>\n";
        echo "        <priority>0.6</priority>\n";
        echo "    </url>\n";
    }
}
?>
</urlset>
