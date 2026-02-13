<?php
/**
 * RSSFetcher Class
 * Handles fetching, caching, and parsing of Telegram RSS feeds.
 */

class RSSFetcher {
    private $cacheFile;
    private $cacheDuration = 43200; // 12 Hours (Increased from 1 hour to reduce waits)
    private $rssUrls = [
        'https://rsshub.app/telegram/channel/Theedinorogblog',
        'https://tg.i-c-a.su/rss/Theedinorogblog',
        'https://creators.briefly.ru/feed/telegram/Theedinorogblog'
    ];

    public function __construct() {
        // Create cache folder if not exists
        if (!file_exists('cache')) {
            mkdir('cache', 0755, true);
        }
        $this->cacheFile = 'cache/feed_v11_final.json'; // Updated threshold to 30 chars
    }

    public function getPost($guid) {
        $posts = $this->getAllPosts();
        if (!$posts) return null;

        foreach ($posts as $post) {
            // Check both GUID and Link (some RSS feeds vary)
            if ((isset($post['guid']) && $post['guid'] == $guid) || 
                (isset($post['link']) && $post['link'] == $guid)) {
                return $post;
            }
        }
        return null;
    }

    public function getPostBySlug($slug) {
        $posts = $this->getAllPosts();
        if (!$posts) return null;

        foreach ($posts as $post) {
            if (isset($post['slug']) && $post['slug'] === $slug) {
                return $post;
            }
        }
        return null;
    }

    public function getAllPosts() {
        // 1. Try Cache
        if (file_exists($this->cacheFile)) {
            $cacheTime = filemtime($this->cacheFile);
            if (time() - $cacheTime < $this->cacheDuration) {
                $cached = json_decode(file_get_contents($this->cacheFile), true);
                if ($cached) return $cached;
            }
        }

        // 2. Fetch Fresh
        $freshPosts = $this->fetchFresh();
        
        // 3. Merge & Save
        if ($freshPosts) {
            $cached = [];
            if (file_exists($this->cacheFile)) {
                $cached = json_decode(file_get_contents($this->cacheFile), true) ?: [];
            }
            
            // Merge logic: fresh on top, followed by cached (avoid duplicates)
            $allPosts = $freshPosts;
            $existingGuids = array_column($freshPosts, 'guid');
            
            foreach ($cached as $post) {
                if (!in_array($post['guid'], $existingGuids)) {
                    $allPosts[] = $post;
                    $existingGuids[] = $post['guid'];
                }
            }
            
            // Limit cache size to prevent infinite growth (e.g., 500 posts)
            $allPosts = array_slice($allPosts, 0, 500);

            file_put_contents($this->cacheFile, json_encode($allPosts));
            return $allPosts;
        } else {
            // Fallback to expired cache if fetch fails
            if (file_exists($this->cacheFile)) {
                 return json_decode(file_get_contents($this->cacheFile), true);
            }
        }

        return [];
    }

    private function fetchFresh() {
        foreach ($this->rssUrls as $url) {
            $data = $this->fetchUrl($url);
            if ($data) {
                $parsed = $this->parseRSS($data);
                if ($parsed && count($parsed) > 0) {
                    return $parsed;
                }
            }
        }
        return null;
    }

