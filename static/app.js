// NetDL Chat Interface Orchestrator

document.addEventListener('DOMContentLoaded', () => {
    const els = {
        messagesContainer: document.getElementById('messages-container'),
        userInput: document.getElementById('user-input'),
        sendBtn: document.getElementById('send-btn'),
        clearChatBtn: document.getElementById('clear-chat-btn'),
        downloaderTrigger: document.getElementById('browser-downloader-trigger'),
        recentUpdatesList: document.getElementById('recent-updates-list'),
        mobileSidebarToggle: document.getElementById('mobile-sidebar-toggle'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        appContainer: document.querySelector('.app-container'),
        
        // New Catalog & Modal Elements
        chatFeatureBtn: document.getElementById('chat-feature-btn'),
        catalogFeatureBtn: document.getElementById('catalog-feature-btn'),
        chatWrapper: document.querySelector('.chat-wrapper'),
        catalogWrapper: document.getElementById('catalog-wrapper'),
        catalogGrid: document.getElementById('catalog-grid'),
        catalogSearchInput: document.getElementById('catalog-search-input'),
        catalogSearchBtn: document.getElementById('catalog-search-btn'),
        mobileCatalogSidebarToggle: document.getElementById('mobile-catalog-sidebar-toggle'),
        downloadModal: document.getElementById('download-modal'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        modalMovieTitle: document.getElementById('modal-movie-title'),
        modalBodyContent: document.getElementById('modal-body-content')
    };

    let catalogLoadedCount = 0;

    // Chatbot Welcome Greeting
    addBotMessage("👋 Hello! I am your <b>NetDL Assistant</b>. <br>I can search for any movie or TV series on Vegamovies and Rogmovies, bypass all ad shorteners, redirection traps, and Cloudflare gates, giving you **direct unthrottled download links** instantly!<br><br>Type a title below, paste a download post URL directly, or try one of the suggestions to start.");

    // Load recent updates feed
    loadRecentUploads();

    // Enable/disable send button
    els.userInput.addEventListener('input', () => {
        els.sendBtn.disabled = els.userInput.value.trim() === '';
    });

    els.userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && els.userInput.value.trim() !== '') {
            handleUserSearch(els.userInput.value.trim());
        }
    });

    els.sendBtn.addEventListener('click', () => {
        if (els.userInput.value.trim() !== '') {
            handleUserSearch(els.userInput.value.trim());
        }
    });

    els.clearChatBtn.addEventListener('click', () => {
        els.messagesContainer.innerHTML = '';
        addBotMessage("🧹 Chat history cleared! Ask for another movie or series below.");
    });

    // Mobile Sidebar controls
    if (els.mobileSidebarToggle && els.sidebarOverlay) {
        els.mobileSidebarToggle.addEventListener('click', () => {
            els.appContainer.classList.add('sidebar-open');
        });
        els.sidebarOverlay.addEventListener('click', () => {
            els.appContainer.classList.remove('sidebar-open');
        });
    }

    function closeSidebarOnMobile() {
        if (els.appContainer) {
            els.appContainer.classList.remove('sidebar-open');
        }
    }

    // Global handles for chips and suggestions
    window.sendSuggestion = (term) => {
        closeSidebarOnMobile();
        handleUserSearch(term);
    };
    // Expose globally so pagination buttons inside innerHTML can call it
    window.handleUserSearch = (query, page) => handleUserSearch(query, page);

    // Orchestrates user text queries
    async function handleUserSearch(query, page = 1) {
        if (page === 1) addUserMessage(query);
        els.userInput.value = '';
        els.sendBtn.disabled = true;
        closeSidebarOnMobile();

        const typingBubble = showTypingIndicator();
        
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&page=${page}`);
            const data = await res.json();
            
            removeTypingIndicator(typingBubble);

            if (data.status === 'direct_url') {
                addBotMessage(`🔗 <b>Direct URL paste detected!</b> Bypassing search aggregator and extracting download details...`);
                handleMovieSelection(data.url, data.url, true);
            } else if (data.status === 'success' && data.results.length > 0) {
                if (page === 1) {
                    addBotMessage(`🔍 Found <b>${data.results.length} similar search matches</b> on our network:`);
                } else {
                    addBotMessage(`📄 Page <b>${page}</b> results for "<b>${query}</b>":`);
                }
                renderMovieGrid(data.results, { query, page: data.page, hasMore: data.has_more });
            } else {
                addBotMessage(`😕 Sorry, I couldn't find any results for "<b>${query}</b>". Make sure the spelling is correct or try a different keyword.`);
            }
        } catch (err) {
            removeTypingIndicator(typingBubble);
            addBotMessage("<div class='error-bubble'><i class='fa-solid fa-circle-exclamation'></i> Network error connecting to NetDL backend.</div>");
        } finally {
            els.sendBtn.disabled = false;
        }
    }

    // Renders the list of movie/series search results
    function renderMovieGrid(movies, pagination = {}) {
        const { query = '', page = 1, hasMore = false } = pagination;

        const grid = document.createElement('div');
        grid.className = 'movie-results-grid';

        movies.forEach(movie => {
            const card = document.createElement('div');
            card.className = 'movie-card';
            
            const posterImg = movie.thumbnail || '/static/default-poster.jpg';
            const badgeClass = movie.site === 'vegamovies' ? 'site-badge vegamovies' : 'site-badge rogmovies';
            const badgeText = movie.site === 'vegamovies' ? 'VegaMovies' : 'RogMovies';

            // Classify title to determine if Movie or Series
            const isSeries = movie.title.toLowerCase().includes('season') || 
                             movie.title.toLowerCase().includes('episode') || 
                             movie.title.toLowerCase().includes('series') || 
                             movie.title.toLowerCase().includes('complete') ||
                             /s\d+/i.test(movie.title);
            const typeBadgeText = isSeries ? 'Series' : 'Movie';
            const typeBadgeClass = isSeries ? 'type-badge series' : 'type-badge movie';

            card.innerHTML = `
                <div class="movie-poster">
                    <span class="${badgeClass}">${badgeText}</span>
                    <span class="${typeBadgeClass}">${typeBadgeText}</span>
                    <img src="${posterImg}" alt="${movie.title}" onerror="this.src='https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=300&auto=format&fit=crop'">
                </div>
                <div class="movie-info">
                    <p class="movie-title">${movie.title}</p>
                </div>
            `;
            
            card.addEventListener('click', () => {
                closeSidebarOnMobile();
                handleMovieSelection(movie.title, movie.url);
            });
            
            grid.appendChild(card);
        });

        // Pagination row — Next Page button
        // Show Next Page if hasMore OR if it's page 1 and results exist (optimistic)
        const showNextPage = hasMore || (page === 1 && movies.length >= 5);
        if (showNextPage && query) {
            const paginationBar = document.createElement('div');
            paginationBar.className = 'search-pagination-bar';
            paginationBar.innerHTML = `
                <span class="pagination-info">Page ${page} &middot; ${movies.length} results</span>
                <button class="pagination-next-btn" id="chat-next-page-btn-${page}">
                    <i class="fa-solid fa-angles-right"></i> Next Page
                </button>
            `;
            const nextBtn = paginationBar.querySelector(`#chat-next-page-btn-${page}`);
            nextBtn.addEventListener('click', () => {
                nextBtn.disabled = true;
                nextBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Loading...`;
                window.handleUserSearch(query, page + 1);
            });
            grid.appendChild(paginationBar);
        } else if (query && page > 1) {
            const endBar = document.createElement('div');
            endBar.className = 'search-pagination-bar';
            endBar.innerHTML = `<span class="pagination-info"><i class="fa-solid fa-check-circle"></i> All results loaded</span>`;
            grid.appendChild(endBar);
        }

        // Add the grid element inline inside the messages list
        const msgWrapper = document.createElement('div');
        msgWrapper.className = 'message bot';
        msgWrapper.style.maxWidth = '100%';
        msgWrapper.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content-wrapper">
                <div class="message-bubble" style="background: transparent; border: none; padding: 0;"></div>
            </div>
        `;
        msgWrapper.querySelector('.message-bubble').appendChild(grid);
        appendMessageElement(msgWrapper);
    }

    // Orchestrates movie selection (fetches resolutions/options)
    async function handleMovieSelection(title, postUrl, isDirectUrl = false) {
        if (!isDirectUrl) {
            addUserMessage(`Select: ${title}`);
        }
        closeSidebarOnMobile();
        
        const typingBubble = showTypingIndicator();

        try {
            const res = await fetch(`/api/details?url=${encodeURIComponent(postUrl)}`);
            const data = await res.json();
            
            removeTypingIndicator(typingBubble);

            if (data.status === 'success' && data.packages.length > 0) {
                addBotMessage(`📦 Scraped <b>${data.packages.length} download packages/resolutions</b> for selection. Pick one to see episodes or direct links:`);
                renderResolutionsGrid(data.packages);
            } else {
                addBotMessage(`😕 I couldn't find any direct download packages on the page. The post might be a generic update without download links.`);
            }
        } catch (err) {
            removeTypingIndicator(typingBubble);
            addBotMessage("<div class='error-bubble'><i class='fa-solid fa-circle-exclamation'></i> Error extracting packages from the post page.</div>");
        }
    }

    // Renders the list of download resolution packs
    function renderResolutionsGrid(packages) {
        const grid = document.createElement('div');
        grid.className = 'resolution-packages-grid';

        packages.forEach(pkg => {
            const card = document.createElement('div');
            card.className = 'resolution-card';
            
            // Clean up titles by matching resolution values
            let badge = 'DL';
            if (pkg.label.includes('720p')) badge = '720p HD';
            else if (pkg.label.includes('1080p')) badge = '1080p FHD';
            else if (pkg.label.includes('480p')) badge = '480p SD';
            else if (pkg.label.includes('2160p') || pkg.label.includes('4K')) badge = '4K UHD';
            
            card.innerHTML = `
                <div class="res-meta">
                    <span class="res-title">${pkg.label}</span>
                    <span class="res-badge">${badge}</span>
                </div>
                <div class="res-download-btn"><i class="fa-solid fa-download"></i></div>
            `;
            
            card.addEventListener('click', () => {
                closeSidebarOnMobile();
                handleResolutionSelection(pkg.label, pkg.nexdrive_url);
            });
            
            grid.appendChild(card);
        });

        const msgWrapper = document.createElement('div');
        msgWrapper.className = 'message bot';
        msgWrapper.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content-wrapper">
                <div class="message-bubble" style="background: transparent; border: none; padding: 0;"></div>
            </div>
        `;
        msgWrapper.querySelector('.message-bubble').appendChild(grid);
        appendMessageElement(msgWrapper);
    }

    // Orchestrates resolution selection (fetches episodes list / movie VCloud)
    async function handleResolutionSelection(label, nexdriveUrl) {
        addUserMessage(`Quality: ${label}`);
        closeSidebarOnMobile();
        
        const typingBubble = showTypingIndicator();

        try {
            const res = await fetch(`/api/episodes?url=${encodeURIComponent(nexdriveUrl)}`);
            const responseData = await res.json();
            
            removeTypingIndicator(typingBubble);

            if (responseData.status === 'success' && responseData.data.items && responseData.data.items.length > 0) {
                const mediaData = responseData.data;
                
                if (mediaData.type === 'series') {
                    addBotMessage(`📺 Detected a <b>WEB-Series Season</b> containing <b>${mediaData.items.length} episodes</b>. Select a specific episode or download them all:`);
                    renderEpisodesGrid(mediaData.items);
                } else if (mediaData.type === 'batch') {
                    addBotMessage(`📦 Detected a <b>Batch ZIP package</b>. Download the complete season/movie archive directly:`);
                    renderBatchCard(mediaData.items, label);
                } else {
                    // Movie (single file download options)
                    addBotMessage(`🎬 Detected a <b>Movie link package</b>. Click below to begin downloading:`);
                    renderMoviePackageCard(mediaData.items, label);
                }
            } else {
                addBotMessage(`😕 Failed to fetch final download paths from the gateway. The links might be broken or offline.`);
            }
        } catch (err) {
            removeTypingIndicator(typingBubble);
            addBotMessage("<div class='error-bubble'><i class='fa-solid fa-circle-exclamation'></i> Network error fetching links.</div>");
        }
    }

    // Renders custom Netflix-style movie package UI cards
    function renderMoviePackageCard(items, label) {
        const card = document.createElement('div');
        card.className = 'movie-package-card';
        
        card.innerHTML = `
            <div class="movie-package-header">
                <div class="movie-package-icon"><i class="fa-solid fa-film"></i></div>
                <div class="movie-package-details">
                    <h3>${label}</h3>
                    <p>High-speed direct unthrottled streaming and download mirrors</p>
                </div>
            </div>
            <div class="movie-download-actions" id="movie-actions-container"></div>
        `;
        
        const actionsContainer = card.querySelector('#movie-actions-container');
        items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'movie-btn movie-btn-primary';
            btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> Download: ${item.title}`;
            btn.addEventListener('click', () => {
                triggerDirectDownload(item.title, item.vcloud_url);
            });
            actionsContainer.appendChild(btn);
        });
        
        const msgWrapper = document.createElement('div');
        msgWrapper.className = 'message bot';
        msgWrapper.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content-wrapper">
                <div class="message-bubble" style="background: transparent; border: none; padding: 0;"></div>
            </div>
        `;
        msgWrapper.querySelector('.message-bubble').appendChild(card);
        appendMessageElement(msgWrapper);
    }

    // Renders custom Netflix-style batch ZIP package cards
    function renderBatchCard(items, label) {
        const card = document.createElement('div');
        card.className = 'batch-package-card';
        
        card.innerHTML = `
            <div class="batch-header">
                <div class="batch-icon-box"><i class="fa-solid fa-file-zipper"></i></div>
                <div class="batch-meta">
                    <span class="batch-title">${label}</span>
                    <span class="batch-desc">Full series/movie compressed archives grouped in one package</span>
                </div>
            </div>
            <span class="batch-size-badge">ZIP DIRECT DOWNLOAD</span>
            <div class="batch-actions" id="batch-actions-container"></div>
        `;
        
        const actionsContainer = card.querySelector('#batch-actions-container');
        items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'batch-btn batch-btn-primary';
            btn.innerHTML = `<i class="fa-solid fa-bolt"></i> UNZIP & BATCH DOWNLOAD: ${item.title}`;
            btn.addEventListener('click', () => {
                triggerDirectDownload(item.title, item.vcloud_url);
            });
            actionsContainer.appendChild(btn);
        });
        
        const msgWrapper = document.createElement('div');
        msgWrapper.className = 'message bot';
        msgWrapper.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content-wrapper">
                <div class="message-bubble" style="background: transparent; border: none; padding: 0;"></div>
            </div>
        `;
        msgWrapper.querySelector('.message-bubble').appendChild(card);
        appendMessageElement(msgWrapper);
    }

    // Renders the episode selection grid for TV series
    function renderEpisodesGrid(episodes) {
        const panel = document.createElement('div');
        panel.className = 'episodes-panel';
        
        const header = document.createElement('div');
        header.className = 'episodes-header';
        header.innerHTML = `
            <h4>Select Episode to Download</h4>
            <span class="episodes-header-badge">${episodes.length} Episodes</span>
        `;
        panel.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'episodes-grid';

        episodes.forEach(ep => {
            const btn = document.createElement('button');
            btn.className = 'episode-btn';
            btn.innerHTML = `<i class="fa-solid fa-tv"></i><span>Ep ${ep.episode}</span>`;
            
            btn.addEventListener('click', () => {
                triggerDirectDownload(`Episode ${ep.episode}`, ep.vcloud_url);
            });
            
            grid.appendChild(btn);
        });
        panel.appendChild(grid);

        // Add a "⚡ BULK DOWNLOAD ALL" button at the bottom
        const bulkBtn = document.createElement('button');
        bulkBtn.className = 'bulk-download-btn';
        bulkBtn.innerHTML = `<i class="fa-solid fa-bolt"></i> BULK DOWNLOAD ALL (${episodes.length} Episodes)`;
        bulkBtn.addEventListener('click', () => {
            triggerBulkDownload(episodes);
        });
        panel.appendChild(bulkBtn);

        const msgWrapper = document.createElement('div');
        msgWrapper.className = 'message bot';
        msgWrapper.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content-wrapper">
                <div class="message-bubble" style="background: transparent; border: none; padding: 0;"></div>
            </div>
        `;
        msgWrapper.querySelector('.message-bubble').appendChild(panel);
        appendMessageElement(msgWrapper);
    }

    // Triggers resolution and browser download for a single file/episode
    async function triggerDirectDownload(label, vcloudUrl) {
        const resolvingBubble = addResolvingIndicator(`Bypassing redirects and shorteners for <b>${label}</b>...`);
        
        try {
            const res = await fetch(`/api/resolve?url=${encodeURIComponent(vcloudUrl)}`);
            const data = await res.json();
            
            if (data.status === 'success' && data.direct_url) {
                updateResolvingIndicator(resolvingBubble, `
                    <div class="success-bubble">
                        <i class="fa-solid fa-circle-check"></i> Bypass complete! Initiating high-speed browser download...
                    </div>
                `);
                
                // Trigger the browser level download
                triggerBrowserDownload(data.direct_url);
            } else {
                updateResolvingIndicator(resolvingBubble, `
                    <div class="error-bubble">
                        <i class="fa-solid fa-circle-exclamation"></i> Bypass failed. Redirect token was invalid or expired.
                    </div>
                `);
            }
        } catch (err) {
            updateResolvingIndicator(resolvingBubble, `
                <div class="error-bubble">
                    <i class="fa-solid fa-circle-exclamation"></i> Error resolving download link.
                </div>
            `);
        }
    }

    // Sequential queue-based bulk downloader to avoid browser popup blocks
    async function triggerBulkDownload(episodes) {
        addBotMessage(`🚀 Initiating bulk direct-download queue for <b>${episodes.length} episodes</b>. <br>Please allow multiple downloads in Chrome if prompted. Resolving episodes sequentially...`);
        
        for (let i = 0; i < episodes.length; i++) {
            const ep = episodes[i];
            const resolvingBubble = addResolvingIndicator(`Bypassing shortener for <b>Episode ${ep.episode}</b> (${i+1}/${episodes.length})...`);
            
            try {
                const res = await fetch(`/api/resolve?url=${encodeURIComponent(ep.vcloud_url)}`);
                const data = await res.json();
                
                if (data.status === 'success' && data.direct_url) {
                    updateResolvingIndicator(resolvingBubble, `
                        <div class="success-bubble">
                            <i class="fa-solid fa-circle-check"></i> Resolved Episode ${ep.episode}! Triggering browser download...
                        </div>
                    `);
                    
                    triggerBrowserDownload(data.direct_url);
                } else {
                    updateResolvingIndicator(resolvingBubble, `
                        <div class="error-bubble">
                            <i class="fa-solid fa-circle-exclamation"></i> Failed to bypass Episode ${ep.episode}. Skipping.
                        </div>
                    `);
                }
            } catch (err) {
                updateResolvingIndicator(resolvingBubble, `
                    <div class="error-bubble">
                        <i class="fa-solid fa-circle-exclamation"></i> Error resolving Episode ${ep.episode}. Skipping.
                    </div>
                `);
            }
            
            // Wait 1.5s between triggers to let Chrome register the download streams cleanly
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        addBotMessage("🏁 Bulk download resolution sequence completed! All working episodes have been handed over to your Chrome download manager.");
    }

    // Native trigger of browser-level file stream downloading
    function triggerBrowserDownload(directUrl) {
        // Method A: Set iframe target (extremely clean, no window popups)
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = directUrl;
        document.body.appendChild(iframe);
        
        // Cleanup the iframe element after trigger registered
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 15000);
    }

    // Helper: Add user speech bubble
    function addUserMessage(text) {
        const bubble = document.createElement('div');
        bubble.className = 'message user';
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        bubble.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-user"></i></div>
            <div class="message-content-wrapper">
                <div class="message-bubble">${text}</div>
                <span class="message-timestamp">${timestamp}</span>
            </div>
        `;
        
        appendMessageElement(bubble);
    }

    // Helper: Add Bot response bubble
    function addBotMessage(text) {
        const bubble = document.createElement('div');
        bubble.className = 'message bot';
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        bubble.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content-wrapper">
                <div class="message-bubble">${text}</div>
                <span class="message-timestamp">${timestamp}</span>
            </div>
        `;
        
        appendMessageElement(bubble);
    }

    // Helper: Show custom animated typing indicator
    function showTypingIndicator() {
        const bubble = document.createElement('div');
        bubble.className = 'message bot';
        bubble.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content-wrapper">
                <div class="message-bubble" style="padding: 10px 15px;">
                    <div class="typing-indicator">
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                    </div>
                </div>
            </div>
        `;
        appendMessageElement(bubble);
        return bubble;
    }

    // Helper: Remove typing indicator
    function removeTypingIndicator(indicatorBubble) {
        if (indicatorBubble && indicatorBubble.parentNode) {
            indicatorBubble.parentNode.removeChild(indicatorBubble);
        }
    }

    // Helper: Add loading indicator bubble while resolving URLs
    function addResolvingIndicator(initialText) {
        const bubble = document.createElement('div');
        bubble.className = 'message bot';
        bubble.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content-wrapper">
                <div class="message-bubble">
                    <div class="resolving-loader">
                        <div class="resolving-spinner"></div>
                        <span class="resolving-text">${initialText}</span>
                    </div>
                </div>
            </div>
        `;
        appendMessageElement(bubble);
        return bubble;
    }

    function updateResolvingIndicator(bubble, newHtml) {
        if (bubble) {
            const content = bubble.querySelector('.message-bubble');
            if (content) {
                content.innerHTML = newHtml;
            }
        }
    }

    async function loadRecentUploads() {
        const container = els.recentUpdatesList;
        if (!container) return;
        try {
            const res = await fetch('/api/recent');
            const data = await res.json();
            if (data.status === 'success' && data.results.length > 0) {
                container.innerHTML = '';
                data.results.forEach(item => {
                    const el = document.createElement('div');
                    el.className = 'recent-item';
                    const poster = item.thumbnail || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=100&auto=format&fit=crop';
                    let tag = (item.title.toLowerCase().includes('season') || item.title.toLowerCase().includes('episode') || item.title.toLowerCase().includes('series')) ? 'SERIES' : 'MOVIE';
                    el.innerHTML = `
                        <img class="recent-thumb" src="${poster}" alt="" onerror="this.src='https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=100&auto=format&fit=crop'">
                        <div class="recent-meta">
                            <span class="recent-tag">${tag}</span>
                            <span class="recent-title" title="${item.title}">${item.title}</span>
                        </div>
                    `;
                    el.addEventListener('click', () => {
                        closeSidebarOnMobile();
                        let searchWords = item.title.replace(/[\{\}\(\)\[\]\-]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 4).join(' ');
                        handleUserSearch(searchWords);
                    });
                    container.appendChild(el);
                });
            } else {
                container.innerHTML = `<div style="padding: 10px; font-size:12px; color:var(--text-secondary); text-align:center;">No recent uploads found</div>`;
            }
        } catch (err) {
            console.error("Error loading recent uploads:", err);
            container.innerHTML = `<div style="padding: 10px; font-size:12px; color:#ff6b6b; text-align:center;">Failed to load feed</div>`;
        }
    }

    function appendMessageElement(el) {
        els.messagesContainer.appendChild(el);
        // Instant auto-scroll to the bottom of the container
        els.messagesContainer.scrollTop = els.messagesContainer.scrollHeight;
    }

    // ==========================================================================
    // CATALOG TAB ROUTING & SEARCH HANDLERS
    // ==========================================================================

    // Tab switching controls
    if (els.chatFeatureBtn && els.catalogFeatureBtn) {
        els.chatFeatureBtn.addEventListener('click', () => {
            els.chatFeatureBtn.classList.add('active');
            els.catalogFeatureBtn.classList.remove('active');
            els.chatWrapper.style.display = 'flex';
            els.catalogWrapper.style.display = 'none';
            closeSidebarOnMobile();
        });

        els.catalogFeatureBtn.addEventListener('click', () => {
            els.catalogFeatureBtn.classList.add('active');
            els.chatFeatureBtn.classList.remove('active');
            els.catalogWrapper.style.display = 'flex';
            els.chatWrapper.style.display = 'none';
            closeSidebarOnMobile();
            
            // Populate catalog on first load
            if (catalogLoadedCount === 0) {
                loadCatalogRecent();
            }
        });
    }

    // Toggle sidebar overlay from catalog hamburger
    if (els.mobileCatalogSidebarToggle) {
        els.mobileCatalogSidebarToggle.addEventListener('click', () => {
            els.appContainer.classList.add('sidebar-open');
        });
    }

    // Modal Close event
    if (els.closeModalBtn && els.downloadModal) {
        els.closeModalBtn.addEventListener('click', () => {
            els.downloadModal.classList.remove('active');
        });
        
        // Close modal on overlay click
        els.downloadModal.addEventListener('click', (e) => {
            if (e.target === els.downloadModal) {
                els.downloadModal.classList.remove('active');
            }
        });
    }

    // Catalog Search Event listeners
    if (els.catalogSearchBtn && els.catalogSearchInput) {
        els.catalogSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && els.catalogSearchInput.value.trim() !== '') {
                handleCatalogSearch(els.catalogSearchInput.value.trim());
            }
        });

        els.catalogSearchBtn.addEventListener('click', () => {
            if (els.catalogSearchInput.value.trim() !== '') {
                handleCatalogSearch(els.catalogSearchInput.value.trim());
            }
        });
    }

    async function handleCatalogSearch(query, page = 1) {
        if (page === 1) {
            els.catalogGrid.innerHTML = `
                <div class="catalog-loading" style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 40px;">
                    <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 24px; margin-bottom: 10px; display: block; color: var(--accent-red);"></i>
                    Searching catalog for "${query}"...
                </div>
            `;
        } else {
            // Show inline loading at bottom
            const loadingEl = document.createElement('div');
            loadingEl.id = 'catalog-page-loading';
            loadingEl.style.cssText = 'grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:20px;';
            loadingEl.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin" style="color:var(--accent-red);"></i> Loading page ${page}...`;
            els.catalogGrid.appendChild(loadingEl);
        }

        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&page=${page}`);
            const data = await res.json();

            // Remove any loading placeholder
            const loadEl = document.getElementById('catalog-page-loading');
            if (loadEl) loadEl.remove();
            // Remove previous pagination bar
            const oldBar = document.getElementById('catalog-pagination-bar');
            if (oldBar) oldBar.remove();

            if (data.status === 'success' && data.results.length > 0) {
                renderCatalogGrid(data.results, page);
                // Add pagination bar
                const bar = document.createElement('div');
                bar.id = 'catalog-pagination-bar';
                bar.className = 'catalog-pagination-bar';
                const showNext = data.has_more || (page === 1 && data.results.length >= 5);
                if (showNext) {
                    bar.innerHTML = `
                        <span class="pagination-info">Page ${page} &middot; ${data.results.length} results</span>
                        <button class="catalog-next-btn pagination-next-btn">
                            <i class="fa-solid fa-angles-right"></i> Next Page
                        </button>
                    `;
                    // Use addEventListener — no fragile inline onclick strings
                    const catNextBtn = bar.querySelector('.catalog-next-btn');
                    catNextBtn.addEventListener('click', () => {
                        catNextBtn.disabled = true;
                        catNextBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
                        handleCatalogSearch(query, page + 1);
                    });
                } else {
                    bar.innerHTML = `<span class="pagination-info"><i class="fa-solid fa-check-circle"></i> All results shown</span>`;
                }
                els.catalogGrid.appendChild(bar);
            } else if (page === 1) {
                els.catalogGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; color: #ff6b6b; padding: 40px;">
                        <i class="fa-solid fa-face-frown" style="font-size: 36px; margin-bottom: 10px; display: block;"></i>
                        No search matches found for "${query}".
                    </div>
                `;
            }
        } catch (err) {
            const loadEl = document.getElementById('catalog-page-loading');
            if (loadEl) loadEl.remove();
            if (page === 1) {
                els.catalogGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; color: #ff6b6b; padding: 40px;">
                        <i class="fa-solid fa-circle-exclamation" style="font-size: 36px; margin-bottom: 10px; display: block;"></i>
                        Error connecting to backend.
                    </div>
                `;
            }
        }
    }

    async function loadCatalogRecent() {
        try {
            const res = await fetch('/api/recent');
            const data = await res.json();
            if (data.status === 'success' && data.results.length > 0) {
                renderCatalogGrid(data.results);
                catalogLoadedCount = data.results.length;
            } else {
                els.catalogGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 40px;">
                        No latest uploads available to display. Use search above.
                    </div>
                `;
            }
        } catch (err) {
            console.error("Error loading catalog uploads:", err);
            els.catalogGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: #ff6b6b; padding: 40px;">
                    Failed to retrieve latest catalog uploads feed.
                </div>
            `;
        }
    }

    function renderCatalogGrid(movies, page = 1) {
        if (page === 1) els.catalogGrid.innerHTML = '';

        movies.forEach(movie => {
            const card = document.createElement('div');
            card.className = 'catalog-card';
            
            const posterImg = movie.thumbnail || '/static/default-poster.jpg';
            const badgeClass = movie.site === 'vegamovies' ? 'site-badge vegamovies' : 'site-badge rogmovies';
            const badgeText = movie.site === 'vegamovies' ? 'VegaMovies' : 'RogMovies';

            // Classify title to determine if Movie or Series
            const isSeries = movie.title.toLowerCase().includes('season') || 
                             movie.title.toLowerCase().includes('episode') || 
                             movie.title.toLowerCase().includes('series') || 
                             movie.title.toLowerCase().includes('complete') ||
                             /s\d+/i.test(movie.title);
            const typeBadgeText = isSeries ? 'Series' : 'Movie';
            const typeBadgeClass = isSeries ? 'type-badge series' : 'type-badge movie';

            card.innerHTML = `
                <div class="catalog-poster">
                    <span class="${badgeClass}">${badgeText}</span>
                    <span class="${typeBadgeClass}">${typeBadgeText}</span>
                    <img src="${posterImg}" alt="${movie.title}" onerror="this.src='https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=300&auto=format&fit=crop'">
                </div>
                <div class="catalog-info">
                    <p class="catalog-title" title="${movie.title}">${movie.title}</p>
                    <button class="catalog-download-btn">
                        <i class="fa-solid fa-download"></i> Download Options
                    </button>
                </div>
            `;
            
            // Click card redirects to original URL
            card.addEventListener('click', (e) => {
                if (e.target.closest('.catalog-download-btn')) return;
                window.open(movie.url, '_blank');
            });
            
            // Click download button opens resolution choices modal
            const dlBtn = card.querySelector('.catalog-download-btn');
            dlBtn.addEventListener('click', () => {
                openDownloadModal(movie.title, movie.url);
            });
            
            els.catalogGrid.appendChild(card);
        });
    }

    // ==========================================================================
    // DETAIL MODAL & ONE-CLICK RESOLVER LOGIC
    // ==========================================================================

    async function openDownloadModal(title, postUrl) {
        els.modalMovieTitle.textContent = title;
        els.modalBodyContent.innerHTML = `
            <div class="modal-loading">
                <i class="fa-solid fa-circle-notch fa-spin"></i>
                <span>Extracting download packages from source post...</span>
            </div>
        `;
        els.downloadModal.classList.add('active');
        
        try {
            const res = await fetch(`/api/details?url=${encodeURIComponent(postUrl)}`);
            const data = await res.json();
            
            if (data.status === 'success' && data.packages.length > 0) {
                renderModalResolutions(data.packages, title);
            } else {
                els.modalBodyContent.innerHTML = `
                    <div style="text-align: center; color: #ff6b6b; padding: 30px;">
                        <i class="fa-solid fa-circle-xmark" style="font-size: 32px; margin-bottom: 12px; display: block; color: var(--accent-red);"></i>
                        Failed to retrieve download packages from this post.
                    </div>
                `;
            }
        } catch (err) {
            els.modalBodyContent.innerHTML = `
                <div style="text-align: center; color: #ff6b6b; padding: 30px;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size: 32px; margin-bottom: 12px; display: block; color: var(--accent-red);"></i>
                    Network error fetching package details from backend.
                </div>
            `;
        }
    }

    function renderModalResolutions(packages, title) {
        const listContainer = document.createElement('div');
        listContainer.className = 'resolution-packages-grid';
        listContainer.style.marginTop = '0';
        listContainer.style.maxWidth = '100%';
        
        packages.forEach(pkg => {
            const card = document.createElement('div');
            card.className = 'resolution-card';
            
            let badge = 'DL';
            if (pkg.label.includes('720p')) badge = '720p HD';
            else if (pkg.label.includes('1080p')) badge = '1080p FHD';
            else if (pkg.label.includes('480p')) badge = '480p SD';
            else if (pkg.label.includes('2160p') || pkg.label.includes('4K')) badge = '4K UHD';
            
            card.innerHTML = `
                <div class="res-meta">
                    <span class="res-title">${pkg.label}</span>
                    <span class="res-badge">${badge}</span>
                </div>
                <div class="res-download-btn"><i class="fa-solid fa-arrow-right"></i></div>
            `;
            
            card.addEventListener('click', () => {
                handleModalResolutionSelect(pkg.label, pkg.nexdrive_url, title);
            });
            
            listContainer.appendChild(card);
        });
        
        els.modalBodyContent.innerHTML = '';
        els.modalBodyContent.appendChild(listContainer);
    }

    async function handleModalResolutionSelect(label, nexdriveUrl, title) {
        els.modalBodyContent.innerHTML = `
            <div class="modal-loading">
                <i class="fa-solid fa-circle-notch fa-spin"></i>
                <span>Loading available episodes or file options...</span>
            </div>
        `;
        
        try {
            const res = await fetch(`/api/episodes?url=${encodeURIComponent(nexdriveUrl)}`);
            const responseData = await res.json();
            
            if (responseData.status === 'success' && responseData.data.items && responseData.data.items.length > 0) {
                const mediaData = responseData.data;
                if (mediaData.type === 'series') {
                    renderModalEpisodes(mediaData.items, label);
                } else if (mediaData.type === 'batch') {
                    renderModalBatch(mediaData.items, label);
                } else {
                    renderModalMoviePackage(mediaData.items, label);
                }
            } else {
                els.modalBodyContent.innerHTML = `
                    <div style="text-align: center; color: #ff6b6b; padding: 30px;">
                        Failed to resolve final download options.
                    </div>
                `;
            }
        } catch (err) {
            els.modalBodyContent.innerHTML = `
                <div style="text-align: center; color: #ff6b6b; padding: 30px;">
                    Network error fetching item links.
                </div>
            `;
        }
    }

    function renderModalEpisodes(episodes, qualityLabel) {
        const container = document.createElement('div');
        container.className = 'episodes-panel';
        container.style.marginTop = '0';
        container.style.padding = '0';
        container.style.background = 'transparent';
        container.style.border = 'none';
        
        const header = document.createElement('div');
        header.className = 'episodes-header';
        header.innerHTML = `
            <h4 style="font-size: 14px; margin-bottom: 0;">Select Episode (${qualityLabel})</h4>
            <span class="episodes-header-badge">${episodes.length} Episodes</span>
        `;
        container.appendChild(header);
        
        const grid = document.createElement('div');
        grid.className = 'episodes-grid';
        
        episodes.forEach(ep => {
            const btn = document.createElement('button');
            btn.className = 'episode-btn';
            btn.innerHTML = `<i class="fa-solid fa-tv"></i><span>Ep ${ep.episode}</span>`;
            btn.addEventListener('click', () => {
                triggerModalDirectDownload(`Episode ${ep.episode}`, ep.vcloud_url, btn);
            });
            grid.appendChild(btn);
        });
        container.appendChild(grid);
        
        const bulkBtn = document.createElement('button');
        bulkBtn.className = 'bulk-download-btn';
        bulkBtn.innerHTML = `<i class="fa-solid fa-bolt"></i> BULK DOWNLOAD ALL (${episodes.length} Episodes)`;
        bulkBtn.addEventListener('click', () => {
            triggerModalBulkDownload(episodes, bulkBtn);
        });
        container.appendChild(bulkBtn);
        
        els.modalBodyContent.innerHTML = '';
        els.modalBodyContent.appendChild(container);
    }

    function renderModalBatch(items, qualityLabel) {
        const container = document.createElement('div');
        container.className = 'batch-package-card';
        container.style.marginTop = '0';
        container.style.background = 'rgba(255, 255, 255, 0.02)';
        
        container.innerHTML = `
            <div class="batch-header">
                <div class="batch-icon-box"><i class="fa-solid fa-file-zipper"></i></div>
                <div class="batch-meta">
                    <span class="batch-title">${qualityLabel}</span>
                    <span class="batch-desc">Full compressed batch ZIP package</span>
                </div>
            </div>
            <div class="batch-actions" id="modal-batch-actions" style="margin-top: 15px;"></div>
        `;
        
        const actions = container.querySelector('#modal-batch-actions');
        items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'batch-btn batch-btn-primary';
            btn.style.width = '100%';
            btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> Download ZIP: ${item.title}`;
            btn.addEventListener('click', () => {
                triggerModalDirectDownload(item.title, item.vcloud_url, btn);
            });
            actions.appendChild(btn);
        });
        
        els.modalBodyContent.innerHTML = '';
        els.modalBodyContent.appendChild(container);
    }

    function renderModalMoviePackage(items, qualityLabel) {
        const container = document.createElement('div');
        container.className = 'movie-package-card';
        container.style.marginTop = '0';
        container.style.background = 'rgba(255, 255, 255, 0.02)';
        
        container.innerHTML = `
            <div class="movie-package-header">
                <div class="movie-package-icon"><i class="fa-solid fa-film"></i></div>
                <div class="movie-package-details">
                    <h3>${qualityLabel}</h3>
                    <p>High-speed direct movie package download</p>
                </div>
            </div>
            <div class="movie-download-actions" id="modal-movie-actions" style="margin-top: 15px;"></div>
        `;
        
        const actions = container.querySelector('#modal-movie-actions');
        items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'movie-btn movie-btn-primary';
            btn.style.width = '100%';
            btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> Download Movie: ${item.title}`;
            btn.addEventListener('click', () => {
                triggerModalDirectDownload(item.title, item.vcloud_url, btn);
            });
            actions.appendChild(btn);
        });
        
        els.modalBodyContent.innerHTML = '';
        els.modalBodyContent.appendChild(container);
    }

    async function triggerModalDirectDownload(label, vcloudUrl, buttonEl) {
        const originalHtml = buttonEl.innerHTML;
        buttonEl.disabled = true;
        buttonEl.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Bypassing...`;
        
        try {
            const res = await fetch(`/api/resolve?url=${encodeURIComponent(vcloudUrl)}`);
            const data = await res.json();
            
            if (data.status === 'success' && data.direct_url) {
                buttonEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Handed to Chrome!`;
                buttonEl.style.background = '#46d369';
                triggerBrowserDownload(data.direct_url);
                setTimeout(() => {
                    buttonEl.innerHTML = originalHtml;
                    buttonEl.disabled = false;
                    buttonEl.style.background = '';
                }, 3000);
            } else {
                buttonEl.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Bypass Failed`;
                buttonEl.style.background = '#e50914';
                setTimeout(() => {
                    buttonEl.innerHTML = originalHtml;
                    buttonEl.disabled = false;
                    buttonEl.style.background = '';
                }, 3000);
            }
        } catch (err) {
            buttonEl.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Connection Error`;
            buttonEl.style.background = '#e50914';
            setTimeout(() => {
                buttonEl.innerHTML = originalHtml;
                buttonEl.disabled = false;
                buttonEl.style.background = '';
            }, 3000);
        }
    }

    async function triggerModalBulkDownload(episodes, bulkBtn) {
        const originalHtml = bulkBtn.innerHTML;
        bulkBtn.disabled = true;
        
        let resolvedCount = 0;
        for (let i = 0; i < episodes.length; i++) {
            const ep = episodes[i];
            bulkBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Resolving Ep ${ep.episode} (${i+1}/${episodes.length})...`;
            
            try {
                const res = await fetch(`/api/resolve?url=${encodeURIComponent(ep.vcloud_url)}`);
                const data = await res.json();
                if (data.status === 'success' && data.direct_url) {
                    triggerBrowserDownload(data.direct_url);
                    resolvedCount++;
                }
            } catch (err) {
                console.error(`Error resolving ep ${ep.episode}:`, err);
            }
            await new Promise(r => setTimeout(r, 1500));
        }
        
        bulkBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Triggered ${resolvedCount}/${episodes.length} downloads!`;
        bulkBtn.style.background = '#46d369';
        setTimeout(() => {
            bulkBtn.innerHTML = originalHtml;
            bulkBtn.disabled = false;
            bulkBtn.style.background = '';
        }, 4000);
    }
});

