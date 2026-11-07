/* UI de autenticação: mostra/oculta senha e modo demonstração.
 * NÃO implementa login fictício ou armazena senhas no navegador.
 */
"use strict";
document.querySelectorAll("[data-toggle-password]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.togglePassword);
    if (!input) return;
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.textContent = showing ? "Mostrar" : "Ocultar";
    button.setAttribute("aria-pressed", String(!showing));
  });
});
if (document.documentElement.classList.contains("auth-preview")) {
  const screen = document.getElementById("auth-screen");
  const note = document.getElementById("auth-message");
  const tabs = document.getElementById("auth-tabs");
  const modes = ["login", "signup", "forgot", "reset"];
  const headings = {
    login: "Bem-vindo de volta",
    signup: "Crie sua conta",
    forgot: "Recuperar acesso",
    reset: "Definir nova senha"
  };
  const previewInfo = document.getElementById("auth-preview-note");
  const demoButton = document.getElementById("demo-access");
  function showMode(selected) {
    if (!modes.includes(selected)) return;
    modes.forEach((name) => {
      const form = document.getElementById(name + "-form");
      if (form) form.hidden = name !== selected;
    });
    tabs.hidden = selected !== "login" && selected !== "signup";
    tabs.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.authMode === selected));
    });
    document.getElementById("auth-title").textContent = headings[selected];
    note.textContent = "Cadastro e acesso estarão disponíveis após configurar o Supabase. Por enquanto, você pode conhecer o aplicativo no modo demonstração.";
  }
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => showMode(button.dataset.authMode));
  });
  for (const name of modes) {
    const form = document.getElementById(name + "-form");
    if (form) form.addEventListener("submit", (event) => {
      event.preventDefault();
      note.textContent = "O acesso individual ainda não está ativo. Configure Supabase para autenticar com segurança ou utilize a demonstração abaixo.";
      note.focus?.();
    });
  }
  if (previewInfo) previewInfo.hidden = false;
  if (demoButton) {
    demoButton.hidden = false;
    demoButton.addEventListener("click", () => {
      document.documentElement.classList.add("is-demo");
      screen.hidden = true;
      const back = document.createElement("button");
      back.className = "icon-button";
      back.type = "button";
      back.textContent = "Voltar ao início";
      back.id = "return-auth";
      back.addEventListener("click", () => {
        document.documentElement.classList.remove("is-demo");
        screen.hidden = false;
        location.hash = "dashboard";
      });
      if (!document.getElementById("return-auth")) {
        document.querySelector(".header-actions")?.prepend(back);
      }
      location.hash = "dashboard";
    });
  }
  document.getElementById("auth-provider").hidden = true;
  screen.hidden = false;
  showMode("login");
} else {
  const previewInfo = document.getElementById("auth-preview-note");
  const demoButton = document.getElementById("demo-access");
  if (previewInfo) previewInfo.hidden = true;
  if (demoButton) demoButton.hidden = true;
}
