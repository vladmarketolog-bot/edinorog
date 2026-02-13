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
    PROXY_URL: 'proxy.php?url=',
    CACHE_KEY_DATA: 'tg_blog_data_v15_final', // Fixed slug consistency
    CACHE_KEY_TIME: 'tg_blog_last_fetch_v5',
    CACHE_DURATION: 6 * 60 * 60 * 1000, // 6 hours
    FEED_CONTAINER_ID: 'posts-container',
    HERO_CONTAINER_ID: 'hero-container',
    POST_CONTAINER_ID: 'single-post-container',
    ARCHIVE_CONTAINER_ID: 'archive-container',
    MAX_POSTS: 12
};

// --- PAGINATION STATE ---
let allPosts = [];          // Store all fetched posts
let currentPage = 1;        // Current page number
const POSTS_PER_PAGE = 6;   // Posts to show per page

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
        initSearch();
    }
}

// --- SEARCH LOGIC ---
function initSearch() {
    const input = document.getElementById('search-input');
    const btn = document.getElementById('search-btn');

    if (!input) return;

    const performSearch = async () => {
        const query = input.value.trim().toLowerCase();
        const container = document.getElementById(CONFIG.FEED_CONTAINER_ID);
        const hero = document.getElementById(CONFIG.HERO_CONTAINER_ID);

        if (!container) return;

        // Visual loading state
        container.style.opacity = '0.5';

        try {
            const allPosts = await getPosts();

            // If empty query, restore default view
            if (!query) {
                if (hero) hero.style.display = 'block';
                if (allPosts.length > 0 && hero) {
                    renderFeed(allPosts.slice(1), container);
                } else {
                    renderFeed(allPosts, container);
                }
                container.style.opacity = '1';
                return;
            }

            // Filter logic
            const filtered = allPosts.filter(post =>
                post.title.toLowerCase().includes(query) ||
                post.descriptionPlain.toLowerCase().includes(query)
            );

            // Hide hero during search
            if (hero) hero.style.display = 'none';

            // Render results
            if (filtered.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-20">
                        <div class="text-white/30 text-xl font-bold mb-2">Ничего не найдено</div>
                        <p class="text-white/20 text-sm">Попробуйте другой запрос</p>
                    </div>
                `;
            } else {
                renderFeed(filtered, container);
            }
        } catch (e) {
            console.error(e);
        } finally {
            container.style.opacity = '1';
        }
    };

    // Events
    input.addEventListener('input', (e) => {
        // Debounce slightly
        clearTimeout(window.searchTimeout);
        window.searchTimeout = setTimeout(performSearch, 300);
    });

    if (btn) btn.addEventListener('click', performSearch);
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

    // 1. Try CACHED data first (Stale-While-Revalidate)
    const cachedPosts = loadFromCache(true); // true = force return even if expired
    const isCacheExpired = checkCacheExpired();

    if (cachedPosts) {
        // Store all posts for pagination
        allPosts = cachedPosts;

        // Render immediately
        if (cachedPosts.length > 0 && heroContainer) {
            renderHero(cachedPosts[0], heroContainer);
            renderFeed(cachedPosts.slice(1), container);
        } else {
            renderFeed(cachedPosts, container);
        }

        // Use a subtitle loading for background update
        if (isCacheExpired) {
            showUpdateSpinner(container);
            // Background Fetch
            fetchAndRender(container, heroContainer);
        }
    } else {
        // No cache: Full loading state
        container.innerHTML = `<div class="col-span-full text-center py-20">
            <div class="inline-block w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4"></div>
            <div class="text-white/50 animate-pulse">Загрузка ленты...</div>
        </div>`;
        await fetchAndRender(container, heroContainer);
    }
}

function showUpdateSpinner(container) {
    if (!document.getElementById('bg-update-spinner')) {
        const spinner = document.createElement('div');
        spinner.id = 'bg-update-spinner';
        spinner.className = 'fixed top-24 right-6 z-50 bg-black/80 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 border border-white/10 shadow-xl';
        spinner.innerHTML = `
            <div class="w-3 h-3 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
            <span class="text-xs text-white/50 font-medium">Обновление...</span>
         `;
        document.body.appendChild(spinner);
    }
}

function hideUpdateSpinner() {
    const spinner = document.getElementById('bg-update-spinner');
    if (spinner) spinner.remove();
}

async function fetchAndRender(container, heroContainer) {
    try {
        const posts = await getPosts(true); // force fetch
        hideUpdateSpinner();

        // Store all posts for pagination
        allPosts = posts;

        if (posts.length > 0 && heroContainer) {
            renderHero(posts[0], heroContainer);
            renderFeed(posts.slice(1), container);
        } else {
            renderFeed(posts, container);
        }
    } catch (error) {
        hideUpdateSpinner();
        // If we have cached content, don't clear it on error
        if (container.children.length === 0) {
            // RENDER ERROR TO UI
            container.innerHTML = `
                <div class="col-span-full text-center py-20">
                    <div class="text-red-500 font-bold mb-2">Ошибка загрузки</div>
                    <div class="text-white/50 text-sm mb-4">${error.message}</div>
                    <div class="text-xs text-white/30 font-mono bg-black/50 p-2 rounded text-left inline-block max-w-lg overflow-auto">
                        ${JSON.stringify(error, Object.getOwnPropertyNames(error))}
                    </div>
                </div>
            `;
        }
    }
}

function renderHero(post, container) {
    // Use server-provided slug to ensure consistency
    const slug = post.slug;
    const postUrl = (slug && slug.length > 3) ? `article/${slug}` : `post.php?id=${encodeURIComponent(post.guid)}`;

    // Fallback description
    const desc = post.descriptionPlain || "";

    container.innerHTML = `
        <section class="group cursor-pointer relative h-full">
            <a href="${postUrl}" class="absolute inset-0 z-30"></a>
            <div class="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            
            <!-- Mobile: Vertical Aspect / Desktop: Ultrawide -->
            <div class="relative aspect-[4/5] md:aspect-[21/9] rounded-[2rem] overflow-hidden theme-border bg-black flex flex-col justify-end">
                <!-- Abstract Gradient Fallback -->
                <div class="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-black to-pink-900/40"></div>
                
                <div class="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10"></div>

                <div class="relative p-6 md:p-12 max-w-4xl z-20">
                    <div class="flex items-center gap-3 mb-4 md:mb-6">
                        <span class="px-3 py-1 bg-purple-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                            Новое
                        </span>
                        <span class="text-white/80 text-xs font-medium flex items-center gap-1.5">
                            <i data-lucide="clock" class="w-3.5 h-3.5"></i> ${post.displayDate}
                        </span>
                    </div>
                    <h1 class="text-2xl md:text-5xl font-bold leading-tight mb-4 md:mb-6 text-white group-hover:text-purple-100 transition-colors">
                        ${post.title}
                    </h1>
                    <p class="text-base md:text-lg text-white/70 line-clamp-3 md:line-clamp-2 leading-relaxed mb-6 md:mb-8">
                        ${desc}
                    </p>
                    <div class="flex items-center gap-4 opacity-100 md:opacity-0 group-hover:opacity-100 transform translate-y-0 md:translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                        <span class="text-sm font-semibold text-purple-400 flex items-center gap-2">
                            Читать статью <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
                        </span>
                    </div>
                </div>
            </div>
        </section>
    `;
}

function renderFeed(posts, container, append = false) {
    if (!append) {
        container.innerHTML = '';
        currentPage = 1;
    }

    const postsToRender = append ? posts : posts.slice(0, POSTS_PER_PAGE);

    postsToRender.forEach(post => {
        const article = document.createElement('article');
        // Use theme- classes instead of hardcoded bg-[#0a0a0a] etc.
        article.className = 'group relative flex flex-col rounded-[2rem] overflow-hidden theme-bg-card border theme-border hover:border-purple-500/50 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-2xl';

        // Use server-provided slug to ensure consistency
        const slug = post.slug;
        let postUrl = (slug && slug.length > 3) ? `article/${slug}` : `post.php?id=${encodeURIComponent(post.guid)}`;
        let targetAttr = '';
        let actionIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
        let actionText = 'Читать далее';

        // --- DIRECT LINK FOR MEDIA-ONLY POSTS ---
        const descPlain = post.descriptionPlain || '';
        const contentRaw = post.contentHtml || '';
        // Check if "Empty" placeholder present OR very short plain text (< 30 chars)
        if (contentRaw.includes('Медиа-файл без текстового описания') || descPlain.length < 30) {
            postUrl = post.link || 'https://t.me/Theedinorogblog';
            targetAttr = 'target="_blank"';
            actionIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>';
            actionText = 'Открыть в Telegram';
        }

        article.innerHTML = `
            <a href="${postUrl}" ${targetAttr} class="absolute inset-0 z-20"></a>

            <div class="p-6 flex-1 flex flex-col relative z-20 pointer-events-none">
                <div class="flex items-center gap-3 text-purple-500 text-[10px] font-bold uppercase tracking-widest mb-3">
                    <span class="w-1.5 h-1.5 rounded-full bg-purple-500 box-shadow-purple"></span>
                    <time datetime="${post.isoDate}">${post.displayDate}</time>
                </div>
                
                <h3 class="text-lg font-bold theme-text-main mb-2 leading-tight group-hover:text-purple-400 transition-colors">
                    ${post.title}
                </h3>
                
                <p class="text-sm theme-text-muted leading-relaxed mb-6">
                    ${post.descriptionPlain}
                </p>

                <div class="pt-6 border-t theme-border flex items-center justify-between mt-auto">
                    <span class="text-xs theme-text-muted font-medium opacity-60">${actionText}</span>
                    
                    <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center theme-text-muted group-hover:bg-purple-500 group-hover:text-white transition-all">
                        ${actionIcon}
                    </div>
                </div>
            </div>
        `;
        container.appendChild(article);
    });

    // Update load more button visibility
    if (!append) {
        updateLoadMoreButton();
    }
}

// --- PAGINATION LOGIC ---
window.loadMore = function () {
    const container = document.getElementById(CONFIG.FEED_CONTAINER_ID);
    if (!container || allPosts.length === 0) return;

    currentPage++;
    const heroOffset = document.getElementById(CONFIG.HERO_CONTAINER_ID) ? 1 : 0;
    const start = heroOffset + (currentPage - 1) * POSTS_PER_PAGE;
    const end = start + POSTS_PER_PAGE;
    const postsToRender = allPosts.slice(start, end);

    if (postsToRender.length > 0) {
        renderFeed(postsToRender, container, true); // append = true
        updateLoadMoreButton();
    }
};

function updateLoadMoreButton() {
    const btn = document.getElementById('load-more-btn');
    if (!btn) return;

    const heroOffset = document.getElementById(CONFIG.HERO_CONTAINER_ID) ? 1 : 0;
    const displayedCount = heroOffset + currentPage * POSTS_PER_PAGE;
    const remainingCount = allPosts.length - displayedCount;

    if (remainingCount > 0) {
        btn.style.display = 'flex';
        const countText = btn.querySelector('.remaining-count');
        if (countText) {
            countText.textContent = `(${remainingCount})`;
        }
    } else {
        btn.style.display = 'none';
    }
}

// --- ARCHIVE LOGIC (Archive) ---
async function initArchive() {
    const container = document.getElementById(CONFIG.ARCHIVE_CONTAINER_ID);
    if (!container) return;

    // Loader
    container.innerHTML = '<div class="text-center py-20 text-white/50 animate-pulse">Загрузка полного архива...</div>';

    try {
        const posts = await getPosts();
        renderArchive(posts, container);
    } catch (error) {
        renderError(container, error);
    }
}

function renderArchive(posts, container) {
    container.innerHTML = '';

    // Group by Month Year
    const groups = {};
    posts.forEach(post => {
        const date = new Date(post.isoDate);
        const key = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
        if (!groups[key]) groups[key] = [];
        groups[key].push(post);
    });

    Object.keys(groups).forEach(key => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'mb-12';

        groupDiv.innerHTML = `
            <h3 class="text-2xl font-bold text-white mb-6 capitalize border-b border-white/10 pb-2">${key}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${groups[key].map(post => {
            // Use server-provided slug to ensure consistency
            const slug = post.slug;
            const postUrl = (slug && slug.length > 3) ? `article/${slug}` : `post.php?id=${encodeURIComponent(post.guid)}`;

            return `
                    <a href="${postUrl}" class="flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors group">
                        <div class="w-2 h-2 mt-2 rounded-full bg-purple-500/50 group-hover:bg-purple-500 transition-colors flex-shrink-0"></div>
                        <div>
                            <h4 class="text-white font-medium text-lg leading-snug group-hover:text-purple-400 transition-colors line-clamp-4">${post.title}</h4>
                            <time class="text-xs text-white/40 mt-1 block">${post.displayDate}</time>
                        </div>
                    </a>
                    `;
        }).join('')}
            </div>
        `;
        container.appendChild(groupDiv);
    });
}

// --- SINGLE POST LOGIC (Post) ---
async function initSinglePost(postId) {
    const container = document.getElementById(CONFIG.POST_CONTAINER_ID);
    if (!container) return; // Not on post page

    try {
        const posts = await getPosts();
        // Find post by GUID (link is usually the guid in RSS)
        let post = posts.find(p => p.guid === postId || p.guid === decodeURIComponent(postId));

        // DEEP FETCH (Fallback to Backend API if not found)
        if (!post) {

            try {
                const backendPosts = await fetch('api/feed.php').then(r => r.json());
                if (backendPosts && Array.isArray(backendPosts)) {
                    post = backendPosts.find(p => p.guid === postId || p.guid === decodeURIComponent(postId));
                    // If found, we should also save this "Deep" list to cache to repair local state
                    if (post) {
                        saveToCache(mergePosts(backendPosts, loadFromCache(true) || []));
                    }
                }
            } catch (deepErr) {
                console.error("Deep fetch failed", deepErr);
            }
        }

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

    // Dynamic SEO / Open Graph Update
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
        ogTitle = document.createElement('meta');
        ogTitle.setAttribute('property', 'og:title');
        document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', post.title);

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) {
        ogDesc = document.createElement('meta');
        ogDesc.setAttribute('property', 'og:description');
        document.head.appendChild(ogDesc);
    }
    ogDesc.setAttribute('content', post.descriptionPlain);

    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
        ogUrl = document.createElement('meta');
        ogUrl.setAttribute('property', 'og:url');
        document.head.appendChild(ogUrl);
    }
    ogUrl.setAttribute('content', window.location.href);

    if (post.image) {
        let ogImage = document.querySelector('meta[property="og:image"]');
        if (!ogImage) {
            ogImage = document.createElement('meta');
            ogImage.setAttribute('property', 'og:image');
            document.head.appendChild(ogImage);
        }
        ogImage.setAttribute('content', post.image);
    }



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
        </header>

        <div class="prose prose-invert prose-lg max-w-none mb-16 [&>p:first-of-type]:text-4xl [&>p:first-of-type]:md:text-5xl [&>p:first-of-type]:font-bold [&>p:first-of-type]:leading-tight [&>p:first-of-type]:mb-8 [&>p:first-of-type]:text-white">
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
                <a href="https://t.me/Theedinorogblog" target="_blank" class="inline-flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full font-bold uppercase tracking-wider hover:bg-purple-400 hover:text-white transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
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

    const cardsHtml = related.map(post => {
        const slug = slugify(post.originalTitle || post.title);
        const postUrl = (slug && slug.length > 3) ? `article/${slug}` : `post.php?id=${encodeURIComponent(post.guid)}`;

        return `
        <a href="${postUrl}" class="group relative flex flex-col rounded-2xl overflow-hidden bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all">
            <div class="p-5 flex flex-col h-full">
                <span class="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-2">Читать также</span>
                <h4 class="text-white font-bold leading-tight group-hover:text-purple-300 transition-colors mb-2 line-clamp-4">
                    ${post.title}
                </h4>
                <p class="text-xs text-white/40 line-clamp-2 mt-auto">
                    ${post.descriptionPlain}
                </p>
            </div>
        </a>`;
    }).join('');

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

function slugify(text) {
    // Transliteration Map (Sync with PHP)
    const cyr = [
        'а', 'б', 'в', 'г', 'д', 'е', 'ё', 'ж', 'з', 'и', 'й', 'к', 'л', 'м', 'н', 'о', 'п',
        'р', 'с', 'т', 'у', 'ф', 'х', 'ц', 'ч', 'ш', 'щ', 'ъ', 'ы', 'ь', 'э', 'ю', 'я',
        'А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ё', 'Ж', 'З', 'И', 'Й', 'К', 'Л', 'М', 'Н', 'О', 'П',
        'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ъ', 'Ы', 'Ь', 'Э', 'Ю', 'Я'
    ];
    const lat = [
        'a', 'b', 'v', 'g', 'd', 'e', 'yo', 'zh', 'z', 'i', 'y', 'k', 'l', 'm', 'n', 'o', 'p',
        'r', 's', 't', 'u', 'f', 'h', 'ts', 'ch', 'sh', 'sch', '', 'y', '', 'e', 'yu', 'ya',
        'a', 'b', 'v', 'g', 'd', 'e', 'yo', 'zh', 'z', 'i', 'y', 'k', 'l', 'm', 'n', 'o', 'p',
        'r', 's', 't', 'u', 'f', 'h', 'ts', 'ch', 'sh', 'sch', '', 'y', '', 'e', 'yu', 'ya'
    ];

    // Simple replacement loop
    for (let i = 0; i < cyr.length; i++) {
        text = text.split(cyr[i]).join(lat[i]);
    }

    return text.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove invalid chars
        .replace(/[\s-]+/g, '-')      // Collapse whitespace/dashes
        .replace(/^-+|-+$/g, '');     // Trim dashes
}

function mergePosts(newPosts, oldPosts) {
    const existingGuids = new Set(newPosts.map(p => p.guid));
    const uniqueOldPosts = oldPosts.filter(p => !existingGuids.has(p.guid));

    // Combine: New ones first (updates), then older ones
    let combined = [...newPosts, ...uniqueOldPosts];

    // Optional: Sort by date descending to be sure
    combined.sort((a, b) => new Date(b.isoDate) - new Date(a.isoDate));

    return combined;
}

// --- SHARED DATA FETCHING ---
// --- SHARED DATA FETCHING (RACE MODE) ---
// --- SHARED DATA FETCHING (SERVER AGGREGATION MODE) ---
async function getPosts(force = false) {
    const cachedPosts = loadFromCache(!force);
    if (cachedPosts && !force) {
        return cachedPosts;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const response = await fetch('get_feed.php', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Server Error: ${response.status}`);
        }

        const posts = await response.json();

        if (posts && posts.length > 0) {
            // MERGE LOGIC: Combine fresh posts with cached posts to preserve history
            const existingCache = loadFromCache(true) || [];
            const mergedPosts = mergePosts(posts, existingCache);

            saveToCache(mergedPosts);
            return mergedPosts;
        } else {
            throw new Error("Server returned empty feed");
        }
    } catch (e) {

        throw new Error('Feed Unavailable: ' + e.message);
    }
}

