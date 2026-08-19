/** 비즈보드 메인 — 타일 렌더 · 홈화면 설치 안내 */
(function () {
  const grid = document.getElementById("grid");
  const installBanner = document.getElementById("installBanner");
  const dismissInstall = document.getElementById("dismissInstall");
  const countEl = document.getElementById("siteCount");
  const versionEl = document.getElementById("versionLabel");

  versionEl.textContent = "v1.0.0";

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function showInstallHint() {
    if (isStandalone()) return;
    if (window.BizBoardStore.installHintSeen()) return;
    installBanner.hidden = false;
  }

  dismissInstall?.addEventListener("click", () => {
    window.BizBoardStore.markInstallHint();
    installBanner.hidden = true;
  });

  function openSite(site) {
    const url = "./auth.html?site=" + encodeURIComponent(site.id);
    location.href = url;
  }

  function render() {
    const sites = window.BizBoardStore.allSites();
    countEl.textContent = String(sites.length);
    grid.innerHTML = "";

    const groups = {};
    sites.forEach((s) => {
      const g = s.group || "기타";
      (groups[g] || (groups[g] = [])).push(s);
    });

    Object.keys(groups).forEach((groupName) => {
      const section = document.createElement("section");
      section.className = "group";
      const h = document.createElement("h2");
      h.className = "group__title";
      h.textContent = groupName;
      section.appendChild(h);

      const row = document.createElement("div");
      row.className = "tiles";

      groups[groupName].forEach((site) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tile";
        btn.style.setProperty("--tile", site.color || "#124e5c");
        const ready = !!(site.userId && site.password);
        btn.innerHTML =
          '<span class="tile__name"></span>' +
          '<span class="tile__meta"></span>';
        btn.querySelector(".tile__name").textContent = site.name;
        btn.querySelector(".tile__meta").textContent = ready
          ? "자동로그인"
          : "ID/PW 설정 필요";
        if (!ready) btn.classList.add("is-empty");
        btn.addEventListener("click", () => openSite(site));
        row.appendChild(btn);
      });

      section.appendChild(row);
      grid.appendChild(section);
    });
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  showInstallHint();
  render();
})();