    private function fetchUrl($url) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10); // Increased to 10s for stability
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3); // Slightly relaxed connect timeout
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (SSR Fetcher)');

        // Upstream Proxy (DISABLED)
        // curl_setopt($ch, CURLOPT_PROXY, explode(':', $this->proxy)[0]);
        // curl_setopt($ch, CURLOPT_PROXYPORT, explode(':', $this->proxy)[1]);
        // curl_setopt($ch, CURLOPT_PROXYUSERPWD, $this->proxyAuth);
        // curl_setopt($ch, CURLOPT_PROXYTYPE, CURLPROXY_HTTP);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 300) {
            return $response;
        }
        // Fallback for direct mirrors that might not need proxy
        if (strpos($url, 'briefly.ru') !== false || strpos($url, 'tg.i-c-a.su') !== false) {
             // Try without proxy as backup for specific domains if needed
             // Implementation omitted for brevity, logic mostly satisfied by proxy
        }
        return null;
    }

    private function parseRSS($xmlString) {
        try {
            $xml = new SimpleXMLElement($xmlString);
            $posts = [];
            
            if (!isset($xml->channel->item)) return [];

            foreach ($xml->channel->item as $item) {
                // Determine GUID
                $guid = (string)$item->guid;
                if (empty($guid)) $guid = (string)$item->link;

                // DATE PARSING
                $pubDate = (string)$item->pubDate;
                $timestamp = strtotime($pubDate);
                $isoDate = date('c', $timestamp);
                
                // Russian Month Translation (Simple)
                $months = [
                    'Jan' => 'янв', 'Feb' => 'фев', 'Mar' => 'мар', 'Apr' => 'апр', 'May' => 'мая', 'Jun' => 'июн',
                    'Jul' => 'июл', 'Aug' => 'авг', 'Sep' => 'сен', 'Oct' => 'окт', 'Nov' => 'ноя', 'Dec' => 'дек'
                ];
                $enMonth = date('M', $timestamp);
                $ruMonth = isset($months[$enMonth]) ? $months[$enMonth] : $enMonth;
                $displayDate = date('j', $timestamp) . ' ' . $ruMonth . ' ' . date('Y', $timestamp);
                
                // NEW: Robust Content Parsing Strategy
                // 1. Try content:encoded first (contains full HTML)
                $contentEncoded = (string)$item->children('content', true)->encoded;
                $description = (string)$item->description;
                
                $fullContent = !empty($contentEncoded) ? $contentEncoded : $description;

                // 2. Cleanup Telegram Artifacts
                $fullContent = preg_replace('/\[\.\.\.\]/', '', $fullContent);
                $fullContent = preg_replace('/\[photo\]/i', '', $fullContent);
                $fullContent = preg_replace('/\[video\]/i', '', $fullContent);
                $fullContent = preg_replace('/\[album\]/i', '', $fullContent);

                // STRIP ALL IMG TAGS
                $fullContent = preg_replace('/<img[^>]+>/i', '', $fullContent);

                // 3. Image Extraction - DISABLED
                $image = '';

                // 4. Final Body Construction (Avoid Empty Articles)
                // Decode entities (like &nbsp;) to ensure whitespace is trimmed
                $decoded = html_entity_decode($fullContent);
                $plainOnly = trim(strip_tags($decoded));
                
                // Check if truly empty or very short (< 30 chars)
                // Increased threshold to avoid false positives on short captions
                if ($plainOnly === '' || mb_strlen($plainOnly) < 30) {
                    $telegramLink = $item->link;
                    $fullContent = '<div class="p-4 rounded-xl bg-white/5 border border-white/10 text-center my-8">
                        <p class="text-white/70 italic mb-3">Медиа-файл без текстового описания</p>
                        <a href="' . $telegramLink . '" target="_blank" class="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors text-sm font-bold uppercase tracking-wider bg-white/5 px-4 py-2 rounded-full hover:bg-white/10">
                            Посмотреть в Telegram <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        </a>
                    </div>';
                }
               
                // NEW: Slug Generation (STABLE)
                // We use the original RSS title for the slug to ensure consistency between JS and PHP
                // independent of how we parse the body content.
                $originalTitle = (string)$item->title;
                $originalTitle = preg_replace('/\[\.\.\.\]/', '', $originalTitle);
                $originalTitle = preg_replace('/\[photo\]/i', '', $originalTitle);
                
                $slug = $this->slugify($originalTitle);
                if (empty($slug) || strlen($slug) < 3) {
                    $slug = 'post-' . substr(md5($guid), 0, 8);
                }

                // Cleanup Plain Text for Search/Previews
                // FIX: Replace block tags with NEWLINES to preserve structure (Title vs Body)
                $textForStrip = $fullContent;
                $textForStrip = preg_replace('/<br\s*\/?>/i', "\n", $textForStrip);
                $textForStrip = preg_replace('/<\/p>/i', "\n", $textForStrip);
                $textForStrip = preg_replace('/<\/div>/i', "\n", $textForStrip);
                
                $plainText = strip_tags($textForStrip);
                
                // Determine Title from Content (Better than RSS title usually)
                // This is for DISPLAY only. Slug remains based on original title for safety.
                $title = trim($originalTitle); 
                
                $candidates = explode("\n", $plainText);
                foreach ($candidates as $cand) {
                    $cand = trim($cand);
                    if (mb_strlen($cand) > 3) { // Find first non-empty line
                         $calculatedTitle = $cand;
                         // If Calculated Title looks like a header (not too long), use it
                         if (mb_strlen($calculatedTitle) < 150) {
                             $title = $calculatedTitle;
                         }
                         break; // Found the "Header", stop
                    }
                }

                // Clean up title
                $title = preg_replace('/\[\.\.\.\]/', '', $title);
                $title = preg_replace('/\[photo\]/i', '', $title);
                $title = trim($title);
                
                // DEDUPLICATION: If description starts with title, remove it
                // Consolidate newlines to spaces for descriptionPlain
                $finalDesc = preg_replace('/\s+/', ' ', $plainText);
                $finalDesc = trim($finalDesc);

                if (mb_strpos($finalDesc, $title) === 0) {
                     $finalDesc = mb_substr($finalDesc, mb_strlen($title));
                }
                
                // SMART TRUNCATION (Check for sentences)
                $maxLength = 200;
                $preview = $finalDesc;
                
                if (mb_strlen($preview) > $maxLength) {
                    $truncated = mb_substr($preview, 0, $maxLength);
                    
                    // Regex for sentence endings (dot/excl/quest followed by space or end)
                    // PHP mb_ strings are tricky with regex, so we iterate or use simple checks
                    // Let's stick to last occurrence of ". ", "! ", "? "
                    
                    $lastDot = mb_strrpos($truncated, '. ');
                    $lastExcl = mb_strrpos($truncated, '! ');
                    $lastQuest = mb_strrpos($truncated, '? ');
                    
                    $lastSentenceEnd = max((int)$lastDot, (int)$lastExcl, (int)$lastQuest);
                    
                    // If we found a reasonable sentence end
                    if ($lastSentenceEnd > $maxLength * 0.2) {
                        $preview = mb_substr($truncated, 0, $lastSentenceEnd + 1);
                    } else {
                        // Fallback: Cut at last space to avoid splitting words
                        $lastSpace = mb_strrpos($truncated, ' ');
                        if ($lastSpace > 0) {
                            $preview = mb_substr($truncated, 0, $lastSpace) . '...';
                        } else {
                            $preview = $truncated . '...';
                        }
                    }
                }

                $posts[] = [
                    'guid' => $guid,
                    'slug' => $slug,
                    'title' => trim($title) ?: 'Без названия',
                    'link' => (string)$item->link,
                    'descriptionPlain' => $preview,
                    'contentHtml' => $fullContent,
                    'image' => null,
                    'isoDate' => $isoDate,
                    'displayDate' => $displayDate
                ];
            }
            return $posts;

        } catch (Exception $e) {
            return [];
        }
    }

    private function slugify($text) {
        // Transliteration table
        $cyr = [
            'а','б','в','г','д','е','ё','ж','з','и','й','к','л','м','н','о','п',
            'р','с','т','у','ф','х','ц','ч','ш','щ','ъ','ы','ь','э','ю','я',
            'А','Б','В','Г','Д','Е','Ё','Ж','З','И','Й','К','Л','М','Н','О','П',
            'Р','С','Т','У','Ф','Х','Ц','Ч','Ш','Щ','Ъ','Ы','Ь','Э','Ю','Я'
        ];
        $lat = [
            'a','b','v','g','d','e','yo','zh','z','i','y','k','l','m','n','o','p',
            'r','s','t','u','f','h','ts','ch','sh','sch','','y','','e','yu','ya',
            'a','b','v','g','d','e','yo','zh','z','i','y','k','l','m','n','o','p',
            'r','s','t','u','f','h','ts','ch','sh','sch','','y','','e','yu','ya'
        ];
        
        $text = str_replace($cyr, $lat, $text);
        
        // Convert to lowercase
        $text = mb_strtolower($text, 'UTF-8');
        
        // Replace non-alphanumeric characters with dashes
        $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
        $text = preg_replace('/[\s-]+/', '-', $text);
        
        return trim($text, '-');
    }
}
?>
