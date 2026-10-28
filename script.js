/* Clear the inline styles used when a tile is pulled out of the flow */
function resetInline(el) {
    ['position', 'top', 'left', 'width', 'height', 'boxSizing', 'margin', 'zIndex'].forEach(function (p) {
        el.style[p] = '';
    });
}

function getAllAnimatable() {
    return Array.prototype.slice.call(document.querySelectorAll('.tetromino .home-tile'));
}

function getVisibleSet(view) {
    var reelAnimate = document.getElementById('reel-animate');
    var reelVfx = document.getElementById('reel-vfx');
    var animationTiles = Array.prototype.slice.call(document.querySelectorAll('.category-animation'));
    var effectsTiles = Array.prototype.slice.call(document.querySelectorAll('.category-effects'));
    var miscTiles = Array.prototype.slice.call(document.querySelectorAll('.category-misc'));
    var set = new Set();

    if (view === 'animate') {
        set.add(reelAnimate);
        animationTiles.forEach(function (el) { set.add(el); });
    } else if (view === 'vfx') {
        set.add(reelVfx);
        effectsTiles.forEach(function (el) { set.add(el); });
    } else if (view === 'misc') {
        miscTiles.forEach(function (el) { set.add(el); });
    } else {
        set.add(reelAnimate);
        set.add(reelVfx);
        animationTiles.forEach(function (el) { set.add(el); });
        effectsTiles.forEach(function (el) { set.add(el); });
        miscTiles.forEach(function (el) { set.add(el); });
    }
    return set;
}

function filterWork(view) {
    var tiles = getAllAnimatable();
    var showSet = getVisibleSet(view);

    // FIRST: record current positions of tiles that are currently visible
    var first = new Map();
    tiles.forEach(function (el) {
        if (el.style.display !== 'none') {
            first.set(el, el.getBoundingClientRect());
        }
    });

    // Apply visibility changes synchronously so layout reflows immediately:
    // - newly-shown tiles join the flow now
    // - outgoing tiles are pulled OUT of the flow now (fixed in place at their old
    //   spot) so siblings reflow instantly, while the tile itself fades in place
    tiles.forEach(function (el) {
        var shouldShow = showSet.has(el);
        var wasVisible = first.has(el);

        if (shouldShow) {
            resetInline(el);
            el.style.display = '';
        } else if (wasVisible) {
            var r = first.get(el);
            el.style.position = 'fixed';
            el.style.boxSizing = 'border-box';
            el.style.left = r.left + 'px';
            el.style.top = r.top + 'px';
            el.style.width = r.width + 'px';
            el.style.height = r.height + 'px';
            el.style.zIndex = '5';
        } else {
            el.style.display = 'none';
        }
    });

    // Misc. has no demo reel, so close up the empty reel row's gap
    var anyReel = tiles.some(function (el) {
        return el.classList.contains('reel-tile') && showSet.has(el);
    });
    document.querySelector('.reel-row').classList.toggle('no-reels', !anyReel);

    // LAST: record new positions now that layout has updated
    var last = new Map();
    tiles.forEach(function (el) {
        if (showSet.has(el)) {
            last.set(el, el.getBoundingClientRect());
        }
    });

    tiles.forEach(function (el) {
        var wasVisible = first.has(el);
        var willShow = showSet.has(el);

        if (wasVisible && willShow) {
            // INVERT + PLAY: slide smoothly from old position to new one
            var f = first.get(el), l = last.get(el);
            var dx = f.left - l.left;
            var dy = f.top - l.top;

            el.classList.remove('js-fade-out');
            if (dx || dy) {
                el.style.transition = 'none';
                el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
                void el.offsetWidth; // force reflow
                el.style.transition = '';
                el.style.transform = '';
            }
        } else if (!wasVisible && willShow) {
            // fade a newly-appearing tile in at its resting position
            el.classList.add('js-fade-out');
            void el.offsetWidth;
            el.classList.remove('js-fade-out');
        } else if (wasVisible && !willShow) {
            // fade the outgoing tile out in place, then fully unmount it
            el.classList.add('js-fade-out');
            setTimeout(function () {
                if (el.classList.contains('js-fade-out')) {
                    el.style.display = 'none';
                    resetInline(el);
                }
            }, 400);
        }
    });
    syncReelTileWidth();
}

