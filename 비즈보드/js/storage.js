/** localStorage 기반 ID/PW · 사이트 오버라이드 */
(function (global) {
  const KEY = "bizboard.creds.v1";
  const META = "bizboard.meta.v1";

  function readAll() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function writeAll(map) {
    localStorage.setItem(KEY, JSON.stringify(map));
  }

  function getCreds(siteId) {
    const all = readAll();
    const saved = all[siteId] || {};
    const base = (global.BIZ_BOARD_SITES || []).find((s) => s.id === siteId) || {};
    return {
      userId: (saved.userId != null && saved.userId !== "" ? saved.userId : base.userId) || "",
      password: (saved.password != null && saved.password !== "" ? saved.password : base.password) || "",
    };
  }

  function setCreds(siteId, userId, password) {
    const all = readAll();
    all[siteId] = { userId: userId || "", password: password || "" };
    writeAll(all);
  }

  function clearCreds(siteId) {
    const all = readAll();
    delete all[siteId];
    writeAll(all);
  }

  function mergeSite(site) {
    const c = getCreds(site.id);
    return Object.assign({}, site, c);
  }

  function allSites() {
    return (global.BIZ_BOARD_SITES || []).map(mergeSite);
  }

  function getSite(id) {
    const s = (global.BIZ_BOARD_SITES || []).find((x) => x.id === id);
    return s ? mergeSite(s) : null;
  }

  function installHintSeen() {
    return localStorage.getItem(META + ".install") === "1";
  }

  function markInstallHint() {
    localStorage.setItem(META + ".install", "1");
  }

  global.BizBoardStore = {
    getCreds,
    setCreds,
    clearCreds,
    allSites,
    getSite,
    installHintSeen,
    markInstallHint,
  };
})(window);
