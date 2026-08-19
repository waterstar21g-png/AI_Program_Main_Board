/** 로그인 브릿지 — 사전정의 ID/PW로 로그인 절차 수행 */
(function () {
  const params = new URLSearchParams(location.search);
  const siteId = params.get("site") || "";
  const statusEl = document.getElementById("status");
  const detailEl = document.getElementById("detail");
  const actionsEl = document.getElementById("actions");

  function setStatus(title, detail) {
    if (statusEl) statusEl.textContent = title;
    if (detailEl) detailEl.textContent = detail || "";
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return Promise.resolve();
  }

  function addHidden(form, name, value) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value == null ? "" : String(value);
    form.appendChild(input);
  }

  function submitPost(site) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = site.loginUrl || site.url;
    form.acceptCharset = "UTF-8";
    form.style.display = "none";

    const idInput = document.createElement("input");
    idInput.type = "text";
    idInput.name = site.idField || "id";
    idInput.value = site.userId || "";
    form.appendChild(idInput);

    const pwInput = document.createElement("input");
    pwInput.type = "password";
    pwInput.name = site.pwField || "password";
    pwInput.value = site.password || "";
    form.appendChild(pwInput);

    const extra = site.extraFields || {};
    Object.keys(extra).forEach((key) => addHidden(form, key, extra[key]));

    document.body.appendChild(form);
    setStatus("로그인 전송 중…", site.name + " — ID/PW 자동 입력 후 전송합니다.");
    setTimeout(() => form.submit(), 350);
  }

  function submitGet(site) {
    const u = new URL(site.loginUrl || site.url);
    u.searchParams.set(site.idField || "id", site.userId || "");
    u.searchParams.set(site.pwField || "password", site.password || "");
    setStatus("로그인 이동 중…", site.name);
    location.href = u.toString();
  }

  function assistOpen(site) {
    const id = site.userId || "";
    const pw = site.password || "";
    setStatus(site.name + " 로그인", "ID/PW를 복사한 뒤 로그인 페이지에서 붙여넣으세요.");

    actionsEl.innerHTML = "";
    const mkBtn = (label, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn";
      b.textContent = label;
      b.addEventListener("click", fn);
      actionsEl.appendChild(b);
    };

    mkBtn("ID 복사", () => copyText(id).then(() => setStatus("ID 복사됨", id || "(비어 있음)")));
    mkBtn("PW 복사", () => copyText(pw).then(() => setStatus("PW 복사됨", "비밀번호가 클립보드에 복사되었습니다.")));
    mkBtn("로그인 페이지 열기", () => {
      location.href = site.loginPage || site.loginUrl || site.url;
    });
    mkBtn("로그인 후 목적지로", () => {
      location.href = site.url;
    });

    if (id) {
      copyText(id).catch(() => {});
    }
  }

  function run() {
    const site = window.BizBoardStore.getSite(siteId);
    if (!site) {
      setStatus("사이트를 찾을 수 없습니다", siteId || "(없음)");
      return;
    }

    if (!site.userId || !site.password) {
      setStatus("ID/PW 미설정", "설정에서 이 사이트의 아이디·비밀번호를 먼저 저장하세요.");
      actionsEl.innerHTML = "";
      const a = document.createElement("a");
      a.className = "btn";
      a.href = "./settings.html?site=" + encodeURIComponent(site.id);
      a.textContent = "설정으로 이동";
      actionsEl.appendChild(a);
      const b = document.createElement("a");
      b.className = "btn btn-ghost";
      b.href = site.loginPage || site.loginUrl || site.url;
      b.textContent = "로그인 페이지만 열기";
      actionsEl.appendChild(b);
      return;
    }

    const mode = (site.auth || "open").toLowerCase();
    if (mode === "post") {
      submitPost(site);
    } else if (mode === "get") {
      submitGet(site);
    } else {
      assistOpen(site);
    }
  }

  run();
})();