function fadeSwapSection(hideEl, showEl, callback) {
    if (hideEl && hideEl.style.display !== 'none') {
        hideEl.classList.add('js-fade-out');
        setTimeout(function () {
            hideEl.style.display = 'none';
            hideEl.classList.remove('js-fade-out');
            if (showEl) {
                showEl.style.display = '';
                void showEl.offsetWidth;
            }
            if (callback) callback();
        }, 400);
    } else if (showEl) {
        showEl.style.display = '';
        void showEl.offsetWidth;
        if (callback) callback();
    }
}

function navigateTo(view) {
    closeDetailImmediate();

    var work = document.getElementById('work');
    var info = document.getElementById('info-page');

    if (view === 'info') {
        fadeSwapSection(work, info);
    } else if (info.style.display !== 'none') {
        fadeSwapSection(info, work, function () { filterWork(view); });
    } else {
        filterWork(view);
    }
}

document.querySelectorAll('.nav a[data-filter]').forEach(function (link) {
    link.addEventListener('click', function (e) {
        e.preventDefault();
        navigateTo(link.dataset.filter);
    });
});

/* PROJECT + REEL DETAIL EXPAND/COLLAPSE */
var selectedTile = null;
var selectedIsReel = false;
var scrollAnimId = null;
var openToken = 0;

/* SYNCED SCROLL — glides the page so the expanded window ends up centered
   (slightly above true center), running alongside the grow animation. */
var SCROLL_EASE = [0.45, 0, 0.2, 1]; // same curve as the tile expansion in CSS/JS

function cubicBezierEase(x1, y1, x2, y2) {
    function bez(t, a, b) {
        var u = 1 - t;
        return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
    }
    return function (x) {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        var lo = 0, hi = 1, t = x;
        for (var i = 0; i < 24; i++) {
            t = (lo + hi) / 2;
            if (bez(t, x1, x2) < x) lo = t; else hi = t;
        }
        return bez(t, y1, y2);
    };
}
var scrollEase = cubicBezierEase(SCROLL_EASE[0], SCROLL_EASE[1], SCROLL_EASE[2], SCROLL_EASE[3]);

function cancelScrollAnim() {
    if (scrollAnimId !== null) {
        cancelAnimationFrame(scrollAnimId);
        scrollAnimId = null;
    }
}

function scrollDetailIntoView(detail, duration) {
    cancelScrollAnim();

    var rect = detail.getBoundingClientRect();
    var viewH = window.innerHeight;
    var startY = window.pageYOffset;
    var detailTop = rect.top + startY;

    // Center the window, then nudge it up a bit (about 6% of the screen height)
    var targetY = detailTop + rect.height / 2 - viewH / 2 - viewH * 0.06;

    // If the window is taller than the screen, keep its top edge visible instead
    if (rect.height > viewH - 40) targetY = detailTop - 20;

    var maxY = document.documentElement.scrollHeight - viewH;
    targetY = Math.max(0, Math.min(targetY, maxY));

    var distance = targetY - startY;
    if (Math.abs(distance) < 2) return;

    var startTime = null;

    function step(now) {
        if (startTime === null) startTime = now;
        var p = Math.min((now - startTime) / duration, 1);
        window.scrollTo({ top: startY + distance * scrollEase(p), left: 0, behavior: 'instant' });
        if (p < 1) {
            scrollAnimId = requestAnimationFrame(step);
        } else {
            scrollAnimId = null;
        }
    }
    scrollAnimId = requestAnimationFrame(step);
}

// If the person scrolls or taps during the glide, let them take over
['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (evt) {
    window.addEventListener(evt, cancelScrollAnim, { passive: true });
});

function getProjectTiles() {
    return Array.prototype.slice.call(document.querySelectorAll('.project-row .home-tile'));
}

function getReelTiles() {
    return Array.prototype.slice.call(document.querySelectorAll('.reel-row .home-tile'));
}

