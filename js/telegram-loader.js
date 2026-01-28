/**
 * Telegram Blog Mirror Loader (Production v3.0)
 * Supports Feed View (index.html) and Single Post View (post.html)
 */

const CONFIG = {
    RSS_URLS: [
        'https://rsshub.app/telegram/channel/Theedinorogblog',
        'https://tg.i-c-a.su/rss/Theedinorogblog',
        'https://creators.briefly.ru/feed/telegram/Theedinorogblog'
    ],
    PROXY_URL: '/api/proxy?url=',
    CACHE_KEY_DATA: 'tg_blog_data_v4_vercel', // Changed key to force refresh
    CACHE_KEY_TIME: 'tg_blog_last_fetch',
    CACHE_DURATION: 6 * 60 * 60 * 1000, // 6 hours
    FEED_CONTAINER_ID: 'posts-container',
    HERO_CONTAINER_ID: 'hero-container',
    POST_CONTAINER_ID: 'single-post-container',
    ARCHIVE_CONTAINER_ID: 'archive-container',
    MAX_POSTS: 12
};

async function initTelegramBlog() {
    initTheme(); // Init Theme first

    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');

    if (postId) {
        await initSinglePost(postId);
    } else if (document.getElementById(CONFIG.ARCHIVE_CONTAINER_ID)) {
        await initArchive();
    } else {
        await initFeed();
    }
}

// --- THEME LOGIC ---
const THEMES = ['night', 'day', 'unicorn'];

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'night';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'night';
    const nextIndex = (THEMES.indexOf(current) + 1) % THEMES.length;
    const nextTheme = THEMES[nextIndex];

    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
    updateThemeIcon(nextTheme);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;

    let iconName = 'moon';
    if (theme === 'day') iconName = 'sun';
    if (theme === 'unicorn') iconName = 'sparkles';

    // Inject fresh <i> tag so Lucide can process it anew
    btn.innerHTML = `<i data-lucide="${iconName}" class="w-5 h-5"></i>`;

    if (window.lucide) window.lucide.createIcons();
}

// --- FEED LOGIC (Index) ---
// --- FEED LOGIC (Index) ---
async function initFeed() {
    const container = document.getElementById(CONFIG.FEED_CONTAINER_ID);
    const heroContainer = document.getElementById(CONFIG.HERO_CONTAINER_ID);

    if (!container) return; // Not on index page

    // Loading State
    container.innerHTML = `<div class="col-span-full text-center py-20">
        <div class="inline-block w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4"></div>
        <div class="text-white/50 animate-pulse">Загрузка ленты...</div>
    </div>`;

    try {
        const posts = await getPosts();

        if (posts.length > 0 && heroContainer) {
            renderHero(posts[0], heroContainer);
            renderFeed(posts.slice(1), container);
        } else {
            renderFeed(posts, container);
        }
    } catch (error) {
        renderError(container, error);
    }
}

function renderHero(post, container) {
    const postUrl = `post.html?id=${encodeURIComponent(post.guid)}`;

    // Fallback description if logic fails
    const desc = post.descriptionPlain || "";

    container.innerHTML = `
        <section class="group cursor-pointer relative h-full">
            <a href="${postUrl}" class="absolute inset-0 z-30"></a>
            <div class="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div class="relative aspect-[16/9] md:aspect-[21/9] rounded-[2rem] overflow-hidden theme-border bg-black">
                <!-- Abstract Gradient Fallback -->
                <div class="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-black to-pink-900/40"></div>
                
                <div class="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10"></div>

                <div class="absolute bottom-0 left-0 p-8 md:p-12 max-w-4xl z-20">
                    <div class="flex items-center gap-3 mb-6">
                        <span class="px-3 py-1 bg-purple-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                            Новое
                        </span>
                        <span class="text-white/80 text-xs font-medium flex items-center gap-1.5">
                            <i data-lucide="clock" class="w-3.5 h-3.5"></i> ${post.displayDate}
                        </span>
                    </div>
                    <h1 class="text-3xl md:text-5xl font-bold leading-tight mb-6 text-white group-hover:text-purple-100 transition-colors">
                        ${post.title}
                    </h1>
                    <p class="text-lg text-white/70 line-clamp-2 leading-relaxed mb-8">
                        ${desc}
                    </p>
                    <div class="flex items-center gap-4 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                        <span class="text-sm font-semibold text-purple-400 flex items-center gap-2">
                            Читать статью <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
                        </span>
                    </div>
                </div>
            </div>
        </section>
    `;
}

