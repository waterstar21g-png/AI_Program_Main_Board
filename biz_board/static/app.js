(() => {
  "use strict";

  const LS_KEY = "biz_board_creds_v1";
  const grid = document.getElementById("grid");
  const metaLine = document.getElementById("metaLine");
  const toastEl = document.getElementById("toast");
  const dlgSite = document.getElementById("dlgSite");
  const dlgSettings = document.getElementById("dlgSettings");
  const dlgHowto = document.getElementById("dlgHowto");
  const btnInstall = document.getElementById("btnInstall");
  const btnSettings = document.getElementById("btnSettings");
  const btnHowto = document.getElementById("btnHowto");

  let sites = [];
  let current = null;
  let deferredPrompt = null;
  let version = "";

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  function loadLocalCreds() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveLocalCreds(map) {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  }

  function mergeCreds(list) {
    const local = loadLocalCreds();
    return list.map((s) => {
      const hit = local[s.id] || {};
      return {
        ...s,
        user: hit.user != null && hit.user !== "" ? hit.user : s.user || "",
        password: hit.password != null && hit.password !== "" ? hit.password : s.password || "",
      };
    });
  }

  function hasCreds(s) {
    return Boolean((s.user || "").trim() && (s.password || "").length);
  }

  function renderGrid() {
    grid.innerHTML = "";
    sites.forEach((site, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile";
      btn.style.animationDelay = `${Math.min(idx, 12) * 0.03}s`;
      btn.innerHTML = `
        <span class="tile-name">${escapeHtml(site.name || site.id)}</span>
        <span class="tile-badge ${hasCreds(site) ? "ready" : ""}">${hasCreds(site) ? "ID/PW 준비됨" : "ID/PW 필요"}</span>
      `;
      btn.addEventListener("click", () => openSite(site));
      grid.appendChild(btn);
    });
    metaLine.textContent = `비즈 보드 v${version || "?"} · 바로가기 ${sites.length}개`;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function openSite(site) {
    current = site;
    document.getElementById("dlgTitle").textContent = site.name || site.id;
    document.getElementById("dlgUrl").textContent = site.url || "";
    document.getElementById("dlgUser").value = site.user || "";
    document.getElementById("dlgPass").value = site.password || "";
    if (!dlgSite.open) dlgSite.showModal();
  }

  async function copyText(text, label) {
    const v = text || "";
    if (!v) {
      toast(`${label}가 비어 있습니다`);
      return;
    }
    try {
      await navigator.clipboard.writeText(v);
      toast(`${label} 복사됨`);
    } catch {
      toast("클립보드 복사 실패");
    }
  }

  function persistCurrentFromDialog() {
    if (!current) return;
    current.user = document.getElementById("dlgUser").value;
    current.password = document.getElementById("dlgPass").value;
    const map = loadLocalCreds();
    map[current.id] = { user: current.user, password: current.password };
    saveLocalCreds(map);
    const idx = sites.findIndex((s) => s.id === current.id);
    if (idx >= 0) sites[idx] = { ...sites[idx], ...current };
    renderGrid();
  }

  async function autoLogin() {
    persistCurrentFromDialog();
    if (!current) return;
    if (!hasCreds(current)) {
      toast("ID/PW를 먼저 입력하세요");
      return;
    }
    toast("자동 로그인 요청…");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: current.id,
          user: current.user,
          password: current.password,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast(data.message || "로그인 시작");
        // also open URL on phone for manual paste path
        if (isStandaloneOrMobile()) {
          window.open(current.url, "_blank", "noopener,noreferrer");
        }
      } else {
        toast(data.error || "로그인 실패");
        window.open(current.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      toast("서버 연결 실패 — URL만 엽니다");
      window.open(current.url, "_blank", "noopener,noreferrer");
    }
  }

  function isStandaloneOrMobile() {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return standalone || mobile;
  }

  function renderSettings() {
    const box = document.getElementById("settingsList");
    box.innerHTML = "";
    sites.forEach((site) => {
      const row = document.createElement("div");
      row.className = "set-row";
      row.dataset.id = site.id;
      row.innerHTML = `
        <h3>${escapeHtml(site.name || site.id)}</h3>
        <div class="fields">
          <label>아이디<input data-field="user" value="${escapeHtml(site.user || "")}" /></label>
          <label>비밀번호<input data-field="password" type="password" value="${escapeHtml(site.password || "")}" /></label>
        </div>
      `;
      box.appendChild(row);
    });
  }

  async function saveSettings() {
    const map = loadLocalCreds();
    const rows = [...document.querySelectorAll(".set-row")];
    rows.forEach((row) => {
      const id = row.dataset.id;
      const user = row.querySelector('[data-field="user"]').value;
      const password = row.querySelector('[data-field="password"]').value;
      map[id] = { user, password };
      const idx = sites.findIndex((s) => s.id === id);
      if (idx >= 0) {
        sites[idx] = { ...sites[idx], user, password };
      }
    });
    saveLocalCreds(map);
    renderGrid();

    // also push to server sites.local.json when available
    try {
      const payloadSites = sites.map((s) => ({
        ...s,
        user: (map[s.id] && map[s.id].user) || s.user || "",
        password: (map[s.id] && map[s.id].password) || s.password || "",
      }));
      const res = await fetch("/api/sites/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sites: payloadSites }),
      });
      const data = await res.json();
      if (data.ok) toast(`저장 완료 (${data.count}개)`);
      else toast(data.error || "서버 저장 실패(로컬만 저장됨)");
    } catch {
      toast("로컬 저장 완료 (서버 오프라인)");
    }
  }

  async function boot() {
    if ("serviceWorker" in navigator) {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch {
        /* ignore */
      }
    }

    try {
      const res = await fetch("/api/sites", { cache: "no-store" });
      const data = await res.json();
      version = data.version || "";
      sites = mergeCreds(Array.isArray(data.sites) ? data.sites : []);
      renderGrid();
    } catch (err) {
      metaLine.textContent = "사이트를 불러오지 못했습니다. 서버를 실행하세요.";
      toast("API 연결 실패");
    }

    try {
      const info = await fetch("/api/info").then((r) => r.json());
      if (info.lan_urls && info.lan_urls.length) {
        metaLine.textContent += ` · Phone ${info.lan_urls[0]}`;
      }
    } catch {
      /* ignore */
    }
  }

  document.getElementById("btnOpenUrl").addEventListener("click", () => {
    if (!current?.url) return;
    window.open(current.url, "_blank", "noopener,noreferrer");
  });
  document.getElementById("btnCopyId").addEventListener("click", () => {
    persistCurrentFromDialog();
    copyText(document.getElementById("dlgUser").value, "아이디");
  });
  document.getElementById("btnCopyPw").addEventListener("click", () => {
    persistCurrentFromDialog();
    copyText(document.getElementById("dlgPass").value, "비밀번호");
  });
  document.getElementById("btnAutoLogin").addEventListener("click", autoLogin);

  btnSettings.addEventListener("click", () => {
    renderSettings();
    dlgSettings.showModal();
  });
  document.getElementById("btnCloseSettings").addEventListener("click", () => dlgSettings.close());
  document.getElementById("btnSaveSettings").addEventListener("click", saveSettings);
  btnHowto.addEventListener("click", () => dlgHowto.showModal());
  document.getElementById("btnCloseHowto").addEventListener("click", () => dlgHowto.close());

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btnInstall.hidden = false;
  });
  btnInstall.addEventListener("click", async () => {
    if (!deferredPrompt) {
      dlgHowto.showModal();
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btnInstall.hidden = true;
  });

  // iOS has no beforeinstallprompt — show howto entry
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    btnInstall.hidden = false;
    btnInstall.textContent = "홈 화면에 추가 안내";
  }

  boot();
})();