function flipElements(elements, mutate) {
    var first = new Map();
    elements.forEach(function (t) { first.set(t, t.getBoundingClientRect()); });

    mutate();

    var last = new Map();
    elements.forEach(function (t) { last.set(t, t.getBoundingClientRect()); });

    elements.forEach(function (t) {
        var f = first.get(t), l = last.get(t);
        if (!f || !l) return;
        var dx = f.left - l.left, dy = f.top - l.top;
        if (dx || dy) {
            t.style.transition = 'none';
            t.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
            void t.offsetWidth;
            t.style.transition = '';
            t.style.transform = '';
        }
    });
}

function pullOutAndFade(el) {
    var r = el.getBoundingClientRect();
    el.style.position = 'fixed';
    el.style.boxSizing = 'border-box';
    el.style.left = r.left + 'px';
    el.style.top = r.top + 'px';
    el.style.width = r.width + 'px';
    el.style.height = r.height + 'px';
    el.style.margin = '0';
    el.style.zIndex = '5';
    el.classList.add('js-fade-out');
    setTimeout(function () {
        if (el.classList.contains('js-fade-out')) {
            el.style.display = 'none';
            resetInline(el);
        }
    }, 400);
}

function settleIn(el) {
    el.classList.add('js-fade-out');
    el.style.display = '';
    void el.offsetWidth;
    el.classList.remove('js-fade-out');
}

/* Ghost copy of the expanded window (used to shrink it back to its tile) */
function makeDetailGhost(detail, dRect, pinToViewport) {
    if (!dRect || !dRect.width) return null;
    var ghost = detail.cloneNode(true);
    ghost.removeAttribute('id');
    Array.prototype.forEach.call(ghost.querySelectorAll('[id]'), function (n) { n.removeAttribute('id'); });
    Array.prototype.forEach.call(ghost.querySelectorAll('iframe'), function (f) {
        f.parentNode.removeChild(f);
    });
    var ghostClose = ghost.querySelector('.detail-close');
    if (ghostClose) ghostClose.parentNode.removeChild(ghostClose);
    Array.prototype.forEach.call(ghost.querySelectorAll('.slide-nav, .slide-counter'), function (n) {
        n.parentNode.removeChild(n);
    });
    // Make sure the shrinking copy shows the slide that is on screen right now
    var ghostImg = ghost.querySelector('img');
    var liveImg = document.getElementById('detail-img');
    if (ghostImg && liveImg && liveImg.getAttribute('src')) ghostImg.setAttribute('src', liveImg.getAttribute('src'));
    ghost.classList.remove('js-fade-out');
    ghost.style.display = '';
    if (pinToViewport) {
        // Stays put on screen even if the page height changes underneath it
        ghost.style.position = 'fixed';
        ghost.style.left = dRect.left + 'px';
        ghost.style.top = dRect.top + 'px';
    } else {
        ghost.style.position = 'absolute';
        ghost.style.left = (dRect.left + window.pageXOffset) + 'px';
        ghost.style.top = (dRect.top + window.pageYOffset) + 'px';
    }
    ghost.style.width = dRect.width + 'px';
    ghost.style.margin = '0';
    ghost.style.zIndex = '50';
    ghost.style.pointerEvents = 'none';
    ghost.style.transformOrigin = 'top left';
    ghost.style.transition = 'none';
    ghost.style.opacity = '1';
    document.body.appendChild(ghost);
    return ghost;
}

/* Copies of the close + slideshow buttons that ride along on the growing ghost, so they are
   there as the window opens instead of waiting for the real window to fade in underneath */
function addGhostControls(ghost) {
    var added = [];
    ['detail-close-btn', 'slide-prev', 'slide-next', 'slide-counter'].forEach(function (id) {
        var src = document.getElementById(id);
        if (!src || src.style.display === 'none') return;
        var c = src.cloneNode(true);
        c.removeAttribute('id');
        c.style.opacity = '0';
        c.style.pointerEvents = 'none';
        ghost.appendChild(c);
        added.push(c);
    });
    return added;
}

/* Shrink + fade a detail ghost toward a tile's current spot */
function shrinkGhostToTile(ghost, dRect, tile) {
    if (!ghost) return;
    var tRect = tile.getBoundingClientRect();
    var scale = tRect.width / dRect.width;
    var dx = tRect.left - dRect.left;
    var dy = tRect.top - dRect.top;
    void ghost.offsetWidth;
    ghost.style.transition = 'transform 0.6s cubic-bezier(0.45, 0, 0.2, 1), opacity 0.5s ease 0.1s';
    ghost.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + scale + ')';
    ghost.style.opacity = '0';
    setTimeout(function () {
        if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    }, 700);
}

