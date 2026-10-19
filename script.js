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
var scrollTimer = null;
var openToken = 0;

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
    var ghost = detail.cloneNode(true);
    ghost.removeAttribute('id');
    Array.prototype.forEach.call(ghost.querySelectorAll('[id]'), function (n) { n.removeAttribute('id'); });
    var ghostVideo = ghost.querySelector('iframe');
    if (ghostVideo) ghostVideo.parentNode.removeChild(ghostVideo);
    var ghostClose = ghost.querySelector('.detail-close');
    if (ghostClose) ghostClose.parentNode.removeChild(ghostClose);
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

/* Shrink + fade a detail ghost toward a tile's current spot */
function shrinkGhostToTile(ghost, dRect, tile) {
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
    var detailVideo = document.getElementById('detail-video');
    var videoSlot = document.getElementById('detail-video-slot');
    detailVideo.src = '';
    detailVideo.style.display = 'none';
    videoSlot.style.display = 'none';
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
        clearTimeout(scrollTimer);
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
        var label = tile.querySelector('.reel-label');
        detailImg.style.display = 'none';
        detailImg.src = '';
        detailVideo.style.display = 'none';
        detailVideo.src = '';
        playBtn.dataset.embedSrc = tile.dataset.embedSrc || '';
        videoSlot.style.display = 'flex';
        document.getElementById('detail-title').textContent = label ? label.textContent : 'Reel';
        document.getElementById('detail-description').textContent =
            'Add more information about this reel here.';
    } else {
        var img = tile.querySelector('img');
        var titleEl = tile.querySelector('h3');
        detailVideo.style.display = 'none';
        detailVideo.src = '';
        videoSlot.style.display = 'none';
        detailImg.src = img ? img.src : '';
        detailImg.style.display = '';
        document.getElementById('detail-title').textContent = titleEl ? titleEl.textContent : 'Project Title';
        document.getElementById('detail-description').textContent =
            'Add more information about this project here \u2014 process, tools used, and outcome.';
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

    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
        document.getElementById('work').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);
}

function closeDetailImmediate() {
    if (!selectedTile) return;
    clearTimeout(scrollTimer);
    var tile = selectedTile;
    selectedTile = null;
    selectedIsReel = false;

    var detail = document.getElementById('project-detail');
    var detailVideo = document.getElementById('detail-video');
    var videoSlot = document.getElementById('detail-video-slot');

    detailVideo.src = '';
    detailVideo.style.display = 'none';
    videoSlot.style.display = 'none';

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
    clearTimeout(scrollTimer);
    var tile = selectedTile;
    selectedTile = null;
    selectedIsReel = false;

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
