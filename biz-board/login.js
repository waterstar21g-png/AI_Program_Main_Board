(() => {
  const STORAGE_KEY = "biz-board-sites-v1";
  const params = new URLSearchParams(location.search);
  const siteId = params.get("site");

  const title = document.getElementById("title");
  const desc = document.getElementById("desc");
  const spinner = document.getElementById("spinner");
  const assist = document.getElementById("assist");
  const form = document.getElementById("autoForm");

  function loadSites() {
    const defaults = (window.BIZ_BOARD_DEFAULTS || []).map((s) => ({ ...s }));
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      const saved = JSON.parse(raw);
      const byId = Object.fromEntries((saved || []).map((s) => [s.id, s]));
      return defaults.map((def) => ({ ...def, ...(byId[def.id] || {}) }));
    } catch {
      return defaults;
    }
  }

  const site = loadSites().find((s) => s.id === siteId);
  if (!site) {
    title.textContent = "바로가기를 찾을 수 없습니다";
    desc.textContent = "보드로 돌아가 다시 선택하세요.";
    spinner.style.display = "none";
    return;
  }

  title.textContent = site.name;
  document.title = `${site.name} · 비즈보드 로그인`;

  const userId = (site.userId || "").trim();
  const password = site.password || "";
  const mode = site.loginMode || "open_assist";

  function showAssist(message) {
    spinner.style.display = "none";
    desc.textContent = message;
    assist.hidden = false;
    assist.innerHTML = `
      <div class="assist-row">
        <code id="idVal">${escapeHtml(userId || "(아이디 미설정)")}</code>
        <button type="button" class="btn" id="copyId">ID 복사</button>
      </div>
      <div class="assist-row">
        <code id="pwVal">${escapeHtml(password ? "••••••••" : "(비밀번호 미설정)")}</code>
        <button type="button" class="btn" id="copyPw">PW 복사</button>
      </div>
      <button type="button" class="btn btn-primary" id="openSite">로그인 페이지 열기</button>
    `;
    document.getElementById("copyId").addEventListener("click", async () => {
      if (!userId) return;
      await navigator.clipboard.writeText(userId);
      desc.textContent = "아이디를 복사했습니다. 로그인 칸에 붙여넣으세요.";
    });
    document.getElementById("copyPw").addEventListener("click", async () => {
      if (!password) return;
      await navigator.clipboard.writeText(password);
      desc.textContent = "비밀번호를 복사했습니다. 로그인 칸에 붙여넣으세요.";
    });
    document.getElementById("openSite").addEventListener("click", () => {
      location.href = site.url;
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function submitForm(method) {
    if (!userId || !password) {
      showAssist("ID/PW가 비어 있습니다. 보드에서 먼저 설정하세요.");
      return;
    }
    if (!site.idField || !site.pwField) {
      showAssist("ID/PW 필드명이 없습니다. 설정에서 필드명을 입력하세요.");
      return;
    }

    desc.textContent =
      method === "get"
        ? "사전 ID/PW로 GET 로그인 전송 중…"
        : "사전 ID/PW로 POST 로그인 전송 중…";

    form.method = method;
    form.action = site.url;
    form.innerHTML = "";

    const idInput = document.createElement("input");
    idInput.type = "hidden";
    idInput.name = site.idField;
    idInput.value = userId;
    form.appendChild(idInput);

    const pwInput = document.createElement("input");
    pwInput.type = "hidden";
    pwInput.name = site.pwField;
    pwInput.value = password;
    form.appendChild(pwInput);

    // Common extras some admin panels expect
    if (site.extraFields && typeof site.extraFields === "object") {
      Object.entries(site.extraFields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = String(value);
        form.appendChild(input);
      });
    }

    setTimeout(() => form.submit(), 350);
  }

  if (mode === "form_post") {
    submitForm("post");
  } else if (mode === "form_get") {
    submitForm("get");
  } else {
    showAssist("로그인 페이지를 열고, ID/PW를 복사해 붙여넣습니다.");
    // Auto-open after a short beat so user sees the assist panel once.
    setTimeout(() => {
      // Keep assist panel available via history back.
      window.open(site.url, "_blank", "noopener,noreferrer");
    }, 400);
  }
})();