function stopDetailVideo() {
    clearTrailer();
    var detailVideo = document.getElementById('detail-video');
    var videoSlot = document.getElementById('detail-video-slot');
    detailVideo.src = '';
    detailVideo.style.display = 'none';
    videoSlot.style.display = 'none';
}

/* SLIDESHOW for multi-image projects (data-images="a.jpg|b.jpg|c.jpg" on a project tile) */
var slideImages = [];
var slideIndex = 0;

var slideAnim = null; // the in-flight slide transition, if any

function finishSlideAnim() {
    if (slideAnim) slideAnim();
}

/* dir: 1 = next (new image enters from the right), -1 = previous (enters from the left).
   Leave dir out to swap instantly with no animation. */
function showSlide(i, dir) {
    if (!slideImages.length) return;
    finishSlideAnim(); // snap any transition still running so quick taps stay in sync

    slideIndex = (i + slideImages.length) % slideImages.length;
    document.getElementById('slide-counter').textContent = (slideIndex + 1) + ' / ' + slideImages.length;

    var src = slideImages[slideIndex];
    var current = document.getElementById('detail-img');
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!dir || reduceMotion || !current.getAttribute('src')) {
        current.src = src;
        return;
    }

    // The incoming image waits just off to one side, then both images slide across together
    var box = current.parentNode;
    var incoming = current.cloneNode(false);
    incoming.removeAttribute('id');
    incoming.style.cssText = 'position:absolute;top:0;left:0;transition:none;transform:translateX(' + (dir * 100) + '%);';
    incoming.src = src;
    box.insertBefore(incoming, current.nextSibling);

    var done = false, timer = null;

    function finish() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        slideAnim = null;
        // Hand the "main image" role to the incoming image (no src swap, so no flicker)
        if (current.parentNode) current.parentNode.removeChild(current);
        incoming.id = 'detail-img';
        incoming.style.cssText = '';
    }
    slideAnim = finish;

    function run() {
        if (done) return;
        var move = 'transform 0.45s cubic-bezier(0.45, 0, 0.2, 1)';
        current.style.transition = move;
        incoming.style.transition = move;
        void incoming.offsetWidth;
        current.style.transform = 'translateX(' + (-dir * 100) + '%)';
        incoming.style.transform = 'translateX(0)';
        timer = setTimeout(finish, 480);
    }

    // Wait until the new image is decoded so it never slides in blank
    if (incoming.decode) incoming.decode().then(run, run); else run();
}

/* Remember the slide being viewed when a project closes, and make the tile's thumbnail match it,
   so the shrinking window lands on an identical image (and reopening resumes there) */
function rememberSlide(tile) {
    finishSlideAnim();
    if (!tile || tile.classList.contains('reel-tile') || slideImages.length < 2) return;
    tile._slideIndex = slideIndex;
    var thumb = tile.querySelector('img');
    if (thumb) thumb.src = slideImages[slideIndex];
}

function setupSlides(images, start) {
    finishSlideAnim();
    slideImages = images;
    slideIndex = 0;
    var multi = images.length > 1;
    ['slide-prev', 'slide-next', 'slide-counter'].forEach(function (id) {
        document.getElementById(id).style.display = multi ? '' : 'none';
    });
    if (multi) {
        showSlide(start || 0);
        // warm the cache so flipping through is instant
        images.slice(1).forEach(function (src) { new Image().src = src; });
    }
}

function slideshowActive() {
    return selectedTile && !selectedIsReel && slideImages.length > 1;
}

document.getElementById('slide-prev').addEventListener('click', function (e) {
    e.stopPropagation();
    showSlide(slideIndex - 1, -1);
});
document.getElementById('slide-next').addEventListener('click', function (e) {
    e.stopPropagation();
    showSlide(slideIndex + 1, 1);
});

document.addEventListener('keydown', function (e) {
    if (!slideshowActive()) return;
    if (e.key === 'ArrowLeft') showSlide(slideIndex - 1, -1);
    if (e.key === 'ArrowRight') showSlide(slideIndex + 1, 1);
});

