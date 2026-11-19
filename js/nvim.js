/* ==========================================================================
   nvim theme — client
   neo-tree interactions, telescope-style palette, lualine niceties.
   ========================================================================== */
(function () {
  'use strict';

  var dataEl = document.getElementById('nvim-data');
  if (!dataEl) return;

  var data;
  try { data = JSON.parse(dataEl.textContent); } catch (err) { return; }

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var body = document.body;
  var viewport = $('#viewport');
  var routes = data.routes || {};
  var isMobile = function () { return window.matchMedia('(max-width: 1024px)').matches; };
  var reducedMotion = function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };

  var state = {
    paletteOpen: false,
    mode: 'search',
    query: '',
    items: [],
    selected: 0,
    lastFocus: null,
    contentMap: null,
    contentLoading: false,
    lightbox: null,
    gPending: false,
    gTimer: 0,
    spacePending: false,
    spaceTimer: 0,
    viMode: 'normal',
    count: '',
    findOpen: false,
    findQuery: '',
    findBackward: false,
    findBar: null,
    findInput: null,
    visual: false,
    visualBlocks: [],
    visualAnchor: 0,
    visualIndex: 0,
    marks: {},
    markPending: null,
    markTimer: 0,
    yPending: false,
    yTimer: 0
  };

  /* ------------------------------- helpers -------------------------------- */
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function decodeHtml(value) {
    var el = document.createElement('textarea');
    el.innerHTML = String(value == null ? '' : value);
    return el.value;
  }

  function normPath(value) {
    return String(value || '').replace(/\/index\.html$/, '').replace(/index\.html$/, '').replace(/\/$/, '');
  }

  function highlight(text, query) {
    var safe = esc(text);
    var q = String(query || '').trim();
    if (q.length < 1) return safe;
    var pattern = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      return safe.replace(new RegExp('(' + pattern + ')', 'ig'), '<span class="pi-hit">$1</span>');
    } catch (err) {
      return safe;
    }
  }

  function isTyping(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function setMode(mode) {
    state.viMode = mode || 'normal';
    var labels = { normal: 'NORMAL', visual: 'VISUAL', command: 'COMMAND', search: 'SEARCH', help: 'HELP', insert: 'INSERT' };
    var modeEl = $('#sl-mode');
    body.classList.remove('mode-command', 'mode-search', 'mode-help', 'mode-insert', 'mode-visual');
    if (mode && mode !== 'normal') body.classList.add('mode-' + mode);
    if (modeEl) {
      var label = labels[mode] || 'NORMAL';
      if (state.count && mode === 'normal') label += ' ' + state.count;
      modeEl.textContent = label;
    }
  }

  function refreshModeLabel() {
    var modeEl = $('#sl-mode');
    if (!modeEl) return;
    if (state.viMode === 'normal') {
      modeEl.textContent = state.count ? 'NORMAL ' + state.count : 'NORMAL';
    } else if (state.viMode === 'visual') {
      modeEl.textContent = state.count ? 'VISUAL ' + state.count : 'VISUAL';
    }
  }

  function toast(message) {
    var el = document.getElementById('nvim-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'nvim-toast';
      el.className = 'nvim-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.classList.remove('is-visible'); }, 1800);
  }

  function fallbackCopy(text) {
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy') ? resolve() : reject(); }
      catch (err) { reject(err); }
      finally { document.body.removeChild(area); }
    });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () {
        return fallbackCopy(text);
      });
    }
    return fallbackCopy(text);
  }

  function copyCurrentLink() {
    var url = body.dataset.url || window.location.href;
    copyText(url).then(function () {
      toast('已复制链接');
    }).catch(function () {
      toast('复制失败，请手动复制');
    });
  }

  function go(url) {
    if (url) window.location.href = url;
  }

  /* ------------------------------- tree ----------------------------------- */
  var tree = $('#tree');
  var treeToggle = $('#tree-toggle');
  var drawerBackdrop = $('#drawer-backdrop');

  function treeFolders() {
    return tree ? $$('.tree-folder', tree) : [];
  }

  function saveTreeState() {
    try {
      var saved = {};
      treeFolders().forEach(function (li) {
        saved[li.dataset.folder] = li.classList.contains('is-open');
      });
      window.localStorage.setItem('nvim.tree.state', JSON.stringify(saved));
    } catch (err) { /* private mode */ }
  }

  function initTreeState() {
    var saved = {};
    try { saved = JSON.parse(window.localStorage.getItem('nvim.tree.state') || '{}') || {}; } catch (err) { saved = {}; }
    treeFolders().forEach(function (li) {
      var id = li.dataset.folder;
      var hasActive = Boolean(li.querySelector('.tree-file-item.is-active'));
      var open = hasActive ? true : (Object.prototype.hasOwnProperty.call(saved, id) ? Boolean(saved[id]) : li.classList.contains('is-open'));
      li.classList.toggle('is-open', open);
      li.setAttribute('aria-expanded', open ? 'true' : 'false');
      var icon = li.querySelector('.tree-folder-row .ficon');
      if (icon) {
        icon.classList.toggle('i-folder-open', open);
        icon.classList.toggle('i-folder', !open);
      }
    });
    var active = tree ? $('.tree-file-item.is-active .tree-file-row', tree) : null;
    if (active && tree) {
      window.setTimeout(function () {
        var rowRect = active.getBoundingClientRect();
        var treeRect = tree.getBoundingClientRect();
        if (rowRect.top < treeRect.top + 8 || rowRect.bottom > treeRect.bottom - 8) {
          tree.scrollTop += rowRect.top - treeRect.top - tree.clientHeight / 2 + 16;
        }
      }, 60);
    }
  }

  function setDrawer(open) {
    body.classList.toggle('drawer-open', open);
    if (drawerBackdrop) drawerBackdrop.hidden = !open;
    if (treeToggle) {
      var expanded = isMobile() ? open : !body.classList.contains('tree-collapsed');
      treeToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
  }

  function toggleTree() {
    if (isMobile()) {
      setDrawer(!body.classList.contains('drawer-open'));
    } else {
      var collapsed = body.classList.toggle('tree-collapsed');
      try { window.localStorage.setItem('nvim.tree.collapsed', collapsed ? '1' : '0'); } catch (err) {}
      if (treeToggle) treeToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
  }

  function initTree() {
    if (treeToggle) {
      treeToggle.addEventListener('click', toggleTree);
    }
    var closeBtn = $('#sidebar-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { setDrawer(false); });
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', function () { setDrawer(false); });

    if (tree) {
      tree.addEventListener('click', function (event) {
        var row = event.target.closest ? event.target.closest('.tree-folder-row') : null;
        if (!row) return;
        var li = row.closest('.tree-folder');
        if (!li) return;
        var open = li.classList.toggle('is-open');
        li.setAttribute('aria-expanded', open ? 'true' : 'false');
        var icon = row.querySelector('.ficon');
        if (icon) {
          icon.classList.toggle('i-folder-open', open);
          icon.classList.toggle('i-folder', !open);
        }
        saveTreeState();
      });
    }

    var collapseAll = $('#tree-collapse-all');
    if (collapseAll) {
      collapseAll.addEventListener('click', function () {
        treeFolders().forEach(function (li) {
          li.classList.remove('is-open');
          li.setAttribute('aria-expanded', 'false');
          var icon = li.querySelector('.tree-folder-row .ficon');
          if (icon) { icon.classList.remove('i-folder-open'); icon.classList.add('i-folder'); }
        });
        saveTreeState();
      });
    }

    if (!isMobile()) {
      try {
        if (window.localStorage.getItem('nvim.tree.collapsed') === '1') body.classList.add('tree-collapsed');
      } catch (err) {}
    }
    initTreeState();
    if (treeToggle) {
      treeToggle.setAttribute('aria-expanded', isMobile() ? 'false' : (body.classList.contains('tree-collapsed') ? 'false' : 'true'));
    }

    window.addEventListener('resize', function () {
      if (!isMobile()) {
        setDrawer(false);
      }
    });
  }

  /* -------------------------------- tabs ---------------------------------- */
  var TABS_KEY = 'nvim.buffers.v1';
  var TABS_LIMIT = 10;

  function tabIcon(kind) {
    if (kind === 'archive') return 'i-book';
    if (kind === 'category') return 'i-folder';
    if (kind === 'tag') return 'i-tag';
    return 'i-file-md';
  }

  function normalizeTabKey(path) {
    var key = String(path || '/');
    key = key.replace(/index\.html$/, '');
    if (key.length > 1) key = key.replace(/\/+$/, '/');
    return key;
  }

  function readTabs() {
    try {
      var list = JSON.parse(window.localStorage.getItem(TABS_KEY) || '[]');
      if (!Array.isArray(list)) return [];
      return list.filter(function (entry) {
        return entry && entry.key && entry.url && entry.label && entry.url.charAt(0) === '/' && entry.key !== '/' && entry.key !== 'home';
      });
    } catch (err) {
      return [];
    }
  }

  function saveTabs(list) {
    try { window.localStorage.setItem(TABS_KEY, JSON.stringify(list)); } catch (err) {}
  }

  function tabHref(entry) {
    return entry.url || routes.home || '/';
  }

  function renderTabs(tabsEl, list, currentKey) {
    var homeActive = currentKey === '/';
    var html = '<a class="tab' + (homeActive ? ' is-active' : '') + '" href="' + esc(routes.home || '/') + '" role="tab" aria-selected="' + (homeActive ? 'true' : 'false') + '" title="首页">' +
      '<i class="i i-file-md tab-icon" aria-hidden="true"></i><span class="tab-name">README.md</span></a>';
    list.forEach(function (entry) {
      var active = entry.key === currentKey;
      html += '<div class="tab' + (active ? ' is-active' : '') + '" role="tab" aria-selected="' + (active ? 'true' : 'false') + '">' +
        '<a class="tab-link" href="' + esc(tabHref(entry)) + '" title="' + esc(entry.title || entry.label) + '">' +
        '<i class="i ' + tabIcon(entry.kind) + ' tab-icon" aria-hidden="true"></i>' +
        '<span class="tab-name">' + esc(entry.label) + '</span>' +
        (active ? '<span class="tab-mod" title="当前 buffer">●</span>' : '') +
        '</a>' +
        '<button class="tab-close" type="button" data-tab-close="' + esc(entry.key) + '" title="关闭 ' + esc(entry.label) + '" aria-label="关闭 ' + esc(entry.label) + '">' +
        '<i class="i i-close" aria-hidden="true"></i></button></div>';
    });
    tabsEl.innerHTML = html;
    var activeEl = $('.tab.is-active', tabsEl);
    if (activeEl) {
      var tabsRect = tabsEl.getBoundingClientRect();
      var activeRect = activeEl.getBoundingClientRect();
      if (activeRect.left < tabsRect.left || activeRect.right > tabsRect.right) {
        tabsEl.scrollLeft += activeRect.left - tabsRect.left - 8;
      }
    }
  }

  function closeTab(key, tabsEl) {
    var currentKey = normalizeTabKey(window.location.pathname);
    var list = readTabs();
    var index = -1;
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].key === key) { index = i; break; }
    }
    if (index === -1) {
      if (key === currentKey) window.location.href = routes.home || '/';
      return;
    }
    var wasActive = key === currentKey;
    var target = null;
    if (wasActive) {
      if (index > 0) target = list[index - 1];
      else if (index < list.length - 1) target = list[index + 1];
    }
    list.splice(index, 1);
    saveTabs(list);
    if (wasActive) {
      window.location.href = target ? tabHref(target) : (routes.home || '/');
    } else {
      renderTabs(tabsEl, list, currentKey);
    }
  }

  function initTabs() {
    var tabsEl = $('#buffer-tabs');
    if (!tabsEl) return;
    var key = normalizeTabKey(window.location.pathname);
    var kind = body.dataset.kind || 'page';
    var label = body.dataset.tab || body.dataset.file || 'README.md';
    var title = body.dataset.title || label;
    var list = readTabs();
    if (key !== '/') {
      var current = {
        key: key,
        label: label,
        title: title,
        kind: kind,
        url: window.location.pathname + window.location.search
      };
      var existing = -1;
      for (var i = 0; i < list.length; i += 1) {
        if (list[i].key === key) { existing = i; break; }
      }
      if (existing !== -1) {
        list[existing] = current;
      } else {
        list.push(current);
        if (list.length > TABS_LIMIT) list = list.slice(list.length - TABS_LIMIT);
      }
    }
    saveTabs(list);
    renderTabs(tabsEl, list, key);

    tabsEl.addEventListener('click', function (event) {
      var close = event.target.closest ? event.target.closest('[data-tab-close]') : null;
      if (!close) return;
      event.preventDefault();
      event.stopPropagation();
      closeTab(close.getAttribute('data-tab-close'), tabsEl);
    });
  }

  /* --------------------------- palette commands --------------------------- */
  var commands = [
    { id: 'search', title: '搜索文章', desc: '打开站点搜索面板（/ 用于页面内查找）', key: ':search', icon: 'i-search', action: function () { openPalette('search'); } },
    { id: 'home', title: '回到首页', desc: '打开 README.md buffer', key: 'g h', icon: 'i-home', action: function () { go(routes.home); } },
    { id: 'archives', title: '打开归档', desc: '按年份浏览全部文章', key: 'g a', icon: 'i-book', action: function () { go(routes.archives); } },
    { id: 'categories', title: '打开分类', desc: '按目录浏览文章', key: 'g c', icon: 'i-folder', action: function () { go(routes.categories); } },
    { id: 'tags', title: '打开标签', desc: '全部标签与文章数', key: 'g x', icon: 'i-tag', action: function () { go(routes.tags); } },
    { id: 'about', title: '关于我', desc: '个人资料与站点信息', key: 'g o', icon: 'i-user', action: function () { go(routes.about); } },
    { id: 'friends', title: '友链', desc: '互联网邻居们', key: 'g f', icon: 'i-link', action: function () { go(routes.friends); } },
    { id: 'contact', title: '联系', desc: '公开的联系方式', key: 'g m', icon: 'i-envelope', action: function () { go(routes.contact); } },
    { id: 'tree', title: '切换文件树', desc: 'Space e 显示或隐藏 neo-tree 侧栏', key: 'Space e', icon: 'i-layout', action: toggleTree },
    { id: 'top', title: '回到顶部', desc: '滚动到 buffer 第一行', key: 'g g', icon: 'i-arrow-up', action: function () { scrollTop(); } },
    { id: 'copy', title: '复制当前链接', desc: '把当前页面地址放到剪贴板', key: ':copy', icon: 'i-copy', action: copyCurrentLink },
    { id: 'github', title: '打开 GitHub', desc: '源码仓库', key: ':github', icon: 'i-github', action: function () { if (routes.github) window.open(routes.github, '_blank', 'noopener'); } }
  ];

  if (routes.source) {
    commands.splice(10, 0, {
      id: 'source', title: '查看本页源码', desc: '在 GitHub 打开当前文件的源 markdown', key: ':source', icon: 'i-code',
      action: function () { window.open(routes.source, '_blank', 'noopener'); }
    });
  }

  commands.push(
    { id: 'quit', title: '关闭当前 buffer', desc: '回到 README（:q / :bd）', key: ':q', icon: 'i-close', action: function () { go(routes.home); } },
    { id: 'next-buffer', title: '下一个 buffer', desc: '切换到下一个已打开文件（gt）', key: ':bn', icon: 'i-arrow-right', action: function () { cycleTab(1); } },
    { id: 'prev-buffer', title: '上一个 buffer', desc: '切换到上一个已打开文件（gT）', key: ':bp', icon: 'i-arrow-left', action: function () { cycleTab(-1); } },
    { id: 'help', title: '打开 vi keymap', desc: '查看完整快捷键（g?）', key: ':help', icon: 'i-info', action: function () { openPalette('help'); } },
    { id: 'noh', title: '取消高亮 / 选择', desc: '清除页面内查找的选中文本（:noh）', key: ':noh', icon: 'i-eye', action: function () {
        var selection = window.getSelection();
        if (selection) selection.removeAllRanges();
        toast('已清除选择');
      } },
    { id: 'marks', title: '查看标记', desc: '列出当前页面设置过的标记（:marks）', key: ':marks', icon: 'i-hash', action: function () {
        var keys = Object.keys(state.marks);
        toast(keys.length ? '标记：' + keys.join(' ') : '还没有设置标记');
      } }
  );

  var helpRows = [
    { id: 'jk', title: 'j / k', desc: '向下 / 向上滚动（可带数字）', key: 'j k', icon: 'i-arrow-up', action: null },
    { id: 'hl', title: 'h / l', desc: '上一个 / 下一个 buffer', key: 'h l', icon: 'i-arrow-left', action: null },
    { id: 'wb', title: 'w / b', desc: '下一个 / 上一个标题', key: 'w b', icon: 'i-arrow-right', action: null },
    { id: 'gg', title: 'gg / G', desc: '跳到页面顶部 / 底部', key: 'g g', icon: 'i-arrow-up', action: null },
    { id: 'hml', title: 'H / M / L', desc: '第一个 / 中间 / 最后一个标题', key: 'H M L', icon: 'i-arrow-up', action: null },
    { id: 'half', title: 'Ctrl d / u', desc: '向下 / 向上半页', key: 'Ctrl+d/u', icon: 'i-arrow-up', action: null },
    { id: 'page', title: 'Ctrl f / b', desc: '向下 / 向上一页', key: 'Ctrl+f/b', icon: 'i-arrow-up', action: null },
    { id: 'gt', title: 'gt / gT', desc: '下一个 / 上一个 buffer', key: 'g t', icon: 'i-arrow-right', action: null },
    { id: 'find', title: '/ · ?', desc: '页面内向后 / 向前查找', key: '/ ?', icon: 'i-search', action: null },
    { id: 'repeat', title: 'n / N', desc: '重复查找（同向 / 反向）', key: 'n N', icon: 'i-search', action: null },
    { id: 'visual', title: 'v / V', desc: '按段落选择，j/k 扩展，y 复制', key: 'v', icon: 'i-file-text', action: null },
    { id: 'yank', title: 'y / yy / Y', desc: '复制当前段落（页面只读，不删除）', key: 'y y', icon: 'i-copy', action: null },
    { id: 'marks', title: "m / '", desc: '设置 / 跳转当前页面标记', key: 'm a', icon: 'i-hash', action: null },
    { id: 'space-e', title: 'Space e', desc: '显示 / 隐藏 neo-tree 侧栏', key: '', icon: 'i-layout', action: null },
    { id: 'esc', title: 'Esc', desc: '取消计数、选择或关闭面板', key: 'Esc', icon: 'i-close', action: null }
  ];

  var palette = $('#palette');
  var paletteInput = $('#palette-input');
  var paletteResults = $('#palette-results');
  var palettePreview = $('#palette-preview');
  var paletteCount = $('#palette-count');
  var paletteTitle = $('#palette-title');
  var palettePrefix = $('#palette-prefix');

  function normalizeFiles() {
    var files = [];
    (data.posts || []).forEach(function (p) {
      files.push({
        type: 'post', icon: 'i-file-md', title: p.title, url: p.url, path: p.path,
        date: p.date, category: p.category, tags: p.tags || [], excerpt: p.excerpt || '',
        minutes: p.minutes || 0
      });
    });
    (data.pages || []).forEach(function (p) {
      files.push({
        type: 'page', icon: 'i-file-text', title: p.title, url: p.url, path: p.path,
        date: '', category: '', tags: [], excerpt: '', minutes: 0
      });
    });
    return files;
  }

  var allFiles = normalizeFiles();

  function paletteItems() {
    if (state.mode === 'command') return commands;
    if (state.mode === 'help') return commands.concat(helpRows);
    return allFiles;
  }

  function scoreItem(item, query) {
    var q = query.toLowerCase().trim();
    if (!q) return 1;
    var haystack = [
      item.title, item.path, item.desc || item.excerpt || '', item.category || '',
      (item.tags || []).join(' '), item.key || ''
    ].join(' ').toLowerCase();
    var tokens = q.split(/\s+/).filter(Boolean);
    for (var i = 0; i < tokens.length; i += 1) {
      if (haystack.indexOf(tokens[i]) === -1) return -1;
    }
    var score = 1;
    var title = String(item.title || '').toLowerCase();
    if (title === q) score += 100;
    if (title.indexOf(q) === 0) score += 55;
    else if (title.indexOf(q) !== -1) score += 30;
    if (String(item.path || '').toLowerCase().indexOf(q) !== -1) score += 12;
    if ((item.tags || []).join(' ').toLowerCase().indexOf(q) !== -1) score += 8;
    return score;
  }

  function filterItems(items, query) {
    if (!query.trim()) return items;
    return items
      .map(function (item, index) { return { item: item, index: index, score: scoreItem(item, query) }; })
      .filter(function (row) { return row.score > 0; })
      .sort(function (a, b) { return b.score - a.score || a.index - b.index; })
      .map(function (row) { return row.item; });
  }

  function palettePlaceholder() {
    if (state.mode === 'search') return '搜索文章、标签、页面…';
    if (state.mode === 'help') return '过滤快捷键与命令…';
    return '输入命令…';
  }

  function paletteModeLabel() {
    if (state.mode === 'search') return 'find_files';
    if (state.mode === 'help') return 'keymap';
    return 'command';
  }

  function openPalette(mode) {
    if (!palette) return;
    if (!state.paletteOpen) state.lastFocus = document.activeElement;
    state.paletteOpen = true;
    state.mode = mode || 'search';
    state.query = '';
    state.selected = 0;
    if (paletteInput) {
      paletteInput.value = '';
      paletteInput.placeholder = palettePlaceholder();
    }
    if (palettePrefix) palettePrefix.textContent = state.mode === 'search' ? '>' : state.mode === 'command' ? ':' : '?';
    if (paletteTitle) paletteTitle.textContent = paletteModeLabel();
    palette.hidden = false;
    body.classList.add('palette-open');
    setMode(state.mode === 'search' ? 'search' : state.mode === 'command' ? 'command' : 'help');
    renderPalette();
    loadContentPreview();
    window.requestAnimationFrame(function () {
      if (paletteInput) paletteInput.focus();
    });
  }

  function closePalette() {
    if (!palette || palette.hidden) return;
    palette.hidden = true;
    state.paletteOpen = false;
    body.classList.remove('palette-open');
    setMode('normal');
    if (state.lastFocus && typeof state.lastFocus.focus === 'function') {
      state.lastFocus.focus();
    }
  }

  function renderPalette() {
    if (!paletteResults) return;
    state.items = filterItems(paletteItems(), state.query);
    if (state.selected >= state.items.length) state.selected = 0;

    if (!state.items.length) {
      paletteResults.innerHTML = '<div class="palette-empty"><span>~/blog</span><strong>没有匹配的结果</strong><span>换个关键词试试</span></div>';
      if (paletteCount) paletteCount.textContent = '0 / 0';
      renderPreview(null);
      return;
    }

    paletteResults.innerHTML = state.items.map(function (item, index) {
      var selected = index === state.selected;
      var isCommand = item.type === 'command' || item.type === 'help' || item.action !== undefined;
      var type = item.type || (isCommand ? 'command' : 'post');
      var right = '';
      if (type === 'command' || type === 'help') {
        right = item.key ? '<span class="pi-key">' + esc(item.key) + '</span>' : '';
      } else {
        right = item.category ? '<span class="pi-tag">' + esc(item.category) + '</span>' : '';
      }
      var sub = type === 'command' || type === 'help'
        ? (item.desc || '')
        : '~/blog/' + (item.path || '').replace(/index\.html$/, '');
      return '<div class="palette-item' + (selected ? ' is-selected' : '') + '" role="option" aria-selected="' + (selected ? 'true' : 'false') + '" data-index="' + index + '" data-type="' + type + '">' +
        '<i class="i ' + (item.icon || 'i-file') + ' pi-icon" aria-hidden="true"></i>' +
        '<div class="pi-main"><div class="pi-title">' + highlight(item.title, state.query) + '</div>' +
        '<div class="pi-path">' + esc(sub) + '</div></div>' +
        right +
        '</div>';
    }).join('');

    if (paletteCount) paletteCount.textContent = (state.selected + 1) + ' / ' + state.items.length;
    var selectedEl = $('.palette-item.is-selected', paletteResults);
    if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest' });
    renderPreview(state.items[state.selected]);
  }

  function updateSelection(next) {
    if (!state.items.length) return;
    state.selected = (next + state.items.length) % state.items.length;
    $$('.palette-item', paletteResults).forEach(function (el, index) {
      var active = index === state.selected;
      el.classList.toggle('is-selected', active);
      el.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (paletteCount) paletteCount.textContent = (state.selected + 1) + ' / ' + state.items.length;
    var selectedEl = $('.palette-item.is-selected', paletteResults);
    if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest' });
    renderPreview(state.items[state.selected]);
  }

  function renderPreview(item) {
    if (!palettePreview) return;
    var pathEl = $('#preview-path');
    var ftEl = $('.preview-ft', palettePreview);
    var titleEl = $('#preview-title');
    var metaEl = $('#preview-meta');
    var textEl = $('#preview-text');
    if (!item) {
      if (pathEl) pathEl.textContent = '~/blog';
      if (titleEl) titleEl.textContent = '';
      if (metaEl) metaEl.textContent = '';
      if (textEl) textEl.textContent = '-- no preview --';
      return;
    }
    var isCommand = item.action !== undefined || item.type === 'command' || item.type === 'help';
    if (pathEl) pathEl.textContent = isCommand ? 'command' : '~/blog/' + (item.path || '');
    if (ftEl) ftEl.textContent = isCommand ? 'keymap' : (item.type === 'page' ? 'markdown · page' : 'markdown');
    if (titleEl) titleEl.textContent = item.title || '';
    if (metaEl) {
      var meta = [];
      if (!isCommand) {
        if (item.date) meta.push(item.date);
        if (item.category) meta.push(item.category);
        if (item.minutes) meta.push(item.minutes + ' min');
      } else {
        if (item.key) meta.push(item.key);
        meta.push('command');
      }
      metaEl.textContent = meta.join(' · ');
    }
    if (textEl) {
      var text = '';
      if (isCommand) {
        text = item.desc || '';
      } else {
        var key = normPath(item.path);
        if (state.contentMap) {
          text = state.contentMap[key] || state.contentMap[item.title] || '';
        }
        if (!text) text = item.excerpt || '';
        if (!text) text = state.mode === 'search' && !state.contentMap ? '正在读取内容…' : '（空白文件）';
      }
      textEl.textContent = decodeHtml(text).replace(/\s+/g, ' ').slice(0, 900);
    }
  }

  function openPaletteItem(index) {
    var item = state.items[index];
    if (!item) return;
    if (typeof item.action === 'function') {
      var keepOpen = item.id === 'search';
      if (!keepOpen) closePalette();
      item.action();
      return;
    }
    if (item.url) {
      closePalette();
      go(item.url);
    }
  }

  function loadContentPreview() {
    if (state.contentMap || state.contentLoading || !routes.content) return;
    state.contentLoading = true;
    fetch(routes.content, { credentials: 'same-origin' })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (json) {
        if (!json) return;
        var map = {};
        (json.posts || []).concat(json.pages || []).forEach(function (entry) {
          var text = String(entry.text || entry.excerpt || '').replace(/\s+/g, ' ').trim();
          if (!text) return;
          map[normPath(entry.path)] = text;
          if (entry.title) map[entry.title] = text;
        });
        state.contentMap = map;
        if (state.paletteOpen) renderPreview(state.items[state.selected]);
      })
      .catch(function () { /* preview is optional */ })
      .then(function () { state.contentLoading = false; });
  }

  function initPalette() {
    if (!palette) return;
    $$('[data-open-search]').forEach(function (el) {
      el.addEventListener('click', function (event) {
        event.preventDefault();
        openPalette('search');
      });
    });
    $$('[data-open-palette]').forEach(function (el) {
      el.addEventListener('click', function (event) {
        event.preventDefault();
        openPalette('command');
      });
    });
    $$('[data-help]').forEach(function (el) {
      el.addEventListener('click', function (event) {
        event.preventDefault();
        openPalette('help');
      });
    });
    $$('[data-palette-close]').forEach(function (el) {
      el.addEventListener('click', function () { closePalette(); });
    });

    if (paletteInput) {
      paletteInput.addEventListener('input', function () {
        state.query = paletteInput.value;
        state.selected = 0;
        renderPalette();
      });

      paletteInput.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          updateSelection(state.selected + 1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          updateSelection(state.selected - 1);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          openPaletteItem(state.selected);
        } else if (event.key === 'Tab') {
          event.preventDefault();
          paletteInput.focus();
        }
      });
    }

    if (paletteResults) {
      paletteResults.addEventListener('click', function (event) {
        var item = event.target.closest ? event.target.closest('.palette-item') : null;
        if (!item) return;
        openPaletteItem(Number(item.dataset.index));
      });
      paletteResults.addEventListener('mousemove', function (event) {
        var item = event.target.closest ? event.target.closest('.palette-item') : null;
        if (!item) return;
        var index = Number(item.dataset.index);
        if (index !== state.selected) updateSelection(index);
      });
    }

    document.addEventListener('keydown', function (event) {
      if (!state.paletteOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closePalette();
      }
    });
  }

  /* ------------------------------- scroll --------------------------------- */
  var scrollRaf = 0;
  function updateScroll() {
    scrollRaf = 0;
    if (!viewport) return;
    var max = viewport.scrollHeight - viewport.clientHeight;
    var percent = max > 0 ? Math.min(100, Math.max(0, (viewport.scrollTop / max) * 100)) : 0;
    var percentEl = $('#sl-percent');
    var bar = $('#status-progress-bar');
    if (percentEl) {
      percentEl.textContent = percent <= 0.4 ? 'TOP' : percent >= 99.4 ? 'BOT' : Math.round(percent) + '%';
    }
    if (bar) bar.style.width = percent + '%';
    updateToc();
  }

  function onScroll() {
    if (scrollRaf) return;
    scrollRaf = window.requestAnimationFrame(updateScroll);
  }

  function scrollTop() {
    if (!viewport) return;
    viewport.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  function scrollBottom() {
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  function initScroll() {
    if (!viewport) return;
    viewport.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('load', updateScroll);
    updateScroll();
  }

  /* -------------------------------- toc ----------------------------------- */
  var tocLinks = [];
  var tocHeadings = [];
  var activeTocId = '';

  function initToc() {
    tocLinks = $$('.outline-link');
    if (!tocLinks.length) return;
    tocHeadings = tocLinks.map(function (link) {
      var href = link.getAttribute('href') || '';
      var id = href.replace(/^#/, '');
      try { id = decodeURIComponent(id); } catch (err) {}
      return { id: id, el: document.getElementById(id), link: link };
    }).filter(function (row) { return row.el; });
    updateToc();
  }

  function updateToc() {
    if (!tocHeadings.length || !viewport) return;
    var viewportTop = viewport.getBoundingClientRect().top + 74;
    var current = tocHeadings[0];
    tocHeadings.forEach(function (row) {
      if (row.el.getBoundingClientRect().top <= viewportTop) current = row;
    });
    if (!current || current.id === activeTocId) return;
    activeTocId = current.id;
    tocHeadings.forEach(function (row) {
      var on = row === current;
      row.link.classList.toggle('is-active', on);
      if (on) row.link.setAttribute('aria-current', 'true');
      else row.link.removeAttribute('aria-current');
    });
  }

  /* ------------------------------- clock ---------------------------------- */
  function initClock() {
    var el = $('#sl-clock');
    if (!el) return;
    var format = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    var tick = function () { el.textContent = format.format(new Date()); };
    tick();
    window.setInterval(tick, 30000);
  }

  /* ------------------------------- code ----------------------------------- */
  function initCode() {
    $$('.post-body pre').forEach(function (pre) {
      if (pre.parentElement && pre.parentElement.classList.contains('codeblock')) return;
      var code = pre.querySelector('code');
      var language = pre.getAttribute('data-language') || '';
      if (!language) {
        var match = (pre.className || '').match(/language-([\w-]+)/);
        language = match ? match[1] : 'code';
      }
      var wrapper = document.createElement('div');
      wrapper.className = 'codeblock';
      var head = document.createElement('div');
      head.className = 'code-head';
      var lang = document.createElement('span');
      lang.className = 'code-lang';
      lang.textContent = language;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy';
      button.innerHTML = '<i class="i i-copy" aria-hidden="true"></i><span>copy</span>';
      button.setAttribute('aria-label', '复制代码');
      button.addEventListener('click', function () {
        var text = code ? code.innerText : pre.innerText;
        copyText(text.replace(/\n$/, '')).then(function () {
          button.classList.add('is-copied');
          button.innerHTML = '<i class="i i-check" aria-hidden="true"></i><span>copied</span>';
          window.setTimeout(function () {
            button.classList.remove('is-copied');
            button.innerHTML = '<i class="i i-copy" aria-hidden="true"></i><span>copy</span>';
          }, 1600);
        }).catch(function () { toast('复制失败'); });
      });
      head.appendChild(lang);
      head.appendChild(button);
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(head);
      wrapper.appendChild(pre);
    });
  }

  /* ------------------------------- tables --------------------------------- */
  function initTables() {
    $$('.post-body table').forEach(function (table) {
      if (table.parentElement && table.parentElement.classList.contains('table-wrap')) return;
      var wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  /* ------------------------------- images --------------------------------- */
  function openLightbox(src, alt) {
    if (state.lightbox) return;
    var layer = document.createElement('div');
    layer.className = 'lightbox';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', alt || '图片预览');
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'lightbox-close';
    close.setAttribute('aria-label', '关闭图片预览');
    close.innerHTML = '<i class="i i-close" aria-hidden="true"></i>';
    var image = document.createElement('img');
    image.src = src;
    image.alt = alt || '';
    layer.appendChild(close);
    layer.appendChild(image);
    document.body.appendChild(layer);
    body.classList.add('lightbox-open');
    state.lightbox = layer;
    close.focus();
    var closeBox = function () {
      if (!state.lightbox) return;
      state.lightbox.remove();
      state.lightbox = null;
      body.classList.remove('lightbox-open');
    };
    layer.addEventListener('click', function (event) {
      if (event.target === layer || event.target.closest('.lightbox-close')) closeBox();
    });
    layer._close = closeBox;
  }

  function closeLightbox() {
    if (state.lightbox && typeof state.lightbox._close === 'function') {
      state.lightbox._close();
    }
  }

  function initImages() {
    $$('.post-body img').forEach(function (img) {
      if (img.closest('a')) return;
      img.loading = 'lazy';
      img.addEventListener('click', function () {
        openLightbox(img.currentSrc || img.src, img.alt);
      });
    });
  }

  /* -------------------------------- links --------------------------------- */
  function initLinks() {
    $$('[data-copy-link]').forEach(function (el) {
      el.addEventListener('click', function (event) {
        event.preventDefault();
        copyCurrentLink();
      });
    });
    $$('[data-close-tab]').forEach(function (el) {
      el.addEventListener('click', function (event) {
        event.preventDefault();
        go(routes.home || '/');
      });
    });
    $$('.post-body a[href^="http"]').forEach(function (link) {
      try {
        if (new URL(link.href).hostname !== window.location.hostname) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
      } catch (err) {}
    });
  }

  /* ------------------------------ tag filter ------------------------------ */
  function initTagFilter() {
    var input = $('#tag-filter');
    var cloud = $('#tag-cloud');
    if (!input || !cloud) return;
    var chips = $$('.tag-chip', cloud);
    var empty = $('#tag-empty');
    var count = $('#tag-filter-count');
    input.addEventListener('focus', function () {
      if (!state.paletteOpen && !state.findOpen) setMode('insert');
    });
    input.addEventListener('blur', function () {
      if (!state.paletteOpen && !state.findOpen) setMode(state.visual ? 'visual' : 'normal');
    });
    input.addEventListener('input', function () {
      var query = input.value.trim().toLowerCase();
      var visible = 0;
      chips.forEach(function (chip) {
        var match = !query || (chip.dataset.tag || '').indexOf(query) !== -1;
        chip.hidden = !match;
        if (match) visible += 1;
      });
      if (empty) empty.hidden = visible !== 0;
      if (count) count.textContent = visible;
    });
  }

  /* ------------------------------ vi keyboard ----------------------------- */
  var LINE_HEIGHT = 24;
  var FIND_KEY = 'nvim.find.v1';

  function pushCount(key) {
    if (state.count.length >= 4) return;
    state.count += key;
    refreshModeLabel();
  }

  function takeCount() {
    var n = parseInt(state.count, 10);
    state.count = '';
    refreshModeLabel();
    return (!n || n < 1) ? 1 : n;
  }

  function clearCount() {
    if (!state.count) return;
    state.count = '';
    refreshModeLabel();
  }

  function scrollLines(lines) {
    if (!viewport) return;
    viewport.scrollBy({ top: lines * LINE_HEIGHT });
  }

  function pageScroll(pages) {
    if (!viewport) return;
    viewport.scrollBy({ top: pages * viewport.clientHeight });
  }

  function headingEls() {
    return $$('#content h1, #content h2, #content h3, #content h4')
      .filter(function (el) { return el.offsetParent !== null; });
  }

  function headingOffset(el) {
    return viewport.scrollTop + el.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top;
  }

  function jumpToHeading(index) {
    var headings = headingEls();
    var el = headings[index];
    if (!el) return;
    viewport.scrollTo({ top: Math.max(0, headingOffset(el) - 16), behavior: 'auto' });
  }

  function moveHeading(direction, count) {
    var headings = headingEls();
    if (!headings.length) {
      toast('本页没有可跳转的标题');
      return;
    }
    var current = viewport.scrollTop;
    var index = -1;
    for (var i = 0; i < headings.length; i += 1) {
      var offset = headingOffset(headings[i]);
      if (direction > 0 && offset > current + 6) { index = i; break; }
      if (direction < 0 && offset < current - 6) index = i;
    }
    if (index === -1) {
      toast(direction > 0 ? '已经是最后一个标题' : '已经是第一个标题');
      return;
    }
    index += direction * (count - 1);
    index = Math.max(0, Math.min(headings.length - 1, index));
    jumpToHeading(index);
  }

  function firstHeading() { jumpToHeading(0); }
  function lastHeading() { jumpToHeading(headingEls().length - 1); }
  function middleHeading() { jumpToHeading(Math.floor((headingEls().length - 1) / 2)); }

  function tabLinks() {
    return $$('#buffer-tabs a[href]');
  }

  function cycleTab(delta) {
    var links = tabLinks();
    if (!links.length) return;
    var count = takeCount();
    var current = window.location.pathname;
    var index = -1;
    for (var i = 0; i < links.length; i += 1) {
      try {
        if (new URL(links[i].href).pathname === current) { index = i; break; }
      } catch (err) {}
    }
    if (index === -1) index = 0;
    var next = (index + delta * count) % links.length;
    if (next < 0) next += links.length;
    go(links[next].getAttribute('href'));
  }

  /* ------------------------------- find ----------------------------------- */
  function ensureFindBar() {
    if (state.findBar) return;
    var bar = document.createElement('div');
    bar.className = 'vi-find';
    bar.id = 'vi-find';
    bar.hidden = true;
    bar.innerHTML = '<span class="vi-find-prefix" id="vi-find-prefix">/</span>' +
      '<input id="vi-find-input" class="vi-find-input" type="text" autocomplete="off" spellcheck="false" aria-label="页面内查找">' +
      '<span class="vi-find-hint">Enter 查找 · Esc 关闭</span>';
    document.body.appendChild(bar);
    state.findBar = bar;
    state.findInput = $('#vi-find-input', bar);
    state.findInput.addEventListener('keydown', function (event) {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        executeFind(state.findBackward);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeFind();
      }
    });
  }

  function openFind(backward) {
    ensureFindBar();
    state.findOpen = true;
    state.findBackward = Boolean(backward);
    state.findBar.hidden = false;
    $('#vi-find-prefix').textContent = backward ? '?' : '/';
    state.findInput.value = state.findQuery || '';
    setMode('search');
    state.findInput.focus();
    state.findInput.select();
  }

  function closeFind() {
    if (!state.findOpen) return;
    state.findOpen = false;
    if (state.findBar) state.findBar.hidden = true;
    if (state.findInput) state.findInput.blur();
    setMode(state.visual ? 'visual' : 'normal');
  }

  function persistFind() {
    try {
      sessionStorage.setItem(FIND_KEY, JSON.stringify({
        query: state.findQuery,
        backward: state.findBackward
      }));
    } catch (err) {}
  }

  function executeFind(backward) {
    var input = state.findInput;
    var query = input.value.trim();
    if (!query) { closeFind(); return; }
    if (typeof window.find !== 'function') {
      toast('当前浏览器不支持页面内查找');
      return;
    }
    state.findQuery = query;
    state.findBackward = Boolean(backward);
    persistFind();

    // Hide the prompt before searching so the query does not match the input
    // itself, and start from a clean page selection.
    state.findBar.hidden = true;
    input.blur();
    var selection = window.getSelection();
    if (selection) selection.removeAllRanges();

    var found = false;
    try {
      found = window.find(query, false, Boolean(backward), true, false, false, false);
    } catch (err) {
      found = false;
    }

    if (!found) {
      state.findBar.hidden = false;
      setMode('search');
      input.focus();
      input.select();
      toast('未找到：' + query);
      return;
    }

    state.findOpen = false;
    setMode('normal');
  }

  function repeatFind(opposite) {
    if (!state.findQuery) {
      toast('没有可重复的搜索');
      return;
    }
    if (typeof window.find !== 'function') {
      toast('当前浏览器不支持页面内查找');
      return;
    }
    var backward = opposite ? !state.findBackward : state.findBackward;
    var found = false;
    try {
      found = window.find(state.findQuery, false, backward, true, false, false, false);
    } catch (err) {
      found = false;
    }
    if (!found) toast('未找到：' + state.findQuery);
  }

  /* ------------------------------ visual ---------------------------------- */
  function contentBlocks() {
    var selector = [
      'h1', 'h2', 'h3', 'h4', 'p', 'li', 'pre', 'blockquote', 'figcaption', 'tr',
      '.file-row', '.dir-card', '.friend-card', '.archive-year',
      '.terminal-window', '.profile-card'
    ].map(function (s) { return '#content ' + s; }).join(', ');
    return $$(selector).filter(function (el) { return el.offsetParent !== null; });
  }

  function currentBlockIndex(blocks) {
    if (!blocks.length) return 0;
    var center = viewport.getBoundingClientRect().top + viewport.clientHeight / 2;
    var best = 0;
    var bestDistance = Infinity;
    blocks.forEach(function (el, index) {
      var rect = el.getBoundingClientRect();
      var distance = Math.abs((rect.top + rect.bottom) / 2 - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  }

  function selectVisual() {
    var a = state.visualBlocks[state.visualAnchor];
    var b = state.visualBlocks[state.visualIndex];
    if (!a || !b) return;
    var range = document.createRange();
    range.setStartBefore(a);
    range.setEndAfter(b);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    b.scrollIntoView({ block: 'nearest' });
  }

  function enterVisual() {
    if (state.visual) { exitVisual(); return; }
    var blocks = contentBlocks();
    if (!blocks.length) {
      toast('本页没有可选内容');
      return;
    }
    state.visual = true;
    state.visualBlocks = blocks;
    state.visualIndex = currentBlockIndex(blocks);
    state.visualAnchor = state.visualIndex;
    setMode('visual');
    selectVisual();
  }

  function moveVisual(delta) {
    if (!state.visual) return;
    var count = takeCount();
    var max = state.visualBlocks.length - 1;
    state.visualIndex = Math.max(0, Math.min(max, state.visualIndex + delta * count));
    selectVisual();
  }

  function exitVisual() {
    if (!state.visual) return;
    state.visual = false;
    var selection = window.getSelection();
    if (selection) selection.removeAllRanges();
    setMode('normal');
  }

  function copyBlock(index) {
    var blocks = contentBlocks();
    var el = blocks[index == null ? currentBlockIndex(blocks) : index];
    if (!el) return;
    var text = (el.innerText || el.textContent || '').trim();
    if (!text) return;
    copyText(text).then(function () {
      toast('已复制 ' + text.length + ' 字符');
    }).catch(function () {
      toast('复制失败');
    });
  }

  function yankVisual() {
    var text = (window.getSelection() || '').toString();
    if (!text.trim()) {
      copyBlock(state.visualIndex);
    } else {
      copyText(text).then(function () {
        toast('已复制 ' + text.length + ' 字符');
      }).catch(function () {
        toast('复制失败');
      });
    }
    exitVisual();
  }

  /* ------------------------------- marks ---------------------------------- */
  function startMark(kind) {
    state.markPending = kind;
    if (state.markTimer) window.clearTimeout(state.markTimer);
    state.markTimer = window.setTimeout(function () {
      state.markPending = null;
    }, 1500);
    toast(kind === 'set' ? '按 a-z 设置标记' : '按 a-z 跳转标记');
  }

  function handleMark(key) {
    var kind = state.markPending;
    state.markPending = null;
    if (state.markTimer) window.clearTimeout(state.markTimer);
    state.markTimer = 0;
    if (!/^[a-z]$/.test(key)) return;
    if (kind === 'set') {
      state.marks[key] = { top: viewport.scrollTop, path: window.location.pathname };
      toast('已设置标记 ' + key);
      return;
    }
    var mark = state.marks[key];
    if (!mark) { toast('没有标记 ' + key); return; }
    if (mark.path !== window.location.pathname) {
      toast('标记 ' + key + ' 在其他页面');
      return;
    }
    viewport.scrollTo({ top: mark.top, behavior: 'smooth' });
  }

  /* ------------------------------- yank ----------------------------------- */
  function startYank() {
    if (state.yPending) {
      state.yPending = false;
      if (state.yTimer) window.clearTimeout(state.yTimer);
      state.yTimer = 0;
      copyBlock();
      return;
    }
    state.yPending = true;
    if (state.yTimer) window.clearTimeout(state.yTimer);
    state.yTimer = window.setTimeout(function () {
      state.yPending = false;
      state.yTimer = 0;
    }, 1200);
  }

  /* ------------------------------ keyboard -------------------------------- */
  function initKeyboard() {
    try {
      var saved = JSON.parse(sessionStorage.getItem(FIND_KEY) || 'null');
      if (saved && saved.query) {
        state.findQuery = saved.query;
        state.findBackward = Boolean(saved.backward);
      }
    } catch (err) {}

    document.addEventListener('keydown', onKeyDown);

    document.addEventListener('focusin', function (event) {
      if (state.paletteOpen || state.findOpen) return;
      if (isTyping(event.target)) setMode('insert');
    });

    document.addEventListener('focusout', function (event) {
      if (state.paletteOpen || state.findOpen) return;
      if (isTyping(event.target)) setMode(state.visual ? 'visual' : 'normal');
    });
  }

  function onKeyDown(event) {
    if (event.defaultPrevented || event.isComposing) return;
    var key = event.key;

    if (state.findOpen) {
      if (key === 'Escape') closeFind();
      return;
    }

    if (state.paletteOpen) {
      if (key === 'Escape') closePalette();
      else if ((event.ctrlKey || event.metaKey) && (key === 'k' || key === 'K')) {
        event.preventDefault();
        closePalette();
      }
      return;
    }

    if (state.lightbox) {
      if (key === 'Escape') closeLightbox();
      return;
    }

    if (isTyping(event.target)) {
      if (!state.paletteOpen && !state.findOpen && state.viMode !== 'insert') {
        setMode('insert');
      }
      if (key === 'Escape') {
        event.preventDefault();
        event.target.blur();
        setMode('normal');
      }
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      handleControlKey(event, key);
      return;
    }

    if (event.altKey) return;

    if (state.markPending) {
      handleMark(key);
      return;
    }

    if (state.yPending) {
      if (key === 'y') {
        event.preventDefault();
        startYank();
        return;
      }
      state.yPending = false;
      if (state.yTimer) window.clearTimeout(state.yTimer);
      state.yTimer = 0;
      return;
    }

    if (state.visual) {
      handleVisualKey(event, key);
      return;
    }

    if (/^[1-9]$/.test(key) || (key === '0' && state.count)) {
      event.preventDefault();
      pushCount(key);
      return;
    }

    if (key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      if (event.repeat) return;
      state.spacePending = true;
      if (state.spaceTimer) window.clearTimeout(state.spaceTimer);
      state.spaceTimer = window.setTimeout(function () { state.spacePending = false; }, 1000);
      return;
    }

    if (state.spacePending) {
      state.spacePending = false;
      if (state.spaceTimer) window.clearTimeout(state.spaceTimer);
      state.spaceTimer = 0;
      if (key === 'e' || key === 'E') {
        event.preventDefault();
        clearCount();
        toggleTree();
      }
      return;
    }

    if (state.gPending) {
      state.gPending = false;
      if (state.gTimer) window.clearTimeout(state.gTimer);
      state.gTimer = 0;
      handleGPrefix(event, key);
      return;
    }

    if (key === 'g') {
      state.gPending = true;
      if (state.gTimer) window.clearTimeout(state.gTimer);
      state.gTimer = window.setTimeout(function () { state.gPending = false; }, 1000);
      return;
    }

    handleNormalKey(event, key);
  }

  function handleControlKey(event, key) {
    if (event.metaKey) {
      if (key === 'k' || key === 'K') {
        event.preventDefault();
        if (state.paletteOpen) closePalette(); else openPalette('command');
      }
      return;
    }

    switch (key.toLowerCase()) {
      case 'k':
        event.preventDefault();
        if (state.paletteOpen) closePalette(); else openPalette('command');
        break;
      case 'b':
        event.preventDefault();
        pageScroll(-takeCount());
        break;
      case 'f':
        event.preventDefault();
        pageScroll(takeCount());
        break;
      case 'd':
        event.preventDefault();
        pageScroll(takeCount() * 0.5);
        break;
      case 'u':
        event.preventDefault();
        pageScroll(takeCount() * -0.5);
        break;
      case 'o':
        event.preventDefault();
        window.history.back();
        break;
      case 'i':
        event.preventDefault();
        window.history.forward();
        break;
      case '6':
        event.preventDefault();
        cycleTab(-1);
        break;
      default:
        break;
    }
  }

  function handleGPrefix(event, key) {
    var targets = {
      h: routes.home,
      a: routes.archives,
      c: routes.categories,
      x: routes.tags,
      f: routes.friends,
      o: routes.about,
      m: routes.contact
    };
    if (key === 'g') { event.preventDefault(); scrollTop(); clearCount(); return; }
    if (key === '?') { event.preventDefault(); openPalette('help'); clearCount(); return; }
    if (key === 't') { event.preventDefault(); cycleTab(1); return; }
    if (key === 'T') { event.preventDefault(); cycleTab(-1); return; }
    if (targets[key]) {
      event.preventDefault();
      clearCount();
      go(targets[key]);
      return;
    }
    clearCount();
  }

  function handleNormalKey(event, key) {
    switch (key) {
      case 'j':
        event.preventDefault();
        scrollLines(takeCount());
        break;
      case 'k':
        event.preventDefault();
        scrollLines(-takeCount());
        break;
      case 'h':
        event.preventDefault();
        cycleTab(-1);
        break;
      case 'l':
        event.preventDefault();
        cycleTab(1);
        break;
      case 'w':
        event.preventDefault();
        moveHeading(1, takeCount());
        break;
      case 'b':
        event.preventDefault();
        moveHeading(-1, takeCount());
        break;
      case '0':
        event.preventDefault();
        clearCount();
        firstHeading();
        break;
      case '$':
        event.preventDefault();
        clearCount();
        lastHeading();
        break;
      case 'H':
        event.preventDefault();
        clearCount();
        firstHeading();
        break;
      case 'M':
        event.preventDefault();
        clearCount();
        middleHeading();
        break;
      case 'L':
        event.preventDefault();
        clearCount();
        lastHeading();
        break;
      case 'G':
        event.preventDefault();
        clearCount();
        scrollBottom();
        break;
      case 'n':
        event.preventDefault();
        clearCount();
        repeatFind(false);
        break;
      case 'N':
        event.preventDefault();
        clearCount();
        repeatFind(true);
        break;
      case '/':
        event.preventDefault();
        clearCount();
        openFind(false);
        break;
      case '?':
        event.preventDefault();
        clearCount();
        openFind(true);
        break;
      case ':':
        event.preventDefault();
        clearCount();
        openPalette('command');
        break;
      case 'v':
      case 'V':
        event.preventDefault();
        clearCount();
        enterVisual();
        break;
      case 'y':
        event.preventDefault();
        clearCount();
        startYank();
        break;
      case 'Y':
        event.preventDefault();
        clearCount();
        copyBlock();
        break;
      case 'm':
        event.preventDefault();
        clearCount();
        startMark('set');
        break;
      case "'":
      case '`':
        event.preventDefault();
        clearCount();
        startMark('jump');
        break;
      case 'Escape':
        event.preventDefault();
        clearCount();
        state.gPending = false;
        state.spacePending = false;
        state.markPending = null;
        state.yPending = false;
        if (body.classList.contains('drawer-open')) setDrawer(false);
        if (state.visual) exitVisual();
        setMode('normal');
        break;
      case 'd':
      case 'c':
      case 'p':
      case 'u':
        event.preventDefault();
        clearCount();
        toast('页面为只读，无法执行编辑操作');
        break;
      default:
        clearCount();
        break;
    }
  }

  function handleVisualKey(event, key) {
    if (/^[1-9]$/.test(key) || (key === '0' && state.count)) {
      event.preventDefault();
      pushCount(key);
      return;
    }
    if (key === 'j') {
      event.preventDefault();
      moveVisual(1);
      return;
    }
    if (key === 'k') {
      event.preventDefault();
      moveVisual(-1);
      return;
    }
    if (key === 'y') {
      event.preventDefault();
      yankVisual();
      return;
    }
    if (key === 'o') {
      event.preventDefault();
      var anchor = state.visualAnchor;
      state.visualAnchor = state.visualIndex;
      state.visualIndex = anchor;
      selectVisual();
      return;
    }
    if (key === 'v' || key === 'V' || key === 'Escape') {
      event.preventDefault();
      exitVisual();
      return;
    }
    if (key === 'd' || key === 'c') {
      event.preventDefault();
      toast('页面为只读，无法删除或修改');
      return;
    }
    clearCount();
  }

  /* -------------------------------- boot ---------------------------------- */
  function init() {
    initTree();
    initTabs();
    initPalette();
    initScroll();
    initToc();
    initClock();
    initCode();
    initTables();
    initImages();
    initLinks();
    initTagFilter();
    initKeyboard();
    setMode('normal');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
