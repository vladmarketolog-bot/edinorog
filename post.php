<?php


require_once 'php/RSSFetcher.php';

$fetcher = new RSSFetcher();
$postId = isset($_GET['id']) ? $_GET['id'] : null;
$slug = isset($_GET['slug']) ? $_GET['slug'] : null;
$post = null;

// Determine Base URL for relative links (fixes subfolder deployment + rewrite issues)
$scriptDir = dirname($_SERVER['SCRIPT_NAME']);
$scriptDir = str_replace('\\', '/', $scriptDir);

// 1. Fix commonly returned '.' for root
if ($scriptDir === '.') {
    $scriptDir = '';
}

// 2. Ensure leading slash
if ($scriptDir !== '' && $scriptDir[0] !== '/') {
    $scriptDir = '/' . $scriptDir;
}

// 3. Ensure trailing slash
if (substr($scriptDir, -1) !== '/') {
    $scriptDir .= '/';
}

if ($slug) {
    $post = $fetcher->getPostBySlug($slug);
    // Backward compatibility: if found by slug, we might want to know its ID effectively, 
    // but the post object has it.
} elseif ($postId) {
    $post = $fetcher->getPost($postId);
}

// Default Meta (Fallback)
$metaTitle = "The Edinorog Mirror";
$metaDesc = "Ежедневный дайджест венчурного рынка и технологий.";
$ogImage = "https://theedinorog.com/img/og-image.jpg"; // Change to your actual default
$publishedTime = date('c');

if ($post) {
    $metaTitle = $post['title'] . " | The Edinorog";
    // Smart Truncate for Meta Description
    $rawDesc = strip_tags($post['descriptionPlain']);
    
    $limit = 150;
    if (mb_strlen($rawDesc) > $limit) {
        $truncated = mb_substr($rawDesc, 0, $limit);
        
        // Find last sentence punctuation
        $lastPunct = max(
            mb_strrpos($truncated, '. '),
            mb_strrpos($truncated, '! '),
            mb_strrpos($truncated, '? ')
        );

        if ($lastPunct !== false && $lastPunct > $limit * 0.2) {
             $metaDesc = mb_substr($truncated, 0, $lastPunct + 1);
        } else {
             // Fallback to space
             $lastSpace = mb_strrpos($truncated, ' ');
             if ($lastSpace !== false) {
                 $metaDesc = mb_substr($truncated, 0, $lastSpace) . '...';
             } else {
                 $metaDesc = $truncated . '...';
             }
        }
    } else {
        $metaDesc = $rawDesc;
    }
    if (!empty($post['image'])) $ogImage = $post['image'];
    $publishedTime = $post['isoDate'];
}
    // URL Construction
    $currentUrl = "https://theedinorog.com/post.php";
    if (!empty($post['slug'])) {
        $currentUrl = "https://theedinorog.com/article/" . $post['slug'];
    } elseif ($postId) {
        $currentUrl = "https://theedinorog.com/post.php?id=" . urlencode($postId);
    }