/* Swipe support (phones/tablets): swipe left = next, swipe right = previous */
(function () {
    var area = document.querySelector('.detail-image');
    var startX = 0, startY = 0, tracking = false;

    area.addEventListener('touchstart', function (e) {
        if (!slideshowActive() || e.touches.length !== 1) { tracking = false; return; }
        tracking = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });

    area.addEventListener('touchend', function (e) {
        if (!tracking) return;
        tracking = false;
        var t = e.changedTouches[0];
        var dx = t.clientX - startX;
        var dy = t.clientY - startY;
        // Needs to be a clear, mostly-horizontal swipe so normal scrolling isn't hijacked
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        if (dx < 0) showSlide(slideIndex + 1, 1); else showSlide(slideIndex - 1, -1);
    }, { passive: true });

    area.addEventListener('touchcancel', function () { tracking = false; }, { passive: true });
})();

/* EXPANDED VIEW EXTRAS — role, programs used (hover an icon to see its name), project trailer.
   Each is optional and comes from the tile's data attributes:
     data-role="Creative Lead|Environment Design"            (lines separated by |)
     data-programs="Maya|images/icons/maya.png; Reaper|images/icons/reaper.png"   (name|icon, separated by ;)
     data-trailer="https://player.vimeo.com/video/XXXXXXX"   */
function clearTrailer() {
    var frame = document.getElementById('detail-trailer-frame');
    if (frame) frame.src = '';
}

var programNameTimer = null;
function showProgramName(name) {
    var el = document.getElementById('program-name');
    clearTimeout(programNameTimer);
    el.textContent = name;
    el.classList.add('is-visible');
}
function hideProgramName() {
    var el = document.getElementById('program-name');
    if (el) el.classList.remove('is-visible');
}

