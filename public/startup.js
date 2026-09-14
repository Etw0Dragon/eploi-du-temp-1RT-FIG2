// Chaque nouvel onglet commence sur l'agenda. Le rechargement unique permet
// aussi à Supabase de repartir d'un état d'authentification propre.
(() => {
  const agendaHash = "#agenda";
  const reloadMarker = "edt-startup-reload-v1";

  if (window.location.hash !== agendaHash) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${agendaHash}`);
  }

  try {
    if (!window.sessionStorage.getItem(reloadMarker)) {
      window.sessionStorage.setItem(reloadMarker, "done");
      window.location.reload();
    }
  } catch {
    // Si le stockage est indisponible, l'application reste utilisable sans rechargement forcé.
  }
})();
