const STORAGE_KEY = "biz_board_creds_v1";
const CUSTOM_KEY = "biz_board_custom_v1";

function defaults() {
  return window.BIZ_BOARD_DEFAULTS || { version: "1.0.0", appName: "비즈보드", shortcuts: [] };
}

function loadCredMap() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveCredMap(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function loadCustomShortcuts() {
  try {
    const list = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveCustomShortcuts(list) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
}

function mergeShortcuts() {
  const base = defaults().shortcuts.map((s) => ({ ...s }));
  const custom = loadCustomShortcuts();
  const creds = loadCredMap();
  const all = [...base, ...custom];
  return all.map((s) => {
    const c = creds[s.id] || {};
    return {
      ...s,
      username: c.username != null ? c.username : s.username || "",
      password: c.password != null ? c.password : s.password || "",
      loginUrl: c.loginUrl || s.loginUrl,
    };
  });
}

function getShortcut(id) {
  return mergeShortcuts().find((s) => s.id === id) || null;
}

function hasCreds(s) {
  return Boolean((s.username || "").trim() && (s.password || ""));
}

function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2200);
}

async function copyText(text) {
  const value = text || "";
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

function initialOf(name) {
  const t = (name || "?").trim();
  return t.slice(0, 1).toUpperCase();
}

function renderBoard() {
  const grid = document.getElementById("grid");
  const count = document.getElementById("count");
  if (!grid) return;
  const list = mergeShortcuts();
  count.textContent = `${list.length}개 바로가기`;
  grid.innerHTML = list
    .map((s, idx) => {
      const ink = s.textColor || "#fff";
      const ok = hasCreds(s);
      return `
      <a class="tile" href="login.html?id=${encodeURIComponent(s.id)}" style="--accent:${s.color};--accent-ink:${ink};animation-delay:${Math.min(idx, 12) * 0.03}s">
        <div class="tile-top">
          <span class="badge">${initialOf(s.name)}</span>
          <span class="cred-dot ${ok ? "ok" : ""}" title="${ok ? "ID/PW 설정됨" : "ID/PW 미설정"}"></span>
        </div>
        <div>
          <div class="group">${s.group || "일반"}</div>
          <p class="tile-name">${escapeHtml(s.name)}</p>
        </div>
      </a>`;
    })
    .join("");
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function openSettings() {
  const sheet = document.getElementById("settings");
  const list = document.getElementById("credList");
  const items = mergeShortcuts();
  list.innerHTML = items
    .map(
      (s) => `
    <div class="cred-card" data-id="${escapeHtml(s.id)}">
      <h3>${escapeHtml(s.name)} <span class="group">· ${escapeHtml(s.group || "")}</span></h3>
      <div class="fields">
        <label>ID / 이메일
          <input data-field="username" value="${escapeHtml(s.username || "")}" autocomplete="username" />
        </label>
        <label>비밀번호
          <input data-field="password" type="password" value="${escapeHtml(s.password || "")}" autocomplete="current-password" />
        </label>
        <label>로그인 URL
          <input data-field="loginUrl" value="${escapeHtml(s.loginUrl || "")}" />
        </label>
      </div>
    </div>`
    )
    .join("");
  sheet.classList.add("open");
}

function closeSettings() {
  document.getElementById("settings")?.classList.remove("open");
}

function saveSettingsFromUi() {
  const map = loadCredMap();
  const customs = loadCustomShortcuts();
  const customById = Object.fromEntries(customs.map((c) => [c.id, { ...c }]));
  const defaultIds = new Set(defaults().shortcuts.map((s) => s.id));

  document.querySelectorAll("#credList .cred-card").forEach((card) => {
    const id = card.getAttribute("data-id");
    const username = card.querySelector('[data-field="username"]')?.value || "";
    const password = card.querySelector('[data-field="password"]')?.value || "";
    const loginUrl = card.querySelector('[data-field="loginUrl"]')?.value || "";
    map[id] = { username, password };
    if (!defaultIds.has(id) && customById[id]) {
      customById[id].loginUrl = loginUrl;
      customById[id].homeUrl = loginUrl;
    } else if (defaultIds.has(id) && loginUrl) {
      // Persist URL override alongside creds for defaults
      map[id].loginUrl = loginUrl;
    }
  });
  saveCredMap(map);
  saveCustomShortcuts(Object.values(customById));
  toast("ID/PW 저장 완료");
  closeSettings();
  renderBoard();
}

function addCustomShortcut() {
  const name = prompt("바로가기 이름");
  if (!name) return;
  const loginUrl = prompt("로그인 URL (https://...)");
  if (!loginUrl) return;
  const username = prompt("ID (나중에 설정에서도 수정 가능)", "") || "";
  const password = prompt("PW (나중에 설정에서도 수정 가능)", "") || "";
  const id = `custom_${Date.now()}`;
  const list = loadCustomShortcuts();
  list.push({
    id,
    name: name.trim(),
    group: "사용자",
    color: "#2F6F4E",
    loginUrl: loginUrl.trim(),
    homeUrl: loginUrl.trim(),
    loginMethod: "assist",
    username: "",
    password: "",
  });
  saveCustomShortcuts(list);
  const map = loadCredMap();
  map[id] = { username, password };
  saveCredMap(map);
  toast("바로가기 추가됨");
  renderBoard();
}

function setupInstall() {
  const banner = document.getElementById("installBanner");
  const btn = document.getElementById("installBtn");
  const dismiss = document.getElementById("dismissInstall");
  if (!banner || !btn) return;

  let deferred = null;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (standalone || localStorage.getItem("biz_board_install_dismissed") === "1") {
    return;
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    banner.classList.add("show");
  });

  // iOS / browsers without beforeinstallprompt
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIos && !standalone) {
    banner.classList.add("show");
    btn.textContent = "방법 보기";
    btn.onclick = () => {
      alert("Safari에서 공유 → '홈 화면에 추가'를 선택하세요.\n비즈보드 아이콘이 휴대폰 홈에 생깁니다.");
    };
  } else {
    btn.onclick = async () => {
      if (!deferred) {
        toast("브라우저 메뉴에서 '홈 화면에 추가'를 선택하세요");
        return;
      }
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      banner.classList.remove("show");
    };
  }

  dismiss?.addEventListener("click", () => {
    localStorage.setItem("biz_board_install_dismissed", "1");
    banner.classList.remove("show");
  });
}