function fillDetailExtras(tile) {
    var needed = ['detail-columns', 'detail-role', 'detail-role-lines', 'detail-programs',
                  'program-icons', 'program-name', 'detail-trailer', 'detail-trailer-frame'];
    for (var n = 0; n < needed.length; n++) {
        if (!document.getElementById(needed[n])) return; // older index.html: skip extras, keep the rest working
    }
    var cols = document.getElementById('detail-columns');
    var roleBox = document.getElementById('detail-role');
    var roleLines = document.getElementById('detail-role-lines');
    var progBox = document.getElementById('detail-programs');
    var iconsBox = document.getElementById('program-icons');
    var trailerBox = document.getElementById('detail-trailer');
    var trailerFrame = document.getElementById('detail-trailer-frame');

    roleBox.style.display = 'none';
    progBox.style.display = 'none';
    trailerBox.style.display = 'none';
    roleLines.innerHTML = '';
    iconsBox.innerHTML = '';
    hideProgramName();
    document.getElementById('program-name').textContent = '';
    trailerFrame.src = '';

    var roles = [], programs = [], trailer = '';
    if (tile) {
        roles = (tile.dataset.role || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
        programs = (tile.dataset.programs || '').split(';').map(function (s) {
            var parts = s.split('|');
            return { name: (parts[0] || '').trim(), icon: (parts[1] || '').trim() };
        }).filter(function (p) { return p.name; });
        trailer = (tile.dataset.trailer || '').trim();
    }

    if (roles.length) {
        roles.forEach(function (r) {
            var d = document.createElement('div');
            d.textContent = r;
            roleLines.appendChild(d);
        });
        roleBox.style.display = '';
    }

    if (programs.length) {
        programs.forEach(function (p) {
            var icon = document.createElement('span');
            icon.className = 'program-icon';
            icon.tabIndex = 0;
            icon.setAttribute('aria-label', p.name);
            function fallback() {
                icon.innerHTML = '';
                var f = document.createElement('span');
                f.className = 'icon-fallback';
                f.textContent = p.name.slice(0, 2);
                icon.appendChild(f);
            }
            if (p.icon) {
                var img = document.createElement('img');
                img.alt = p.name;
                img.draggable = false;
                img.addEventListener('error', fallback);
                img.src = p.icon;
                icon.appendChild(img);
            } else {
                fallback();
            }
            icon.addEventListener('mouseenter', function () { showProgramName(p.name); });
            icon.addEventListener('mouseleave', hideProgramName);
            icon.addEventListener('focus', function () { showProgramName(p.name); });
            icon.addEventListener('blur', hideProgramName);
            iconsBox.appendChild(icon);
        });
        progBox.style.display = '';
    }

    if (trailer) {
        trailerFrame.src = trailer;
        trailerBox.style.display = '';
    }

    var any = roles.length || programs.length || trailer;
    cols.style.display = any ? '' : 'none';
    cols.classList.toggle('no-trailer', !trailer);
    // With no role/programs, let the trailer sit centered on its own
    cols.classList.toggle('trailer-only', !!trailer && !roles.length && !programs.length);
}

function openDetail(tile) {
    if (selectedTile === tile) return;

    var detail = document.getElementById('project-detail');

    // If another project is already open, it will shrink back to its own tile
    // while the clicked tile grows into the expanded window (a swap)
    var prevTile = selectedTile;
    var prevGhost = null;
    var prevRect = null;
    if (prevTile) {
        cancelScrollAnim();
        rememberSlide(prevTile);
        prevRect = detail.getBoundingClientRect();
        prevGhost = makeDetailGhost(detail, prevRect);
        stopDetailVideo();
    }

    var isReel = tile.classList.contains('reel-tile');
    selectedTile = tile;
    selectedIsReel = isReel;

    var detailImg = document.getElementById('detail-img');
    var detailVideo = document.getElementById('detail-video');
    var videoSlot = document.getElementById('detail-video-slot');
    var playBtn = document.getElementById('detail-play-btn');

    if (isReel) {
        setupSlides([]);
        var label = tile.querySelector('.reel-label');
        detailImg.style.display = 'none';
        detailImg.src = '';
        detailVideo.style.display = 'none';
        detailVideo.src = '';
        playBtn.dataset.embedSrc = tile.dataset.embedSrc || '';
        videoSlot.style.backgroundImage = tile.dataset.thumb ? 'url("' + tile.dataset.thumb + '")' : '';
        videoSlot.style.display = 'flex';
        document.getElementById('detail-title').textContent = label ? label.textContent : 'Reel';
        document.getElementById('detail-description').textContent =
            'Add more information about this reel here.';
        fillDetailExtras(null);
    } else {
        var img = tile.querySelector('img');
        var titleEl = tile.querySelector('h3');
        detailVideo.style.display = 'none';
        detailVideo.src = '';
        videoSlot.style.display = 'none';
        if (tile.dataset.video) {
            // Video project: the expanded view shows the thumbnail with a play button,
            // and the Vimeo embed loads when it is clicked (same as the reels)
            setupSlides([]);
            detailImg.style.display = 'none';
            detailImg.src = '';
            playBtn.dataset.embedSrc = tile.dataset.video;
            var cover = tile.dataset.videoThumb || (img ? img.src : '');
            videoSlot.style.backgroundImage = cover ? 'url("' + cover + '")' : '';
            videoSlot.style.display = 'flex';
        } else {
            var list = tile.dataset.images
                ? tile.dataset.images.split('|').map(function (s) { return s.trim(); }).filter(Boolean)
                : [];
            if (!list.length && img) list = [img.src];
            var start = tile._slideIndex || 0;
            setupSlides(list, start);
            detailImg.src = list[start] || list[0] || '';
            detailImg.style.display = '';
        }
        document.getElementById('detail-title').textContent = titleEl ? titleEl.textContent : 'Project Title';
        document.getElementById('detail-description').textContent = tile.dataset.description ||
            'Add more information about this project here \u2014 process, tools used, and outcome.';
        fillDetailExtras(tile);
    }

    // Ghost copy of the tile that will grow into the expanded window
    var startRect = tile.getBoundingClientRect();
    var ghost = tile.cloneNode(true);
    ghost.removeAttribute('id');
    Array.prototype.forEach.call(ghost.querySelectorAll('[id]'), function (n) { n.removeAttribute('id'); });
    Array.prototype.forEach.call(ghost.querySelectorAll('.project-overlay, .reel-label'), function (n) {
        n.parentNode.removeChild(n);
    });
    ghost.classList.remove('js-fade-out');
    ghost.style.display = '';
    ghost.style.position = 'absolute';
    ghost.style.boxSizing = 'border-box';
    ghost.style.margin = '0';
    ghost.style.left = (startRect.left + window.pageXOffset) + 'px';
    ghost.style.top = (startRect.top + window.pageYOffset) + 'px';
    ghost.style.width = startRect.width + 'px';
    ghost.style.height = startRect.height + 'px';
    ghost.style.zIndex = '50';
    ghost.style.pointerEvents = 'none';
    ghost.style.transition = 'none';
    ghost.style.opacity = '1';
    document.body.appendChild(ghost);
    var ghostControls = addGhostControls(ghost);

    // Tiles that just need to glide to their new positions
    var siblings = getProjectTiles().concat(getReelTiles()).filter(function (t) {
        return t !== tile && t !== prevTile && t.style.display !== 'none';
    });

    flipElements(siblings, function () {
        // Pull the clicked tile out first, while it is still where the user clicked
        pullOutAndFade(tile);

        // Put the previously open tile back in the grid (invisible until its ghost arrives)
        if (prevTile) {
            prevTile.classList.add('js-fade-out');
            resetInline(prevTile);
            prevTile.style.display = '';
        }

        // Real detail window holds its place in the layout but stays invisible
        // until the growing ghost lands
        detail.style.transition = 'none';
        detail.classList.add('js-fade-out');
        detail.style.display = '';
        void detail.offsetWidth;
        detail.style.transition = '';
    });

    syncReelTileWidth();

    // Old expanded window shrinks back to its tile
    if (prevTile) {
        shrinkGhostToTile(prevGhost, prevRect, prevTile);
        void prevTile.offsetWidth;
        prevTile.classList.remove('js-fade-out');
    }

    // New tile grows into the expanded image area
    var endRect = detail.querySelector('.detail-image').getBoundingClientRect();
    void ghost.offsetWidth;
    ghost.style.transition = 'left 0.6s cubic-bezier(0.45, 0, 0.2, 1), top 0.6s cubic-bezier(0.45, 0, 0.2, 1), width 0.6s cubic-bezier(0.45, 0, 0.2, 1), height 0.6s cubic-bezier(0.45, 0, 0.2, 1)';
    ghost.style.left = (endRect.left + window.pageXOffset) + 'px';
    ghost.style.top = (endRect.top + window.pageYOffset) + 'px';
    ghost.style.width = endRect.width + 'px';
    ghost.style.height = endRect.height + 'px';
    ghostControls.forEach(function (c) {
        c.style.transition = 'opacity 0.35s ease 0.15s';
        c.style.opacity = '1';
    });

    // Once the ghost has landed, fade the real window in underneath it,
    // then remove the ghost when the real one is fully visible
    var myToken = ++openToken;
    setTimeout(function () {
        if (myToken === openToken && selectedTile === tile) {
            detail.classList.remove('js-fade-out');
        }
    }, 600);
    setTimeout(function () {
        if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    }, 1050);

    // Scroll at the same time as the expansion, using the same duration and
    // easing, so the page glides up while the tile grows
    scrollDetailIntoView(detail, 600);
}

function closeDetailImmediate() {
    if (!selectedTile) return;
    cancelScrollAnim();
    var tile = selectedTile;
    selectedTile = null;
    selectedIsReel = false;
    rememberSlide(tile);

    var detail = document.getElementById('project-detail');
    var detailVideo = document.getElementById('detail-video');
    var videoSlot = document.getElementById('detail-video-slot');

    detailVideo.src = '';
    detailVideo.style.display = 'none';
    videoSlot.style.display = 'none';
    clearTrailer();

    var siblings = getProjectTiles().filter(function (t) {
        return t !== tile && t.style.display !== 'none';
    });

    flipElements(siblings, function () {
        detail.style.display = 'none';
        detail.classList.remove('js-fade-out');

        tile.style.display = '';
        tile.classList.remove('js-fade-out');
        resetInline(tile);
    });

    syncReelTileWidth();
}

/* Smooth close: a ghost copy of the expanded window shrinks and fades toward
   the tile's spot while the grid reflows and the tile fades back in */
function closeDetailSmooth() {
    if (!selectedTile) return;
    cancelScrollAnim();
    var tile = selectedTile;
    selectedTile = null;
    selectedIsReel = false;
    rememberSlide(tile);

    var detail = document.getElementById('project-detail');
    var dRect = detail.getBoundingClientRect();
    var ghost = makeDetailGhost(detail, dRect, true);
    stopDetailVideo();

    var siblings = getProjectTiles().concat(getReelTiles()).filter(function (t) {
        return t !== tile && t.style.display !== 'none';
    });

    flipElements(siblings, function () {
        detail.style.display = 'none';
        detail.classList.remove('js-fade-out');

        tile.classList.add('js-fade-out');
        resetInline(tile);
        tile.style.display = '';
    });

    syncReelTileWidth();
    shrinkGhostToTile(ghost, dRect, tile);

    // Fade the real tile back in as the ghost arrives
    void tile.offsetWidth;
    tile.classList.remove('js-fade-out');
}

getProjectTiles().concat(getReelTiles()).forEach(function (tile) {
    tile.addEventListener('click', function () {
        if (selectedTile === tile) {
            closeDetailSmooth();
        } else {
            openDetail(tile);
        }
    });
});

document.getElementById('detail-play-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    var src = this.dataset.embedSrc;
    if (!src) return;
    var detailVideo = document.getElementById('detail-video');
    var videoSlot = document.getElementById('detail-video-slot');
    var separator = src.indexOf('?') === -1 ? '?' : '&';
    detailVideo.src = src + separator + 'autoplay=1';
    detailVideo.style.display = '';
    videoSlot.style.display = 'none';
});

