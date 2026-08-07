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
  document.querySelectorAll('form.decide').forEach(function (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var approved = ev.submitter && ev.submitter.value === 'yes';
      fetch('/inbox/ui/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: form.dataset.id, approved: approved, who: form.elements.who.value })
      })
        .then(function (r) { if (r.ok) location.reload(); else return r.text().then(function (t) { alert(t); }); })
        .catch(function (e) { alert('failed: ' + e); });
    });
  });

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
      t.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (t.value.trim()) t.form.submit();
        }
      });
      t.focus();
    }
  }
})();
