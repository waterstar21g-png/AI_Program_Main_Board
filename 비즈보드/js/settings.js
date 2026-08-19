/** 설정 — 사이트별 ID/PW 사전 정의 저장 */
(function () {
  const list = document.getElementById("settingsList");
  const params = new URLSearchParams(location.search);
  const focusId = params.get("site");

  function render() {
    const sites = window.BizBoardStore.allSites();
    list.innerHTML = "";
    sites.forEach((site) => {
      const card = document.createElement("article");
      card.className = "cred";
      card.id = "site-" + site.id;
      if (focusId === site.id) card.classList.add("is-focus");

      card.innerHTML =
        '<header class="cred__head">' +
        '<h2 class="cred__title"></h2>' +
        '<span class="cred__auth"></span>' +
        "</header>" +
        '<label class="field">아이디<input class="js-id" autocomplete="username" /></label>' +
        '<label class="field">비밀번호<input class="js-pw" type="password" autocomplete="current-password" /></label>' +
        '<div class="cred__actions">' +
        '<button type="button" class="btn js-save">저장</button>' +
        '<button type="button" class="btn btn-ghost js-clear">지우기</button>' +
        '<a class="btn btn-ghost js-try" href="#">로그인 실행</a>' +
        "</div>";

      card.querySelector(".cred__title").textContent = site.name;
      card.querySelector(".cred__auth").textContent =
        (site.auth || "open").toUpperCase() + " · " + (site.group || "");
      const idInput = card.querySelector(".js-id");
      const pwInput = card.querySelector(".js-pw");
      idInput.value = site.userId || "";
      pwInput.value = site.password || "";

      card.querySelector(".js-save").addEventListener("click", () => {
        window.BizBoardStore.setCreds(site.id, idInput.value.trim(), pwInput.value);
        card.classList.add("is-saved");
        setTimeout(() => card.classList.remove("is-saved"), 1200);
      });
      card.querySelector(".js-clear").addEventListener("click", () => {
        window.BizBoardStore.clearCreds(site.id);
        idInput.value = "";
        pwInput.value = "";
      });
      card.querySelector(".js-try").href =
        "./auth.html?site=" + encodeURIComponent(site.id);

      list.appendChild(card);
    });

    if (focusId) {
      const el = document.getElementById("site-" + focusId);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  render();
})();
