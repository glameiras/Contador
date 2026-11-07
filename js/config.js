/**
 * Configuração PÚBLICA do Supabase.
 * NUNCA inclua service_role, sb_secret_ ou chaves privadas.
 * Campos vazios = modo LOCAL, sem login.
 */
window.CONTADOR_CONFIG = {
  url: "",
  publishableKey: "",
};
if (window.CONTADOR_CONFIG.url && window.CONTADOR_CONFIG.publishableKey) {
  document.documentElement.classList.add("cloud-mode");
}