document.getElementById('detail-close-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    closeDetailSmooth();
});

/* Keep the ANIMATE/VFX rectangles exactly the same size as the project
   rectangles, regardless of which container the reel row is currently in */
function syncReelTileWidth() {
    var refTile = getProjectTiles().filter(function (t) { return t.style.display !== 'none'; })[0];
    var reelTiles = document.querySelectorAll('.reel-row .home-tile');
    if (!refTile || !reelTiles.length) return;
    var w = refTile.getBoundingClientRect().width;
    if (!w) return;
    reelTiles.forEach(function (t) { t.style.width = w + 'px'; });
}

window.addEventListener('resize', syncReelTileWidth);
syncReelTileWidth();

/* FLOATING NAV — a pill that follows the user once the header nav has scrolled out of view.
   Built from the header links, so it always matches their order and stays in sync. */
(function () {
    var heroNav = document.querySelector('header .nav');
    if (!heroNav) return;

    var bar = document.createElement('nav');
    bar.className = 'floating-nav';
    bar.setAttribute('aria-label', 'Quick navigation');

    Array.prototype.forEach.call(heroNav.querySelectorAll('a[data-filter]'), function (a) {
        var copy = a.cloneNode(true);
        copy.addEventListener('click', function (e) {
            e.preventDefault();
            navigateTo(copy.dataset.filter);
        });
        bar.appendChild(copy);
    });
    document.body.appendChild(bar);

    function setVisible(show) {
        bar.classList.toggle('is-visible', show);
    }

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            setVisible(!entries[0].isIntersecting);
        }).observe(heroNav);
    } else {
        window.addEventListener('scroll', function () {
            setVisible(heroNav.getBoundingClientRect().bottom < 0);
        });
    }
})();

/* Reel cover images: add data-thumb="path/to/image.jpg" to a reel tile in index.html */
Array.prototype.forEach.call(document.querySelectorAll('.reel-tile[data-thumb]'), function (tile) {
    var thumb = tile.querySelector('.reel-thumb');
    if (thumb) thumb.style.backgroundImage = 'url("' + tile.dataset.thumb + '")';
});

/* Slideshow projects: the grid thumbnail is always the first image in data-images,
   so the tile and the expanded window start from the same picture */
Array.prototype.forEach.call(document.querySelectorAll('.home-tile[data-images]'), function (tile) {
    var first = tile.dataset.images.split('|').map(function (s) { return s.trim(); }).filter(Boolean)[0];
    var thumb = tile.querySelector('img');
    if (first && thumb) thumb.src = first;
});