function renderFeed(posts, container) {
    container.innerHTML = '';

    posts.slice(0, CONFIG.MAX_POSTS).forEach(post => {
        const article = document.createElement('article');
        // Use theme- classes instead of hardcoded bg-[#0a0a0a] etc.
        article.className = 'group relative flex flex-col rounded-[2rem] overflow-hidden theme-bg-card border theme-border hover:border-purple-500/50 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-2xl';

        // Link to detail page
        const postUrl = `post.html?id=${encodeURIComponent(post.guid)}`;

        article.innerHTML = `
            <a href="${postUrl}" class="absolute inset-0 z-20"></a>

            <div class="p-6 flex-1 flex flex-col relative z-20 pointer-events-none">
                <div class="flex items-center gap-3 text-purple-500 text-[10px] font-bold uppercase tracking-widest mb-3">
                    <span class="w-1.5 h-1.5 rounded-full bg-purple-500 box-shadow-purple"></span>
                    <time datetime="${post.isoDate}">${post.displayDate}</time>
                </div>
                
                <h3 class="text-lg font-bold theme-text-main mb-2 leading-tight group-hover:text-purple-400 transition-colors line-clamp-2">
                    ${post.title}
                </h3>
                
                <p class="text-sm theme-text-muted leading-relaxed line-clamp-3 mb-6">
                    ${post.descriptionPlain}
                </p>

                <div class="pt-6 border-t theme-border flex items-center justify-between mt-auto">
                    <span class="text-xs theme-text-muted font-medium opacity-60">Читать далее</span>
                    
                    <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center theme-text-muted group-hover:bg-purple-500 group-hover:text-white transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(article);
    });
}

// --- SINGLE POST LOGIC (Post) ---
async function initSinglePost(postId) {
    const container = document.getElementById(CONFIG.POST_CONTAINER_ID);
    if (!container) return; // Not on post page

    try {
        const posts = await getPosts();
        // Find post by GUID (link is usually the guid in RSS)
        const post = posts.find(p => p.guid === postId || p.guid === decodeURIComponent(postId));

        if (post) {
            renderSinglePost(post, container);
        } else {
            container.innerHTML = '<div class="text-center py-20 text-white/50">Статья не найдена или устарела. <br><a href="index.html" class="underline mt-4 block">Вернуться на главную</a></div>';
        }
    } catch (error) {
        renderError(container, error);
    }
}

function renderSinglePost(post, container) {
    // metadata update
    document.title = `${post.title} | The Edinorog`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', post.descriptionPlain);



    // Breadcrumbs Schema
    const breadcrumbsScript = document.createElement('script');
    breadcrumbsScript.type = 'application/ld+json';
    breadcrumbsScript.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [{
            "@type": "ListItem",
            "position": 1,
            "name": "Главная",
            "item": window.location.origin + "/index.html"
        }, {
            "@type": "ListItem",
            "position": 2,
            "name": "Архив",
            "item": window.location.origin + "/archive.html"
        }, {
            "@type": "ListItem",
            "position": 3,
            "name": post.title,
            "item": window.location.href
        }]
    });
    container.appendChild(breadcrumbsScript);

    container.innerHTML = `
        <nav class="flex items-center gap-2 text-xs text-white/40 mb-8 overflow-x-auto whitespace-nowrap px-4 md:px-0">
            <a href="index.html" class="hover:text-white transition-colors">Главная</a>
            <span>/</span>
            <a href="archive.html" class="hover:text-white transition-colors">Архив</a>
            <span>/</span>
            <span class="text-purple-400 truncate max-w-[200px]">${post.title}</span>
        </nav>

        <header class="mb-10 text-center max-w-2xl mx-auto">
            <div class="flex items-center justify-center gap-3 text-white/40 text-[10px] font-bold uppercase tracking-widest mb-6">
                 <span class="px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full">Telegram Mirror</span>
                 <span>${post.displayDate}</span>
            </div>
            <h1 class="text-3xl md:text-5xl font-bold leading-tight mb-6 text-white bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                ${post.title}
            </h1>
            

        </header>



        <div class="prose prose-invert prose-lg max-w-none mb-16">
            ${post.contentHtml}
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
                <a href="${post.link}" target="_blank" class="inline-flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full font-bold uppercase tracking-wider hover:bg-purple-400 hover:text-white transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                    Подписаться на канал
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </a>
            </div>
        </div>
    `;

    // Inject Schema.org
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post.title,
        "image": post.image || [],
        "datePublished": post.isoDate,
        "articleBody": post.descriptionPlain,
        "url": window.location.href,
        "author": {
            "@type": "Organization",
            "name": "The Edinorog Blog",
            "url": "https://t.me/Theedinorogblog"
        },
    });
    container.appendChild(script);

    // --- RELATED POSTS INJECTION ---
    // Note: We need 'posts' array here. Since renderSinglePost signature is (post, container), 
    // we need to get posts from cache again or pass it. 
    // Re-reading cache is cheap here.
    const allPosts = loadFromCache(true) || [];
    const relatedHtml = renderRelatedPostsSection(post, allPosts);

    const relatedContainer = document.createElement('div');
    relatedContainer.innerHTML = relatedHtml;
    container.appendChild(relatedContainer);
}

// --- RELATED POSTS LOGIC ---
function renderRelatedPostsSection(currentPost, allPosts) {
    const related = getRelatedPosts(currentPost, allPosts);
    if (related.length === 0) return '';

    const cardsHtml = related.map(post => `
        <a href="post.html?id=${encodeURIComponent(post.guid)}" class="group relative flex flex-col rounded-2xl overflow-hidden bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all">
            <div class="p-5 flex flex-col h-full">
                <span class="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-2">Читать также</span>
                <h4 class="text-white font-bold leading-tight group-hover:text-purple-300 transition-colors mb-2">
                    ${post.title}
                </h4>
                <p class="text-xs text-white/40 line-clamp-2 mt-auto">
                    ${post.descriptionPlain}
                </p>
            </div>
        </a>
    `).join('');

    return `
        <section class="max-w-4xl mx-auto mt-20 border-t border-white/5 pt-12">
            <h2 class="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                <i data-lucide="sparkles" class="text-purple-500"></i>
                Вам может понравиться
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                ${cardsHtml}
            </div>
        </section>
    `;
}

function getRelatedPosts(currentPost, allPosts) {
    if (!allPosts || allPosts.length < 2) return [];

    const currentTokens = tokenize(currentPost.title + " " + currentPost.descriptionPlain);

    // Calculate scores
    const scoredPosts = allPosts
        .filter(p => p.guid !== currentPost.guid) // Exclude self
        .map(p => {
            const otherTokens = tokenize(p.title + " " + p.descriptionPlain);
            const score = calculateSimilarity(currentTokens, otherTokens);
            return { post: p, score: score };
        });

    // Sort by score desc and take top 3
    return scoredPosts
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(item => item.post);
}

function calculateSimilarity(tokens1, tokens2) {
    let score = 0;
    const set2 = new Set(tokens2);
    for (const token of tokens1) {
        if (set2.has(token)) score++;
    }
    return score;
}

function tokenize(text) {
    return text.toLowerCase()
        .replace(/[^\w\sа-яё]/g, '') // Remove punctuation
        .split(/\s+/)
        .filter(w => w.length > 3); // Filter short words
}

// --- SHARED DATA FETCHING ---
// --- SHARED DATA FETCHING (RACE MODE) ---
async function getPosts() {
    const cachedPosts = loadFromCache();
    if (cachedPosts) return cachedPosts;

    const urls = CONFIG.RSS_URLS;

    // Create an array of promises - "Racers"
    // We try to fetch from ALL sources simultaneously.
    // The first one to return valid data wins.
    const promises = urls.flatMap(url => {
        const fetchers = [];

        // 1. Try with Proxy (Standard)
        fetchers.push(
            fetchAndParseRSS(`${CONFIG.PROXY_URL}${encodeURIComponent(url)}`, 'PROXY')
        );

        // 2. Try Direct Fetch (Optimistic - works if CORS enabled on source)
        // Especially likely for tg.i-c-a.su
        if (url.includes('tg.i-c-a.su') || url.includes('briefly.ru')) {
            fetchers.push(
                fetchAndParseRSS(url, 'DIRECT')
            );
        }

        return fetchers;
    });

    try {
        // Promise.any waits for the first FULFILLED promise
        const posts = await Promise.any(promises);

        if (posts && posts.length > 0) {
            saveToCache(posts);
            return posts;
        }
        throw new Error("No posts found in any feed");
    } catch (aggregateError) {
        console.warn('All mirrors failed', aggregateError);
        throw new Error('News Mirrors Unavailable');
    }
}

async function fetchAndParseRSS(url, type) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout per request

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`${type} Error: ${response.status}`);

        let xmlString;
        // Internal proxy returns text/xml directly, External (allorigins) returns JSON
        if (type === 'PROXY' && !url.startsWith('/api') && !url.includes('proxy.js')) {
            const data = await response.json();
            xmlString = data.contents;
        } else {
            xmlString = await response.text();
        }

        if (!xmlString || !xmlString.includes('<rss') && !xmlString.includes('<feed')) {
            throw new Error('Invalid XML');
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        const items = xmlDoc.querySelectorAll("item");

        if (items.length === 0) throw new Error('Empty Feed');

        console.log(`Race Winner: ${url} (${type})`);
        return Array.from(items).map(item => processXMLItem(item));

    } catch (e) {
        // console.debug(`Racer failed: ${url}`, e); // Optional logging
        throw e; // Propagate error for Promise.any to handle
    }
}

function processXMLItem(item) {
    const titleNode = item.querySelector("title");
    const linkNode = item.querySelector("link");
    const descNode = item.querySelector("description");
    const dateNode = item.querySelector("pubDate");
    const enclosureNode = item.querySelector("enclosure");

    // GUID needed for routing
    const guidNode = item.querySelector("guid");
    let guid = guidNode ? guidNode.textContent : (linkNode ? linkNode.textContent : null);

    let rawDesc = descNode ? (descNode.textContent || "") : "";

    // CLEANUP: Remove Telegram artifacts like [...] and [photo]
    rawDesc = rawDesc
        .replace(/\[\.\.\.\]/g, '')      // Remove [...]
        .replace(/\[photo\]/gi, '')      // Remove [photo]
        .replace(/\[video\]/gi, '')      // Remove [video]
        .replace(/\[album\]/gi, '');     // Remove [album]
    let imageUrl = enclosureNode ? enclosureNode.getAttribute("url") : null;

    if (!imageUrl && rawDesc) {
        let match = rawDesc.match(/src="([^"]+)"/);
        if (match) imageUrl = match[1];
    }
    if (!imageUrl) {
        const contentEncoded = item.getElementsByTagNameNS("*", "encoded")[0];
        if (contentEncoded) {
            const match = contentEncoded.textContent.match(/src="([^"]+)"/);
            if (match) imageUrl = match[1];
        }
    }

    // Prepare Plain Text for previews and HTML for Full Post
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = rawDesc;
    const cleanText = (tempDiv.textContent || tempDiv.innerText || "").replace(/\s+/g, ' ').trim();

    let title = titleNode ? titleNode.textContent : "";

    // Clean Title as well
    title = title
        .replace(/\[\.\.\.\]/g, '')
        .replace(/\[photo\]/gi, '')
        .replace(/\[video\]/gi, '')
        .replace(/\[album\]/gi, '')
        .trim();

    if (title.length < 5 || title === "Telegram Channel") {
        title = cleanText.substring(0, 80) + (cleanText.length > 80 ? "..." : "");
    }

    const pubDate = new Date(dateNode ? dateNode.textContent : new Date());

    return {
        guid: guid,
        title: title,
        link: linkNode ? linkNode.textContent : "#",
        pubDate: pubDate.toISOString(),
        isoDate: pubDate.toISOString(),
        displayDate: pubDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
        image: imageUrl,
        descriptionPlain: cleanText.substring(0, 150) + '...',
        contentHtml: rawDesc, // Full HTML for the post page
    };
}

function loadFromCache(ignoreTime = false) {
    try {
        const json = localStorage.getItem(CONFIG.CACHE_KEY_DATA);
        const lastFetch = localStorage.getItem(CONFIG.CACHE_KEY_TIME);
        if (!json || !lastFetch) return null;
        if (!ignoreTime && (Date.now() - parseInt(lastFetch) > CONFIG.CACHE_DURATION)) return null;
        return JSON.parse(json);
    } catch { return null; }
}

function saveToCache(posts) {
    try {
        localStorage.setItem(CONFIG.CACHE_KEY_DATA, JSON.stringify(posts));
        localStorage.setItem(CONFIG.CACHE_KEY_TIME, Date.now().toString());
    } catch { }
}

function renderError(container, error) {
    container.innerHTML = `<div class="col-span-full text-center text-white/50 py-12">
        <div class="text-red-400 opacity-80 mb-2">Не удалось загрузить новости</div>
        <div class="text-[10px] uppercase opacity-40">${error.message}</div>
    </div>`;
}

document.addEventListener('DOMContentLoaded', initTelegramBlog);

// --- AUDIO LOGIC ---
let currentUtterance = null;

function toggleAudio(btn) {
    const text = decodeURIComponent(btn.getAttribute('data-text'));
    const iconSpan = btn.querySelector('#audio-icon');
    const textSpan = btn.querySelector('#audio-text');
    const waveDiv = btn.querySelector('#audio-wave');

    if (window.speechSynthesis.speaking) {
        // Stop logic
        window.speechSynthesis.cancel();
        resetAudioUI(btn);
    } else {
        // Play logic
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ru-RU';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // UI Updates
        textSpan.textContent = "Остановить";
        iconSpan.innerHTML = '<i data-lucide="square" class="w-3 h-3 fill-current"></i>';
        waveDiv.classList.remove('hidden');
        lucide.createIcons();

        // Events
        utterance.onend = () => resetAudioUI(btn);
        utterance.onerror = (e) => {
            console.error('Speech error', e);
            resetAudioUI(btn);
        };

        currentUtterance = utterance;
        window.speechSynthesis.speak(utterance);
    }
}

function resetAudioUI(btn) {
    if (!btn) return;
    const iconSpan = btn.querySelector('#audio-icon');
    const textSpan = btn.querySelector('#audio-text');
    const waveDiv = btn.querySelector('#audio-wave');

    textSpan.textContent = "Слушать статью";
    iconSpan.innerHTML = '<i data-lucide="headphones" class="w-4 h-4"></i>';
    waveDiv.classList.add('hidden');
    lucide.createIcons();
    currentUtterance = null;
}

// Ensure audio stops when leaving page
window.addEventListener('beforeunload', () => {
    window.speechSynthesis.cancel();
});
