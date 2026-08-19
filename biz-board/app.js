(() => {
  const STORAGE_KEY = "biz-board-sites-v1";
  const VERSION = "1.0.0";

  const grid = document.getElementById("grid");
  const countLabel = document.getElementById("countLabel");
  const versionLabel = document.getElementById("versionLabel");
  const settingsPanel = document.getElementById("settingsPanel");
  const credList = document.getElementById("credList");
  const toast = document.getElementById("toast");
  const installHelp = document.getElementById("installHelp");
  const btnInstall = document.getElementById("btnInstall");
  const btnSettings = document.getElementById("btnSettings");
  const btnSave = document.getElementById("btnSave");
  const btnCloseSettings = document.getElementById("btnCloseSettings");
  const btnReset = document.getElementById("btnReset");
  const btnExport = document.getElementById("btnExport");

  let deferredPrompt = null;
  let sites = loadSites();

  versionLabel.textContent = `v${VERSION}`;

  function cloneDefaults() {
    return (window.BIZ_BOARD_DEFAULTS || []).map((s) => ({ ...s }));
  }

  function loadSites() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefaults();
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved) || saved.length === 0) return cloneDefaults();
      const byId = Object.fromEntries(saved.map((s) => [s.id, s]));
      return cloneDefaults().map((def) => ({ ...def, ...(byId[def.id] || {}) }));
    } catch {
      return cloneDefaults();
    }
  }

  function saveSites(next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    sites = next;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function renderGrid() {
    grid.innerHTML = "";
    sites.forEach((site, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile";
      btn.style.animationDelay = `${(index % 6) * 0.04}s`;
      btn.setAttribute("aria-label", `${site.name} 로그인 바로가기`);
      const hasCred = Boolean(site.userId && site.password);
      btn.innerHTML = `
        <span class="tile-dot" style="background:${site.color || "#3aa894"}"></span>
        <span class="tile-badge">${hasCred ? "ID설정됨" : "ID미설정"}</span>
        <span>
          <span class="tile-name">${escapeHtml(site.name)}</span>
          <span class="tile-group">${escapeHtml(site.group || "")} · ${escapeHtml(
            modeLabel(site.loginMode)
          )}</span>
        </span>
      `;
      btn.addEventListener("click", () => openLogin(site));
      grid.appendChild(btn);
    });
    countLabel.textContent = `바로가기 ${sites.length}`;
  }

  function modeLabel(mode) {
    if (mode === "form_post") return "자동 POST";
    if (mode === "form_get") return "자동 GET";
    return "열기+복사";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function openLogin(site) {
    const params = new URLSearchParams({ site: site.id });
    location.href = `./login.html?${params.toString()}`;
  }

  function renderSettings() {
    credList.innerHTML = "";
    sites.forEach((site, idx) => {
      const wrap = document.createElement("div");
      wrap.className = "cred-item";
      wrap.dataset.index = String(idx);
      wrap.innerHTML = `
        <strong>${escapeHtml(site.name)}</strong>
        <div class="fields">
          <label>URL
            <input data-field="url" value="${escapeAttr(site.url)}" />
          </label>
          <label>아이디
            <input data-field="userId" autocomplete="username" value="${escapeAttr(
              site.userId || ""
            )}" />
          </label>
          <label>비밀번호
            <input data-field="password" type="password" autocomplete="current-password" value="${escapeAttr(
              site.password || ""
            )}" />
          </label>
          <label>로그인 방식
            <select data-field="loginMode">
              <option value="form_post"${site.loginMode === "form_post" ? " selected" : ""}>폼 POST 자동전송</option>
              <option value="form_get"${site.loginMode === "form_get" ? " selected" : ""}>폼 GET 자동전송</option>
              <option value="open_assist"${site.loginMode === "open_assist" ? " selected" : ""}>페이지 열기 + ID/PW 복사</option>
            </select>
          </label>
          <label>ID 필드명
            <input data-field="idField" value="${escapeAttr(site.idField || "")}" />
          </label>
          <label>PW 필드명
            <input data-field="pwField" value="${escapeAttr(site.pwField || "")}" />
          </label>
        </div>
      `;
      credList.appendChild(wrap);
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("'", "&#39;");
  }

  function collectSettingsFromDom() {
    const next = sites.map((site) => ({ ...site }));
    credList.querySelectorAll(".cred-item").forEach((item) => {
      const idx = Number(item.dataset.index);
      item.querySelectorAll("[data-field]").forEach((el) => {
        next[idx][el.dataset.field] = el.value;
      });
    });
    return next;
  }

  btnSettings.addEventListener("click", () => {
    settingsPanel.classList.add("open");
    renderSettings();
    settingsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  btnCloseSettings.addEventListener("click", () => {
    settingsPanel.classList.remove("open");
  });

  btnSave.addEventListener("click", () => {
    const next = collectSettingsFromDom();
    saveSites(next);
    renderGrid();
    showToast("로그인 정보를 저장했습니다.");
  });

  btnReset.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    sites = cloneDefaults();
    renderGrid();
    renderSettings();
    showToast("기본 바로가기로 복원했습니다.");
  });

  btnExport.addEventListener("click", async () => {
    const payload = JSON.stringify(sites, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      showToast("설정을 클립보드에 복사했습니다.");
    } catch {
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "biz-board-settings.json";
      a.click();
      URL.revokeObjectURL(url);
      showToast("설정 파일을 내려받았습니다.");
    }
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installHelp.classList.add("show");
    btnInstall.textContent = "홈 화면에 설치";
  });

  btnInstall.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      deferredPrompt = null;
      showToast(result.outcome === "accepted" ? "홈 화면에 추가되었습니다." : "설치가 취소되었습니다.");
      return;
    }
    installHelp.classList.add("show");
    showToast("아래 안내대로 홈 화면에 추가하세요.");
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  // iOS / desktop without beforeinstallprompt
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (!isStandalone) {
    installHelp.classList.add("show");
  }

  renderGrid();
})();