function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function bootBoard() {
  const ver = document.getElementById("versionLabel");
  if (ver) ver.textContent = `v${defaults().version}`;
  renderBoard();
  document.getElementById("openSettings")?.addEventListener("click", openSettings);
  document.getElementById("closeSettings")?.addEventListener("click", closeSettings);
  document.getElementById("saveSettings")?.addEventListener("click", saveSettingsFromUi);
  document.getElementById("addShortcut")?.addEventListener("click", addCustomShortcut);
  document.getElementById("settings")?.addEventListener("click", (e) => {
    if (e.target.id === "settings") closeSettings();
  });
  setupInstall();
  registerSW();
}

/** login.html */
function queryId() {
  const q = new URLSearchParams(location.search);
  return q.get("id") || "";
}

function applyCredOverrides(svc) {
  if (!svc) return null;
  const map = loadCredMap();
  const c = map[svc.id] || {};
  return {
    ...svc,
    username: c.username != null ? c.username : svc.username || "",
    password: c.password != null ? c.password : svc.password || "",
    loginUrl: c.loginUrl || svc.loginUrl,
  };
}

function submitFormPost(svc) {
  const form = document.createElement("form");
  form.method = (svc.formMethod || "POST").toUpperCase();
  form.action = svc.formAction || svc.loginUrl;
  form.style.display = "none";
  const u = document.createElement("input");
  u.name = svc.userField || "username";
  u.value = svc.username;
  const p = document.createElement("input");
  p.type = "password";
  p.name = svc.passField || "password";
  p.value = svc.password;
  form.append(u, p);
  document.body.appendChild(form);
  form.submit();
}

async function runAssistLogin(svc, setStep) {
  setStep(1);
  const idOk = await copyText(svc.username);
  toast(idOk ? "ID 복사됨 → 로그인 화면에 붙여넣기" : "ID 복사 실패");
  await wait(700);
  setStep(2);
  window.open(svc.loginUrl, "_blank", "noopener,noreferrer");
  await wait(900);
  setStep(3);
  const pwOk = await copyText(svc.password);
  toast(pwOk ? "PW 복사됨 → 비밀번호란에 붙여넣기" : "PW 복사 실패");
  setStep(4);
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function bootLogin() {
  registerSW();
  const id = queryId();
  const raw = getShortcut(id);
  const svc = applyCredOverrides(raw);
  const title = document.getElementById("svcName");
  const status = document.getElementById("status");
  const steps = [...document.querySelectorAll("[data-step]")];

  function setStep(n) {
    steps.forEach((el) => {
      const sn = Number(el.getAttribute("data-step"));
      el.classList.toggle("active", sn === n);
      el.classList.toggle("done", sn < n);
    });
  }

  if (!svc) {
    if (title) title.textContent = "바로가기 없음";
    if (status) status.textContent = "목록에서 다시 선택하세요.";
    return;
  }

  if (title) title.textContent = svc.name;

  document.getElementById("copyId")?.addEventListener("click", async () => {
    await copyText(svc.username);
    toast("ID 복사");
  });
  document.getElementById("copyPw")?.addEventListener("click", async () => {
    await copyText(svc.password);
    toast("PW 복사");
  });
  document.getElementById("openLogin")?.addEventListener("click", () => {
    window.open(svc.loginUrl, "_blank", "noopener,noreferrer");
  });
  document.getElementById("retry")?.addEventListener("click", () => start());

  async function start() {
    if (!hasCreds(svc)) {
      if (status) {
        status.textContent = "ID/PW가 없습니다. 홈 → 설정에서 먼저 입력하세요.";
      }
      setStep(0);
      return;
    }

    if (svc.loginMethod === "form_post" && svc.formAction) {
      if (status) status.textContent = "사전 정의된 ID/PW로 로그인 폼을 전송합니다…";
      setStep(1);
      await wait(400);
      setStep(2);
      submitFormPost(svc);
      return;
    }

    if (status) {
      status.textContent = "로그인 절차 실행: ID 복사 → 사이트 열기 → PW 복사";
    }
    await runAssistLogin(svc, setStep);
    if (status) {
      status.textContent = "로그인 화면에 ID/PW를 붙여넣고 로그인하세요.";
    }
  }

  start();
}

window.BizBoard = {
  bootBoard,
  bootLogin,
  mergeShortcuts,
  getShortcut,
  hasCreds,
  copyText,
  toast,
};