?>
<!DOCTYPE html>
<html lang="ru">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($metaTitle); ?></title>
    <meta name="description" content="<?php echo htmlspecialchars($metaDesc); ?>">
    <base href="<?php echo htmlspecialchars($scriptDir); ?>">
    <link rel="canonical" href="<?php echo htmlspecialchars($currentUrl); ?>">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="<?php echo htmlspecialchars($currentUrl); ?>">
    <meta property="og:title" content="<?php echo htmlspecialchars($metaTitle); ?>">
    <meta property="og:description" content="<?php echo htmlspecialchars($metaDesc); ?>">
    <meta property="og:image" content="<?php echo htmlspecialchars($ogImage); ?>">
    <meta property="article:published_time" content="<?php echo htmlspecialchars($publishedTime); ?>">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:title" content="<?php echo htmlspecialchars($metaTitle); ?>">
    <meta property="twitter:description" content="<?php echo htmlspecialchars($metaDesc); ?>">
    <meta property="twitter:image" content="<?php echo htmlspecialchars($ogImage); ?>">

    <!-- Favicon -->
    <link rel="icon" href="img/1.jpg" type="image/jpeg">

    <!-- Tailwind CSS (Local) -->
    <script src="js/tailwindcss.js"></script>
    <!-- Icons (Local) -->
    <script src="js/lucide.js"></script>
    <!-- Theme & Fonts (Local) -->
    <link rel="stylesheet" href="css/themes.css">

    <style>
        /* PREMIUM TYPOGRAPHY & FORMATTING */
        body {
            /* Styles handled by themes.css but we ensure base readability */
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        ::selection {
            background-color: rgba(168, 85, 247, 0.4);
            color: #ffffff;
            text-shadow: 0 0 5px rgba(168, 85, 247, 0.5);
        }

        /* Container Typography */
        .prose {
            font-size: 1.125rem; /* 18px text */
            line-height: 1.8;
            color: rgba(255, 255, 255, 0.9);
            max-width: 65ch; /* Optimal reading width */
            margin: 0 auto;
        }

        /* Paragraphs & Spacing */
        .prose p {
            margin-bottom: 2em;
            letter-spacing: -0.01em;
        }

        /* Headings */
        .prose h1, .prose h2, .prose h3, .prose h4 {
             color: white;
             font-weight: 800;
             margin-top: 2.5em;
             margin-bottom: 1em;
             line-height: 1.3;
             letter-spacing: -0.02em;
        }
        
        .prose h2 { font-size: 1.75em; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5em; }
        .prose h3 { font-size: 1.5em; color: rgba(255,255,255,0.95); }

        /* Links with refined underline animation */
        .prose a {
            color: #c084fc;
            text-decoration: none;
            background-image: linear-gradient(#c084fc, #c084fc);
            background-size: 100% 2px;
            background-position: 0 100%;
            background-repeat: no-repeat;
            transition: color 0.3s, background-size 0.3s;
        }
        .prose a:hover {
            color: #e9d5ff;
            background-size: 100% 3px;
        }

        /* Images - Premium Look */
        .prose img {
            border-radius: 1.5rem;
            margin: 3rem 0;
            width: 100%;
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 20px 40px -10px rgba(0,0,0,0.5);
            transition: transform 0.5s ease;
        }
        .prose img:hover {
            transform: scale(1.01);
        }

        /* Lists */
        .prose ul, .prose ol {
            margin-bottom: 2em;
            padding-left: 1.5rem;
        }
        .prose ul { list-style-type: none; }
        .prose ul li {
            position: relative;
            padding-left: 1.5em;
            margin-bottom: 0.75em;
        }
        .prose ul li::before {
            content: "•";
            position: absolute;
            left: 0;
            color: #a855f7;
            font-weight: bold;
            font-size: 1.2em;
        }

        /* Blockquotes - Glassmorphism */
        .prose blockquote {
            position: relative;
            margin: 3rem 0;
            padding: 2rem 2.5rem;
            background: rgba(255,255,255,0.03);
            border-left: 4px solid #a855f7;
            border-radius: 0 1.5rem 1.5rem 0;
            font-style: italic;
            color: rgba(255,255,255,0.8);
            box-shadow: inset 0 0 40px rgba(0,0,0,0.2);
        }
        .prose blockquote::before {
            content: "“";
            position: absolute;
            top: 0.5rem;
            left: 1rem;
            font-size: 4rem;
            color: rgba(168, 85, 247, 0.1);
            font-family: serif;
            line-height: 1;
        }

        /* Code Blocks */
        .prose pre {
            background: #0f0f11;
            padding: 1.5rem;
            border-radius: 1rem;
            overflow-x: auto;
            border: 1px solid rgba(255,255,255,0.1);
            margin: 2rem 0;
        }
        .prose code {
            font-family: 'Fira Code', monospace;
            font-size: 0.9em;
            color: #e9d5ff;
        }
        
        /* Strong Text */
        .prose strong {
            color: white;
            font-weight: 700;
        }
        
        /* Helper for BR spacing */
        .prose br {
            display: block;
            margin-bottom: 0.5em;
            content: "";
        }    </style>
</head>

<body class="overflow-x-hidden relative selection:bg-purple-500/30 min-h-screen flex flex-col">

    <!-- BACKGROUND FX -->
    <div class="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div class="absolute top-[-20%] left-[20%] w-[60vw] h-[60vw] bg-purple-900/10 blur-[120px] rounded-full mix-blend-screen animate-pulse duration-[10s]"></div>
        <div class="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-blue-900/5 blur-[100px] rounded-full mix-blend-screen"></div>
        <div class="absolute inset-0 bg-[url('img/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
    </div>

    <!-- NAVBAR -->
    <nav id="navbar" class="fixed top-0 w-full z-50 transition-all duration-500 py-6 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div class="max-w-4xl mx-auto px-6 flex items-center justify-between">
            <a href="index.html" class="flex items-center gap-3 group">
                <div class="relative">
                    <div
                        class="absolute inset-0 bg-purple-500 blur-lg opacity-50 group-hover:opacity-100 transition-opacity">
                    </div>
                    <div
                        class="relative p-0 bg-gradient-to-tr from-gray-900 to-black border border-white/10 rounded-xl group-hover:scale-105 transition-transform overflow-hidden">
                        <img src="img/1.jpg" alt="Logo" class="w-10 h-10 object-cover">
                    </div>
                </div>
                <div class="flex flex-col text-left">
                    <span class="font-bold text-xl tracking-tight leading-none text-white">The Edinorog</span>
                    <span class="text-[10px] uppercase tracking-[0.3em] text-white/40 font-semibold mt-1">Зеркало Блога</span>
                </div>
            </a>

            <a href="https://t.me/Theedinorogblog" target="_blank" class="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-purple-400 hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                <i data-lucide="zap" class="w-3 h-3 fill-current"></i> Telegram
            </a>
        </div>
    </nav>
    
    <!-- CONTENT -->
    <main class="relative z-10 pt-32 pb-20 px-6 max-w-3xl mx-auto w-full flex-grow">
        <div id="single-post-container">
            <?php if ($post): ?>
                <nav class="flex items-center gap-2 text-xs text-white/40 mb-8 overflow-x-auto whitespace-nowrap px-4 md:px-0">
                    <a href="index.html" class="hover:text-white transition-colors">Главная</a>
                    <span>/</span>
                    <a href="archive.html" class="hover:text-white transition-colors">Архив</a>
                    <span>/</span>
                    <span class="text-purple-400 truncate max-w-[200px]"><?php echo htmlspecialchars($post['title']); ?></span>
                </nav>

                <header class="mb-10 text-center max-w-2xl mx-auto">
                    <div class="flex items-center justify-center gap-3 text-white/40 text-[10px] font-bold uppercase tracking-widest mb-6">
                            <span class="px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full">Telegram Mirror</span>
                            <span><?php echo htmlspecialchars($post['displayDate']); ?></span>
                    </div>
                </header>

                <div class="prose prose-invert prose-lg max-w-none mb-16 [&>p:first-of-type]:text-4xl [&>p:first-of-type]:md:text-5xl [&>p:first-of-type]:font-bold [&>p:first-of-type]:leading-tight [&>p:first-of-type]:mb-8 [&>p:first-of-type]:text-white">
                    <?php echo $post['contentHtml']; ?>
                </div>

                <!-- CTA -->
                <div class="rounded-3xl bg-gradient-to-br from-gray-900 to-black border border-white/10 p-8 md:p-12 text-center relative overflow-hidden group">
                    <div class="absolute inset-0 bg-purple-900/10 blur-[100px]"></div>
                    <div class="relative z-10">
                        <div class="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 text-purple-400 group-hover:scale-110 transition-transform">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.265 2.15l3.515 9.149a1 1 0 0 0 1.902-.27l-3.515-9.149a1 1 0 0 1 .132-1.075L21.174 6.812Z"/><path d="m3.576 18.324 7.55-7.55"/><path d="m15.824 10.876 4.6 4.6a2 2 0 0 1 0 2.828l-2.122 2.122a2 2 0 0 1-2.828 0l-4.6-4.6"/></svg>
                        </div>
                        <h3 class="text-2xl font-bold text-white mb-4">Понравилась статья?</h3>
                        <p class="text-white/50 mb-8 max-w-md mx-auto">Подпишитесь на Telegram-канал The Edinorog, чтобы получать такие инсайды первыми.</p>
                        <a href="https://t.me/Theedinorogblog" target="_blank" class="inline-flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full font-bold uppercase tracking-wider hover:bg-purple-400 hover:text-white transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                            Подписаться на канал
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        </a>
                    </div>
                </div>

            <?php else: ?>
                <div class="text-center py-20 text-white/50">
                    Статья не найдена или устарела. <br><br>
                    <a href="index.html" class="underline hover:text-white">Вернуться на главную</a>
                </div>
            <?php endif; ?>
        </div>
    </main>

    <!-- FOOTER -->
    <footer class="border-t border-white/5 bg-black py-12 text-center relative z-10">
        <p class="text-white/30 text-sm mb-4">
            &copy; 2026 The Edinorog Mirror. Content from Telegram.
        </p>
        <div class="flex items-center justify-center gap-4">
             <button onclick="forceUpdateFeed(this)" title="Обновить статьи" class="text-white/10 hover:text-white/50 transition-colors p-2 rounded-full">
                <i data-lucide="refresh-cw" class="w-3 h-3"></i>
            </button>
            <a href="https://t.me/Theedinorogblog" target="_blank"
                class="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-purple-400 hover:text-purple-300 transition-all text-sm font-medium group">
                <i data-lucide="send" class="w-4 h-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform"></i>
                <span>The Edinorog Blog</span>
            </a>
        </div>
    </footer>

    <script src="js/telegram-loader.js"></script>
    <script>
        lucide.createIcons();
    </script>
</body>
</html>
