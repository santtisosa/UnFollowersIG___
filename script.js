(function () {
  // ─── constants ───────────────────────────────────────────────────────────────
  const QUERY_HASH = '3dec7e2c57367ef3da3d987d89f9dbc8';
  const WL_KEY     = 'iu_whitelist';
  const FONT_URL   = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';

  // ─── utils ───────────────────────────────────────────────────────────────────
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function getCookie(name) {
    const pair = document.cookie.split('; ').find(c => c.startsWith(name + '='));
    return pair ? decodeURIComponent(pair.split('=')[1]) : null;
  }

  function loadWL()     { try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]'); } catch (e) { return []; } }
  function saveWL(list) { localStorage.setItem(WL_KEY, JSON.stringify(list)); }

  // ─── api ─────────────────────────────────────────────────────────────────────
  async function fetchPage(userId, cursor) {
    const vars = JSON.stringify(Object.assign(
      { id: userId, include_reel: 'true', fetch_mutual: 'false', first: '50' },
      cursor ? { after: cursor } : {}
    ));
    const url = 'https://www.instagram.com/graphql/query/?query_hash=' + QUERY_HASH + '&variables=' + encodeURIComponent(vars);
    const res = await fetch(url, { headers: { 'x-requested-with': 'XMLHttpRequest' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    return json.data.user.edge_follow;
  }

  async function fetchAll(userId, onProgress) {
    const users = [];
    let cursor  = null;
    let more    = true;
    while (more) {
      const page = await fetchPage(userId, cursor);
      page.edges.forEach(function(e) { users.push(e.node); });
      more   = page.page_info.has_next_page;
      cursor = page.page_info.end_cursor;
      onProgress(users.length);
      if (more) await sleep(1200);
    }
    return users;
  }

  async function doUnfollow(userId, csrf) {
    const res = await fetch('https://www.instagram.com/web/friendships/' + userId + '/unfollow/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrftoken': csrf },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
  }

  // ─── state ───────────────────────────────────────────────────────────────────
  var users     = [];
  var whitelist = loadWL();
  var tab       = 'nonfollowers';
  var search    = '';
  var selected  = {};
  var statusPh  = 'idle';
  var csrf      = null;
  var listEl, statusEl, counterEl, tabEls = {};

  function isWL(u) { return whitelist.some(function(w) { return w.id === u.id; }); }

  function selCount() { return Object.keys(selected).length; }

  function visible() {
    var pool = tab === 'whitelist'
      ? users.filter(function(u) { return isWL(u); })
      : users.filter(function(u) { return !u.follows_viewer && !isWL(u); });
    if (!search) return pool;
    var q = search.toLowerCase();
    return pool.filter(function(u) {
      return u.username.toLowerCase().indexOf(q) !== -1 || (u.full_name || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  // ─── design tokens ───────────────────────────────────────────────────────────
  var C = {
    bg: '#000', surface: '#080808', border: '#1a1a1a',
    text: '#fff', muted: '#555', dim: '#222', danger: '#ff453a',
    font: '"Press Start 2P", monospace',
  };

  function st(obj) {
    return Object.keys(obj).map(function(k) {
      return k.replace(/([A-Z])/g, function(m) { return '-' + m.toLowerCase(); }) + ':' + obj[k];
    }).join(';');
  }

  function mk(tag, styles, props) {
    var e = document.createElement(tag);
    if (styles) e.style.cssText = st(styles);
    if (props) Object.keys(props).forEach(function(k) {
      if (k === 'text') e.textContent = props[k];
      else e[k] = props[k];
    });
    return e;
  }

  // ─── status ──────────────────────────────────────────────────────────────────
  function setStatus(phase, n, err) {
    statusPh = phase;
    if (!statusEl) return;
    var msgs = {
      idle:        'READY',
      scanning:    'SCANNING... ' + (n || 0) + ' FETCHED',
      done:        'DONE — ' + (n || 0) + ' FOLLOWING SCANNED',
      error:       'ERROR: ' + (err || ''),
      unfollowing: 'UNFOLLOWING... ' + (n || 0) + ' LEFT',
    };
    statusEl.textContent = msgs[phase] || '';
  }

  // ─── render list ─────────────────────────────────────────────────────────────
  function render() {
    if (!listEl) return;
    var vis = visible();
    counterEl.textContent = vis.length + ' ACCOUNTS';
    listEl.innerHTML = '';

    if (!vis.length) {
      listEl.appendChild(mk('div', {
        padding: '40px 20px', textAlign: 'center', fontSize: '7px', color: C.muted,
      }, { text: statusPh === 'idle' ? 'PRESS RUN TO START' : 'NOTHING HERE' }));
      return;
    }

    vis.forEach(function(u) {
      var isSel = !!selected[u.id];
      var row = mk('div', {
        display: 'flex', alignItems: 'center', padding: '10px 14px',
        borderBottom: '1px solid ' + C.border, gap: '10px', cursor: 'pointer',
        background: isSel ? '#0c0c0c' : 'none',
      });

      var chk = mk('div', {
        width: '10px', height: '10px', flexShrink: '0',
        border: '1px solid ' + (isSel ? C.text : C.dim),
        background: isSel ? C.text : 'none',
      });

      var avatar = mk('img', {
        width: '28px', height: '28px', borderRadius: '50%',
        objectFit: 'cover', flexShrink: '0', background: C.surface,
      }, { src: u.profile_pic_url });

      var info = mk('div', { flex: '1', overflow: 'hidden' });
      var uname = mk('div', {
        fontSize: '7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }, { text: u.username + (u.is_verified ? ' ✓' : '') + (u.is_private ? ' 🔒' : '') });
      var fname = mk('div', {
        fontSize: '6px', color: C.muted, marginTop: '3px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }, { text: u.full_name || '' });
      info.append(uname, fname);

      var wlBtn = mk('button', {
        background: 'none', border: '1px solid ' + C.dim, color: C.muted,
        fontFamily: C.font, fontSize: '5px', padding: '4px 5px',
        cursor: 'pointer', flexShrink: '0',
      }, { text: isWL(u) ? 'WL −' : 'WL +' });
      wlBtn.addEventListener('click', function(e) { e.stopPropagation(); toggleWL(u); });

      row.addEventListener('click', function() {
        if (selected[u.id]) delete selected[u.id];
        else selected[u.id] = true;
        render();
      });

      row.append(chk, avatar, info, wlBtn);
      listEl.appendChild(row);
    });
  }

  // ─── actions ─────────────────────────────────────────────────────────────────
  function switchTab(t) {
    tab = t; selected = {}; search = '';
    Object.keys(tabEls).forEach(function(k) {
      tabEls[k].style.borderBottom = k === t ? '2px solid ' + C.text : '2px solid transparent';
      tabEls[k].style.color        = k === t ? C.text : C.muted;
    });
    render();
  }

  function toggleWL(u) {
    if (isWL(u)) whitelist = whitelist.filter(function(w) { return w.id !== u.id; });
    else whitelist.push({ id: u.id, username: u.username });
    saveWL(whitelist);
    render();
  }

  async function unfollowSelected() {
    var ids = Object.keys(selected);
    if (!ids.length) return;
    if (!confirm('Unfollow ' + ids.length + ' user(s)?')) return;
    for (var i = 0; i < ids.length; i++) {
      setStatus('unfollowing', ids.length - i);
      try { await doUnfollow(ids[i], csrf); } catch (e) { /* skip */ }
      users = users.filter(function(u) { return u.id !== ids[i]; });
      delete selected[ids[i]];
      if (i < ids.length - 1) await sleep(1500);
    }
    setStatus('done', users.length);
    render();
  }

  function download(name, content, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ─── build panel ─────────────────────────────────────────────────────────────
  function buildPanel() {
    var overlay = mk('div', {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.5)',
      zIndex: '2147483646', display: 'flex', justifyContent: 'flex-end',
    });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

    var panel = mk('div', {
      width: '340px', height: '100%', background: C.bg,
      borderLeft: '1px solid ' + C.border, display: 'flex',
      flexDirection: 'column', fontFamily: C.font, color: C.text,
    });

    // header
    var header = mk('div', {
      padding: '16px 14px', borderBottom: '1px solid ' + C.border,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: '0',
    });
    var xBtn = mk('button', {
      background: 'none', border: 'none', color: C.muted, fontFamily: C.font,
      fontSize: '9px', cursor: 'pointer', padding: '0',
    }, { text: '✕' });
    xBtn.addEventListener('click', function() { overlay.remove(); });
    header.append(mk('span', { fontSize: '9px', letterSpacing: '2px' }, { text: 'UNFOLLOWERS' }), xBtn);

    // status
    statusEl = mk('div', {
      padding: '7px 14px', fontSize: '6px', color: C.muted,
      borderBottom: '1px solid ' + C.border, flexShrink: '0',
      minHeight: '26px', display: 'flex', alignItems: 'center',
    });
    setStatus('idle');

    // tabs
    var tabBar = mk('div', { display: 'flex', borderBottom: '1px solid ' + C.border, flexShrink: '0' });
    [['nonfollowers', 'NON-FOLLOWERS'], ['whitelist', 'WHITELIST']].forEach(function(pair) {
      var key = pair[0], label = pair[1];
      var b = mk('button', {
        flex: '1', padding: '11px 4px', background: 'none', border: 'none',
        borderBottom: key === tab ? '2px solid ' + C.text : '2px solid transparent',
        color: key === tab ? C.text : C.muted, fontFamily: C.font,
        fontSize: '6px', cursor: 'pointer',
      }, { text: label });
      b.addEventListener('click', function() { switchTab(key); });
      tabEls[key] = b;
      tabBar.appendChild(b);
    });

    // search
    var searchWrap = mk('div', { padding: '9px 14px', borderBottom: '1px solid ' + C.border, flexShrink: '0' });
    var searchIn = mk('input', {
      width: '100%', background: C.surface, border: '1px solid ' + C.border,
      color: C.text, fontFamily: C.font, fontSize: '6px', padding: '7px 8px',
      outline: 'none', boxSizing: 'border-box',
    }, { placeholder: 'SEARCH...' });
    searchIn.addEventListener('input', function(e) { search = e.target.value; render(); });
    searchWrap.appendChild(searchIn);

    // counter
    counterEl = mk('div', {
      padding: '5px 14px', fontSize: '6px', color: C.dim,
      borderBottom: '1px solid ' + C.border, flexShrink: '0',
    }, { text: '' });

    // list
    listEl = mk('div', { flex: '1', overflowY: 'auto' });

    // footer buttons
    var foot = mk('div', {
      padding: '10px 14px', borderTop: '1px solid ' + C.border,
      display: 'flex', gap: '5px', flexShrink: '0', flexWrap: 'wrap',
    });

    function fbtn(label, danger) {
      return mk('button', {
        flex: '1', padding: '8px 3px', fontFamily: C.font, fontSize: '5px',
        cursor: 'pointer', border: '1px solid ' + (danger ? C.danger : C.dim),
        background: 'none', color: danger ? C.danger : C.muted, minWidth: '60px',
      }, { text: label });
    }

    var selAllBtn = fbtn('SELECT ALL');
    selAllBtn.addEventListener('click', function() {
      var vis = visible();
      if (Object.keys(selected).length === vis.length) selected = {};
      else { selected = {}; vis.forEach(function(u) { selected[u.id] = true; }); }
      render();
    });

    var unfBtn = fbtn('UNFOLLOW', true);
    unfBtn.addEventListener('click', unfollowSelected);

    var expBtn = fbtn('EXPORT');
    expBtn.addEventListener('click', function() {
      var data = visible().map(function(u) { return { id: u.id, username: u.username, full_name: u.full_name }; });
      download('unfollowers-' + Date.now() + '.json', JSON.stringify(data, null, 2), 'application/json');
    });

    var wlExpBtn = fbtn('WL EXPORT');
    wlExpBtn.addEventListener('click', function() {
      if (!whitelist.length) return alert('Whitelist empty.');
      download('whitelist-' + Date.now() + '.json', JSON.stringify(whitelist, null, 2), 'application/json');
    });

    var wlImpBtn = fbtn('WL IMPORT');
    wlImpBtn.addEventListener('click', function() {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json';
      inp.onchange = function(e) {
        var r = new FileReader();
        r.onload = function(ev) {
          try {
            var data = JSON.parse(ev.target.result);
            if (!Array.isArray(data)) return alert('Invalid format.');
            data.forEach(function(u) { if (!whitelist.some(function(w) { return w.id === u.id; })) whitelist.push(u); });
            saveWL(whitelist); render();
          } catch (err) { alert('Invalid JSON.'); }
        };
        r.readAsText(e.target.files[0]);
      };
      inp.click();
    });

    foot.append(selAllBtn, unfBtn, expBtn, wlExpBtn, wlImpBtn);
    panel.append(header, statusEl, tabBar, searchWrap, counterEl, listEl, foot);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  // ─── scan ────────────────────────────────────────────────────────────────────
  async function run() {
    var userId = getCookie('ds_user_id');
    csrf       = getCookie('csrftoken');
    if (!userId || !csrf) { alert('Not logged in to Instagram.'); return; }
    try {
      setStatus('scanning', 0);
      users    = await fetchAll(userId, function(n) { setStatus('scanning', n); });
      selected = {};
      setStatus('done', users.length);
      render();
    } catch (err) {
      setStatus('error', 0, err.message);
    }
  }

  // ─── init ────────────────────────────────────────────────────────────────────
  var fl = document.createElement('link');
  fl.rel = 'stylesheet'; fl.href = FONT_URL;
  document.head.appendChild(fl);

  buildPanel();

  var runOv = mk('div', {
    position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.92)',
    zIndex: '2147483647', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexDirection: 'column', gap: '14px',
  });

  var runBtn = mk('button', {
    fontFamily: C.font, fontSize: '16px', letterSpacing: '6px',
    background: '#fff', color: '#000', border: 'none', padding: '20px 48px', cursor: 'pointer',
  }, { text: 'RUN' });
  runBtn.onmouseover = function() { this.style.background = '#d0d0d0'; };
  runBtn.onmouseout  = function() { this.style.background = '#fff'; };
  runBtn.addEventListener('click', function() { runOv.remove(); run(); });

  runOv.append(
    runBtn,
    mk('div', { fontFamily: C.font, fontSize: '6px', color: '#444' }, { text: 'instagram must be open' })
  );
  document.body.appendChild(runOv);

})();