// Legacy function kept but unused (or deleted if preferred)
async function fetchAndParseRSS(url, type) {
    // ... (Logic removed to save space)
    return [];
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

    // 1. Try to get FULL content from content:encoded
    const contentEncodedNode = item.getElementsByTagNameNS("*", "encoded")[0];
    let fullContent = contentEncodedNode ? (contentEncodedNode.textContent || "") : "";

    // 2. Fallback to description if content:encoded is empty
    let rawDesc = descNode ? (descNode.textContent || "") : "";
    if (!fullContent) {
        fullContent = rawDesc;
    }

    // 3. Cleanup Content
    fullContent = fullContent
        .replace(/\[\.\.\.\]/g, '')
        .replace(/\[photo\]/gi, '')
        .replace(/\[video\]/gi, '')
        .replace(/\[album\]/gi, '');

    // 4. Image Extraction Strategy
    let imageUrl = enclosureNode ? enclosureNode.getAttribute("url") : null;

    if (!imageUrl) {
        // Try to find in fullContent
        let match = fullContent.match(/src="([^"]+)"/);
        if (match) imageUrl = match[1];
    }

    // 5. Final Body Construction
    // If body is empty but we have an image, make the image the body
    if (!fullContent.trim() && imageUrl) {
        fullContent = `<img src="${imageUrl}" class="w-full rounded-xl my-4" alt="Photo">`;
    }
    // If body has text but no image, and we found an image elsewhere (enclosure), inject it at top
    // (Optional, but good for Telegram posts which often separate image from text)
    else if (imageUrl && !fullContent.includes(imageUrl)) {
        fullContent = `<img src="${imageUrl}" class="w-full rounded-xl mb-6 shadow-lg leading-none" alt="Cover">` + fullContent;
    }

    // FIX: Replace <br>, </p>, </div> with NEWLINES BEFORE getting textContent to preserve structure
    let tempHtml = rawDesc || fullContent;
    tempHtml = tempHtml.replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n');

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = tempHtml;

    // Get text with newlines
    let rawText = tempDiv.innerText || tempDiv.textContent || "";

    // Determine proper Title from CONTENT (First non-empty line)
    // Telegram RSS often gives garbage titles, so we prefer the first line of the body if it looks like a header
    let bodyTitle = "";
    const lines = rawText.split('\n');
    for (let line of lines) {
        line = line.trim();
        if (line.length > 3) {
            bodyTitle = line;
            break;
        }
    }

    // Use bodyTitle if found and reasonable length (< 150 chars)
    // Otherwise fall back to RSS title if it exists, or just truncate body

    let processedTitle = (titleNode ? titleNode.textContent : "").trim();
    processedTitle = processedTitle.replace(/\[\.\.\.\]/g, '').replace(/\[photo\]/gi, '').trim();

    // Strategy: If bodyTitle is detected and is different enough or RSS title seems bad
    if (bodyTitle && bodyTitle.length < 150) {
        processedTitle = bodyTitle;
    }

    if (!processedTitle) processedTitle = "Без названия";

    // Now create clean description map (spacing)
    const cleanText = rawText.replace(/\s+/g, ' ').trim();

    // DEDUPLICATION: If description starts with title, remove it
    let finalDesc = cleanText;
    if (finalDesc.startsWith(processedTitle)) {
        finalDesc = finalDesc.substring(processedTitle.length).trim();
    }
    // Also check if title has "..." at end and matches
    const titleNoEllipsis = processedTitle.replace(/\.\.\.$/, '');
    if (cleanText.startsWith(titleNoEllipsis)) {
        finalDesc = cleanText.substring(titleNoEllipsis.length).trim();
    }

    // Remove leading punctuation that might remain (. , -)
    // Remove leading punctuation that might remain (. , -)
    finalDesc = finalDesc.replace(/^[.,\-:\s]+/, '');

    // --- SMART TRUNCATION HELPER ---
    const smartTruncate = (text, limit) => {
        if (!text || text.length <= limit) return text;

        const truncated = text.substring(0, limit);

        // Try to cut at the last sentence end (. ! ?)
        // regex looks for [.!?] followed by space or end of string
        const lastSentenceExp = /[.!?](?:\s|$)/g;
        let match;
        let lastSentenceIndex = -1;

        while ((match = lastSentenceExp.exec(truncated)) !== null) {
            lastSentenceIndex = match.index;
        }

        if (lastSentenceIndex > limit * 0.2) { // Ensure we don't return a tiny string
            return truncated.substring(0, lastSentenceIndex + 1);
        }

        // Fallback: Cut at the last space
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > 0) {
            return truncated.substring(0, lastSpace) + '...';
        }

        // Worst case: just cut
        return truncated + '...';
    };

    // Apply Smart Truncation
    const preview = smartTruncate(finalDesc, 200);

    // Also smart truncate title if it's too long (common in Telegram text-only posts)
    if (processedTitle.length > 100) {
        processedTitle = smartTruncate(processedTitle, 100);
    }



    const pubDate = new Date(dateNode ? dateNode.textContent : new Date());

    return {
        guid: guid,
        title: processedTitle, // Smart Display Title
        originalTitle: originalTitle, // Stable RSS Title for Slugs
        link: linkNode ? linkNode.textContent : "#",
        pubDate: pubDate.toISOString(),
        isoDate: pubDate.toISOString(),
        displayDate: pubDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
        image: null,
        descriptionPlain: preview,
        contentHtml: fullContent,
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

function checkCacheExpired() {
    try {
        const lastFetch = localStorage.getItem(CONFIG.CACHE_KEY_TIME);
        if (!lastFetch) return true;
        return (Date.now() - parseInt(lastFetch) > CONFIG.CACHE_DURATION);
    } catch { return true; }
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
        <div class="text-[10px] uppercase opacity-40 max-w-lg mx-auto overflow-hidden text-ellipsis whitespace-nowrap" title="${error.message}">${error.message}</div>
        <div class="mt-4 text-xs">
            <button onclick="location.reload()" class="underline hover:text-white">Попробовать снова</button>
        </div>
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





// --- FORCE REFRESH LOGIC ---
window.forceUpdateFeed = async function (btn) {
    if (btn) {
        // Loading State
        btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>';
        btn.classList.remove('text-white/10', 'hover:text-white/50', 'text-red-500', 'text-green-500');
        btn.classList.add('text-white');
        if (window.lucide) window.lucide.createIcons();
    }

    // Clear Cache Time
    localStorage.removeItem(CONFIG.CACHE_KEY_TIME);

    try {
        const container = document.getElementById(CONFIG.FEED_CONTAINER_ID);
        if (container) container.style.opacity = '0.5';

        await getPosts(true); // Force Fetch

        // Success State
        if (btn) {
            btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
            btn.classList.remove('text-white');
            btn.classList.add('text-green-500');
            if (window.lucide) window.lucide.createIcons();
        }

        // Small delay to show success before reload
        setTimeout(() => location.reload(), 1000);

    } catch (e) {
        // Error State
        if (btn) {
            btn.innerHTML = '<i data-lucide="x-circle" class="w-4 h-4"></i>';
            btn.classList.remove('text-white', 'animate-spin');
            btn.classList.add('text-red-500');
            if (window.lucide) window.lucide.createIcons();
        }

        console.error(e);
        const container = document.getElementById(CONFIG.FEED_CONTAINER_ID);
        if (container) container.style.opacity = '1';

        // Optional: toast or alert
        // alert('Не удалось обновить: ' + e.message);
    }
};


window.addEventListener('beforeunload', () => {
    window.speechSynthesis.cancel();
});

