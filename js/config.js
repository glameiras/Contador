/**
 * Configuração PÚBLICA do Supabase.
 * Cole apenas Project URL e Publishable key (ou chave anon legado).
 * Nunca adicione sb_secret_*, service_role, senha, token pessoal ou chave Stripe aqui.
 * Deixe os campos vazios para experimentar a versão LOCAL sem login.
 */
window.CONTADOR_CONFIG = {
  url: "",
  publishableKey: "",
};
if (window.CONTADOR_CONFIG.url && window.CONTADOR_CONFIG.publishableKey) {
  document.documentElement.classList.add("cloud-mode");
} else {
  // Mostra a tela de acesso para demonstrar o produto; NÃO finge autenticar.
  document.documentElement.classList.add("auth-preview");
}
