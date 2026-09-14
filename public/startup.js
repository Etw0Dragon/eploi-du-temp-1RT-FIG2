// Chaque nouvel onglet commence sur l'agenda. Le rechargement unique permet
// aussi à Supabase de repartir d'un état d'authentification propre.
(() => {
  const agendaHash = "#agenda";
  const reloadMarker = "edt-startup-reload-v1";

  const openAgenda = () => {
    if (window.location.hash !== agendaHash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${agendaHash}`);
    }
  };

  openAgenda();

  try {
    if (!window.sessionStorage.getItem(reloadMarker)) {
      window.sessionStorage.setItem(reloadMarker, "done");
      window.location.reload();
    }
  } catch {
    // Si le stockage est indisponible, l'application reste utilisable sans rechargement forcé.
  }

  // Sur téléphone, le navigateur restaure souvent l'onglet depuis son cache
  // d'historique au lieu de relancer les scripts. On revient alors aussi à
  // l'agenda et on recharge pour renouveler la session Supabase.
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    openAgenda();
    window.location.reload();
  });
})();
