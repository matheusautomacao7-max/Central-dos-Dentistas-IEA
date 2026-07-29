(() => {
  const storageKey = "iea.release";
  let updateShown = false;
  let latestRelease = null;

  function showUpdateNotice() {
    if (updateShown) return;
    updateShown = true;
    const notice = document.createElement("section");
    notice.className = "system-update-notice";
    notice.setAttribute("role", "alertdialog");
    notice.setAttribute("aria-modal", "true");
    notice.innerHTML = `<div class="system-update-card"><span>Atualização disponível</span><h2>O sistema recebeu uma nova versão.</h2><p>Atualize esta página para carregar as melhorias e regras mais recentes.</p><button type="button">Atualizar agora</button></div>`;
    notice.querySelector("button").addEventListener("click", () => {
      if (latestRelease) localStorage.setItem(storageKey, latestRelease);
      window.location.reload();
    });
    document.body.append(notice);
  }

  async function checkRelease(initial = false) {
    try {
      const response = await fetch("/api/release", { cache: "no-store" });
      if (!response.ok) return;
      const { release } = await response.json();
      latestRelease = release;
      const current = localStorage.getItem(storageKey);
      if (!current) {
        localStorage.setItem(storageKey, release);
        return;
      }
      if (current !== release) showUpdateNotice();
    } catch { /* A navegação principal não deve ser afetada por uma falha temporária de rede. */ }
  }

  checkRelease();
  window.setInterval(checkRelease, 10_000);
})();
