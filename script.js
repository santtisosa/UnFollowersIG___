(function () {
  const QUERY_HASH = '3dec7e2c57367ef3da3d987d89f9dbc8';
  const WL_KEY     = 'iu_whitelist';

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function getCookie(name) {
    const pair = document.cookie.split('; ').find(c => c.startsWith(name + '='));
    return pair ? decodeURIComponent(pair.split('=')[1]) : null;
  }

  function loadWL()     { try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]'); } catch { return []; } }
  function saveWL(list) { localStorage.setItem(WL_KEY, JSON.stringify(list)); }

  async function fetchPage(userId, cursor) {
    const vars = JSON.stringify(Object.assign(
      { id: userId, include_reel: 'true', fetch_mutual: 'false', first: '50' },
      cursor ? { after: cursor } : {}
    ));
    const url = 'https://www.instagram.com/graphql/query/?query_hash=' + QUERY_HASH + '&variables=' + encodeURIComponent(vars);
    const res = await fetch(url, { headers: { 'x-requested-with': 'XMLHttpRequest' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return (await res.json()).data.user.edge_follow;
  }

  async function fetchAll(userId, onProgress) {
    const users = [];
    let cursor = null, more = true;
    while (more) {
      const page = await fetchPage(userId, cursor);
      page.edges.forEach(e => users.push(e.node));
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

  var users = [], whitelist = loadWL(), tab = 'nonfollowers', search = '', selected = {}, csrf = null;
  var listEl, statusEl, tabEls = {};

  function isWL(u) { return whitelist.some(w => w.id === u.id); }

  function visible() {
    var pool = tab === 'whitelist'
      ? users.filter(u => isWL(u))
      : users.filter(u => !u.follows_viewer && !isWL(u));
    if (!search) return pool;
    var q = search.toLowerCase();
    return pool.filter(u => u.username.toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q));
  }

  var C = { bg: '#000', border: '#1c1c1c', text: '#fff', muted: '#555', danger: '#ff453a', font: 'monospace' };

  function st(obj) {
    return Object.keys(obj).map(k => k.replace(/([A-Z])/g, m => '-' + m.toLowerCase()) + ':' + obj[k]).join(';');
  }

  function mk(tag, styles, props) {
    var e = document.createElement(tag);
    if (styles) e.style.cssText = st(styles);
    if (props) Object.keys(props).forEach(k => {
      if (k === 'text') e.textContent = props[k];
      else e[k] = props[k];
    });
    return e;
  }

  function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }

  function render() {
    if (!listEl) return;
    var vis = visible();
    listEl.innerHTML = '';

    if (!vis.length) {
      listEl.appendChild(mk('div', {
        padding: '48px', textAlign: 'center', fontSize: '11px', color: C.muted,
      }, { text: 'empty' }));
      return;
    }

    vis.forEach(u => {
      var isSel = !!selected[u.id];
      var row = mk('div', {
        display: 'flex', alignItems: 'center', padding: '9px 14px',
        borderBottom: '1px solid ' + C.border, gap: '10px', cursor: 'pointer',
        background: isSel ? '#0a0a0a' : 'none',
      });

      var chk = mk('div', {
        width: '9px', height: '9px', flexShrink: '0',
        border: '1px solid ' + (isSel ? C.text : '#2a2a2a'),
        background: isSel ? C.text : 'none',
      });

      var avatar = mk('img', {
        width: '26px', height: '26px', borderRadius: '50%', flexShrink: '0',
      }, { src: u.profile_pic_url });

      var info = mk('div', { flex: '1', overflow: 'hidden' });
      info.appendChild(mk('div', {
        fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }, { text: u.username + (u.is_verified ? ' ✓' : '') + (u.is_private ? ' 🔒' : '') }));
      if (u.full_name) info.appendChild(mk('div', {
        fontSize: '10px', color: C.muted, marginTop: '2px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }, { text: u.full_name }));

      var wlBtn = mk('button', {
        background: 'none', border: 'none', color: isWL(u) ? C.muted : '#333',
        fontFamily: C.font, fontSize: '14px', cursor: 'pointer', flexShrink: '0',
        padding: '0 2px', lineHeight: '1',
      }, { text: isWL(u) ? '−' : '+' });
      wlBtn.addEventListener('click', e => { e.stopPropagation(); toggleWL(u); });

      row.addEventListener('click', () => {
        if (selected[u.id]) delete selected[u.id];
        else selected[u.id] = true;
        render();
      });

      row.append(chk, avatar, info, wlBtn);
      listEl.appendChild(row);
    });
  }

  function switchTab(t) {
    tab = t; selected = {}; search = '';
    Object.keys(tabEls).forEach(k => {
      tabEls[k].style.borderBottom = k === t ? '1px solid ' + C.text : '1px solid transparent';
      tabEls[k].style.color        = k === t ? C.text : C.muted;
    });
    render();
  }

  function toggleWL(u) {
    if (isWL(u)) whitelist = whitelist.filter(w => w.id !== u.id);
    else whitelist.push({ id: u.id, username: u.username });
    saveWL(whitelist);
    render();
  }

  async function unfollowSelected() {
    var ids = Object.keys(selected);
    if (!ids.length) return;
    if (!confirm('unfollow ' + ids.length + ' user(s)?')) return;
    for (var i = 0; i < ids.length; i++) {
      setStatus((i + 1) + '/' + ids.length + ' unfollowed');
      try { await doUnfollow(ids[i], csrf); } catch { /* skip */ }
      users = users.filter(u => u.id !== ids[i]);
      delete selected[ids[i]];
      if (i < ids.length - 1) await sleep(1500);
    }
    setStatus('done');
    render();
  }

  function download(name, content, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function buildPanel() {
    var overlay = mk('div', {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.35)',
      zIndex: '2147483646', display: 'flex', justifyContent: 'flex-end',
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    var panel = mk('div', {
      width: '300px', height: '100%', background: C.bg,
      borderLeft: '1px solid ' + C.border, display: 'flex',
      flexDirection: 'column', fontFamily: C.font, color: C.text,
    });

    var header = mk('div', {
      padding: '13px 14px', borderBottom: '1px solid ' + C.border,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: '0',
    });
    statusEl = mk('span', { fontSize: '10px', color: C.muted, flex: '1' }, { text: '' });
    var xBtn = mk('button', {
      background: 'none', border: 'none', color: C.muted, fontFamily: C.font,
      fontSize: '12px', cursor: 'pointer', padding: '0',
    }, { text: '✕' });
    xBtn.addEventListener('click', () => overlay.remove());
    header.append(mk('span', { fontSize: '11px', marginRight: '10px' }, { text: 'unfollowers' }), statusEl, xBtn);

    var tabBar = mk('div', { display: 'flex', borderBottom: '1px solid ' + C.border, flexShrink: '0' });
    [['nonfollowers', 'non-followers'], ['whitelist', 'whitelist']].forEach(([key, label]) => {
      var b = mk('button', {
        flex: '1', padding: '10px', background: 'none', border: 'none',
        borderBottom: key === tab ? '1px solid ' + C.text : '1px solid transparent',
        color: key === tab ? C.text : C.muted, fontFamily: C.font,
        fontSize: '10px', cursor: 'pointer',
      }, { text: label });
      b.addEventListener('click', () => switchTab(key));
      tabEls[key] = b;
      tabBar.appendChild(b);
    });

    var searchWrap = mk('div', { padding: '8px 14px', borderBottom: '1px solid ' + C.border, flexShrink: '0' });
    var searchIn = mk('input', {
      width: '100%', background: 'none', border: 'none', borderBottom: '1px solid #1e1e1e',
      color: C.text, fontFamily: C.font, fontSize: '10px', padding: '3px 0',
      outline: 'none', boxSizing: 'border-box',
    }, { placeholder: 'search...' });
    searchIn.addEventListener('input', e => { search = e.target.value; render(); });
    searchWrap.appendChild(searchIn);

    listEl = mk('div', { flex: '1', overflowY: 'auto' });

    var foot = mk('div', {
      padding: '10px 14px', borderTop: '1px solid ' + C.border,
      display: 'flex', gap: '6px', flexShrink: '0',
    });

    function fbtn(label, danger) {
      return mk('button', {
        flex: '1', padding: '8px 4px', fontFamily: C.font, fontSize: '10px',
        cursor: 'pointer', border: '1px solid ' + (danger ? C.danger : '#1e1e1e'),
        background: 'none', color: danger ? C.danger : C.muted,
      }, { text: label });
    }

    var selAllBtn = fbtn('select all');
    selAllBtn.addEventListener('click', () => {
      var vis = visible();
      if (Object.keys(selected).length === vis.length) selected = {};
      else { selected = {}; vis.forEach(u => { selected[u.id] = true; }); }
      render();
    });

    var unfBtn = fbtn('unfollow', true);
    unfBtn.addEventListener('click', unfollowSelected);

    var expBtn = fbtn('export');
    expBtn.addEventListener('click', () => {
      var data = visible().map(u => ({ id: u.id, username: u.username, full_name: u.full_name }));
      download('unfollowers.json', JSON.stringify(data, null, 2), 'application/json');
    });

    foot.append(selAllBtn, unfBtn, expBtn);
    panel.append(header, tabBar, searchWrap, listEl, foot);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  async function run() {
    var userId = getCookie('ds_user_id');
    csrf       = getCookie('csrftoken');
    if (!userId || !csrf) { alert('not logged in to instagram'); return; }
    try {
      setStatus('scanning...');
      users = await fetchAll(userId, n => setStatus(n + ' fetched'));
      selected = {};
      setStatus(users.filter(u => !u.follows_viewer).length + ' non-followers');
      render();
    } catch (err) {
      setStatus('error: ' + err.message);
    }
  }

  buildPanel();

  var runOv = mk('div', {
    position: 'fixed', inset: '0', background: '#000',
    zIndex: '2147483647', display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  var runBtn = mk('button', {
    fontFamily: C.font, fontSize: '12px', letterSpacing: '4px',
    background: '#fff', color: '#000', border: 'none', padding: '14px 36px', cursor: 'pointer',
  }, { text: 'run' });
  runBtn.onmouseover = function() { this.style.background = '#ccc'; };
  runBtn.onmouseout  = function() { this.style.background = '#fff'; };
  runBtn.addEventListener('click', () => { runOv.remove(); run(); });

  runOv.appendChild(runBtn);
  document.body.appendChild(runOv);
})();
