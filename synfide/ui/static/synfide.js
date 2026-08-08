/* Synfide operator surfaces — the few behaviors worth having without a build:
   remember who approves, never refresh mid-typing, keep the chat at the
   bottom. Every page works with JavaScript disabled too. */
(function () {
  // Remember the approver's name across visits (per browser, never sent anywhere).
  try {
    var who = document.querySelectorAll('input[name=who]');
    var saved = localStorage.getItem('synfide-who');
    if (saved) who.forEach(function (i) { if (!i.value) i.value = saved; });
    document.addEventListener('submit', function (e) {
      var i = e.target.querySelector && e.target.querySelector('input[name=who]');
      if (i && i.value) localStorage.setItem('synfide-who', i.value);
    });
  } catch (_) {}

  var body = document.body;

  // Pages that asked for it (the inbox) reload every 8s — but NEVER while a
  // field has focus: an auto-refresh must not eat what a human is typing.
  if (body.dataset.refresh) {
    setInterval(function () {
      var a = document.activeElement;
      if (!(a && /INPUT|TEXTAREA/.test(a.tagName))) location.reload();
    }, 8000);
  }

  // First-run wizard and sign-in: both post JSON; the server answers with the
  // session cookie (HttpOnly — this script never sees it).
  var authForm = document.querySelector('.authform');
  if (authForm) {
    authForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = authForm.elements;
      var mode = authForm.dataset.mode;
      var payload = mode === 'setup'
        ? { name: f.name.value, pass: f.pass.value, pass2: f.pass2.value, code: f.code.value }
        : { name: f.name.value, pass: f.pass.value };
      fetch(mode === 'setup' ? '/setup/submit' : '/login/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, t: t }; }); })
        .then(function (res) {
          var m = authForm.querySelector('[data-msg]');
          if (!res.ok) { m.textContent = res.t; m.className = 'envmsg bad'; return; }
          location.href = '/';
        })
        .catch(function (e) { var m = authForm.querySelector('[data-msg]'); m.textContent = 'failed: ' + e; m.className = 'envmsg bad'; });
    });
  }

  // Approval decisions post JSON (a cross-site form can't forge that: the
  // preflight dies without CORS and the Lax cookie stays home).
  // In-flight discipline everywhere: while a decision travels, its buttons
  // are dead — a still-clickable button reads as a hang and invites double
  // submissions.
  var lockForm = function (form) {
    form.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
  };
  var unlockForm = function (form) {
    form.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
  };
  document.querySelectorAll('form.decide').forEach(function (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (form.dataset.busy) return;
      form.dataset.busy = '1';
      var approved = ev.submitter && ev.submitter.value === 'yes';
      setTimeout(function () { lockForm(form); }, 0);
      fetch('/inbox/ui/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: form.dataset.id, approved: approved, who: form.elements.who.value })
      })
        .then(function (r) { if (r.ok) location.reload(); else return r.text().then(function (t) { alert(t); delete form.dataset.busy; unlockForm(form); }); })
        .catch(function (e) { alert('failed: ' + e); delete form.dataset.busy; unlockForm(form); });
    });
  });

  // Approve-all: one click for the batch case (an agent building a site
  // proposes several patches). Confirmation first; code-protected approvals
  // are skipped server-side, never bulk-approved.
  var allForm = document.getElementById('decideall');
  if (allForm) {
    allForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (allForm.dataset.busy) return;
      if (!window.confirm('Approve ALL pending items? (code-protected ones are skipped)')) return;
      allForm.dataset.busy = '1';
      lockForm(allForm);
      fetch('/inbox/ui/decide_all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ who: allForm.elements.who.value })
      })
        .then(function (r) { if (r.ok) location.reload(); else return r.text().then(function (t) { alert(t); delete allForm.dataset.busy; unlockForm(allForm); }); })
        .catch(function (e) { alert('failed: ' + e); delete allForm.dataset.busy; unlockForm(allForm); });
    });
  }

  // Chat sessions: switch via the picker, start fresh, archive the current
  // one. Closing never deletes — history stays searchable via the lens.
  var pick = document.getElementById('sesspick');
  if (pick) {
    pick.addEventListener('change', function () {
      location.href = '/chat?session=' + encodeURIComponent(pick.value);
    });
  }
  var sessNew = document.getElementById('sessnew');
  if (sessNew) {
    sessNew.addEventListener('click', function () {
      if (sessNew.disabled) return;
      sessNew.disabled = true;
      fetch('/chat/session/new', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(function (r) { if (r.ok) location.href = '/chat'; else return r.text().then(function (t) { alert(t); sessNew.disabled = false; }); })
        .catch(function (e) { alert('failed: ' + e); sessNew.disabled = false; });
    });
  }
  var sessClose = document.getElementById('sessclose');
  if (sessClose) {
    sessClose.addEventListener('click', function () {
      if (sessClose.disabled) return;
      if (!window.confirm('Close this session? It becomes read-only (still searchable).')) return;
      sessClose.disabled = true;
      fetch('/chat/session/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sessClose.dataset.id }) })
        .then(function (r) { if (r.ok) location.href = '/chat'; else return r.text().then(function (t) { alert(t); sessClose.disabled = false; }); })
        .catch(function (e) { alert('failed: ' + e); sessClose.disabled = false; });
    });
  }

  // Autopilot: a time-boxed standing approval for patches, granted (and
  // revoked) from the chat. Every control goes BUSY while its request is in
  // flight — a clickable-again button read as "is this thing on?".
  var apBusy = false;
  var apSet = function (minutes, btn) {
    if (apBusy) return;
    apBusy = true;
    var label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    var sel = document.querySelector('#apform select');
    if (sel) sel.disabled = true;
    fetch('/admin/autopilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes: minutes })
    })
      .then(function (r) { if (r.ok) location.reload(); else return r.text().then(function (t) { alert(t); apBusy = false; if (btn) { btn.disabled = false; btn.textContent = label; } if (sel) sel.disabled = false; }); })
      .catch(function (e) { alert('failed: ' + e); apBusy = false; if (btn) { btn.disabled = false; btn.textContent = label; } if (sel) sel.disabled = false; });
  };
  var apForm = document.getElementById('apform');
  if (apForm) {
    apForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      apSet(parseInt(apForm.elements.minutes.value, 10), apForm.querySelector('button'));
    });
  }
  var apOff = document.getElementById('apoff');
  if (apOff) apOff.addEventListener('click', function () { apSet(0, apOff); });


  // The write-only env editor: value goes out as JSON exactly once, is never
  // echoed back, and every save needs the one-time code the server prints to
  // ITS terminal (Request code). Without JS, the page still explains the
  // by-hand path (edit .env directly).
  var envForm = document.getElementById('envset');
  if (envForm) {
    var msg = document.getElementById('envmsg');
    var say = function (t, bad) { msg.textContent = t; msg.className = 'envmsg' + (bad ? ' bad' : ''); };
    document.getElementById('envcode').addEventListener('click', function () {
      fetch('/admin/env/code', { method: 'POST' })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.statusText); })
        .then(function () { say('Code printed on the SERVER terminal — copy it into the field.'); })
        .catch(function (e) { say('Could not request a code: ' + e, true); });
    });
    envForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = envForm.elements;
      // A typed "new variable" name wins over the picker — that's how a var
      // the framework never heard of (your Supabase, your WABA) gets created.
      var newname = f.newname ? f.newname.value.trim() : '';
      fetch('/admin/env/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newname || f.name.value, value: f.value.value, code: f.code.value })
      })
        .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, t: t }; }); })
        .then(function (res) {
          if (!res.ok) return say(res.t, true);
          f.value.value = ''; f.code.value = '';
          if (f.newname) f.newname.value = '';
          say('Saved to .env — restart the server to apply.');
          setTimeout(function () { location.reload(); }, 1200);
        })
        .catch(function (e) { say('Save failed: ' + e, true); });
    });
  }

  // The chat opens at its latest message, composer focused. The composer is a
  // textarea: Enter sends, Shift+Enter makes a new line, and it grows with the
  // text (up to a cap). Without JS it still works — type and click Send.
  if (body.dataset.scroll) {
    window.scrollTo(0, document.body.scrollHeight);
    var t = document.querySelector('.send textarea');
    if (t) {
      var grow = function () {
        t.style.height = 'auto';
        t.style.height = Math.min(t.scrollHeight, 160) + 'px';
      };
      t.addEventListener('input', grow);
      grow();
      // The agent may take SECONDS to answer, so the send goes out as a
      // background fetch — the page does NOT navigate while it thinks (no
      // browser spinner, no reload feel). One flag stops the double-send
      // (Enter again while loading used to submit twice), the composer
      // locks, and the user's bubble plus an animated "thinking" bubble
      // appear instantly. When the answer lands, one quick reload paints
      // the real history. Without JS the form still navigates natively.
      var sending = false;
      var go = function () {
        var message = t.value.trim();
        if (sending || !message) return;
        sending = true;
        // the fetch carries the message — the composer empties and goes
        // fully quiet while the agent thinks (a written-but-sent message
        // lingering in the box read as "did it even send?")
        t.value = '';
        t.style.height = 'auto';
        t.disabled = true;
        t.placeholder = 'the agent is working on it…';
        var btn = t.form.querySelector('button');
        if (btn) btn.disabled = true;
        var chat = document.querySelector('.chat');
        if (chat) {
          var mine = document.createElement('div');
          mine.className = 'msg user';
          var ms = document.createElement('span');
          ms.textContent = message;
          mine.appendChild(ms);
          chat.appendChild(mine);
          var think = document.createElement('div');
          think.className = 'msg assistant thinking';
          think.innerHTML = '<span><i class="dot"></i><i class="dot"></i><i class="dot"></i></span>';
          chat.appendChild(think);
          window.scrollTo(0, document.body.scrollHeight);
        }
        fetch(t.form.action + '?message=' + encodeURIComponent(message))
          .then(function () { location.reload(); })
          .catch(function () { location.reload(); });
      };
      t.form.addEventListener('submit', function (e) { e.preventDefault(); go(); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          go();
        }
      });
      t.focus();
    }
  }
})();
