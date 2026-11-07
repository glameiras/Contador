/**
 * CONTADOR — Auth + persistência com Supabase JS 2.119.0.
 * Os dados financeiros NÃO são gravados no localStorage no modo nuvem.
 * A chave publishable não é segredo. O isolamento é garantido pelas políticas
 * RLS no banco; rode supabase/schema.sql antes de habilitar o modo nuvem.
 */
const config = window.CONTADOR_CONFIG || {};
if (document.documentElement.classList.contains("cloud-mode")) {
  void initCloud().catch((error) => {
    document.getElementById("auth-screen").hidden = false;
    document.getElementById("auth-message").textContent =
      "Não foi possível iniciar o acesso seguro: " + (error.message || "erro inesperado");
    console.error("Inicialização do Contador", error);
  });
}
async function initCloud() {
  if (!/^https:\/\//.test(config.url) || !config.publishableKey ||
      /^(sb_secret_|eyJ.*service_role)/i.test(config.publishableKey)) {
    throw Error("Configure somente a URL HTTPS e a chave publicável do Supabase.");
  }
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm");
  const db = createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const app = window.ContadorApp;
  if (!app) throw Error("A interface não carregou. Verifique js/app.js.");
  const authScreen = document.getElementById("auth-screen");
  const message = document.getElementById("auth-message");
  const tabs = document.getElementById("auth-tabs");
  let signedUserId = null;
  let pendingUserId = null;
  let recovering = false;
  let sessionTicket = 0;
  let inflight = false;
  const modes = ["login", "signup", "forgot", "reset"];

  function status(value) { message.textContent = value; }
  function mode(name, note = "") {
    modes.forEach((m) => {
      document.getElementById(m + "-form").hidden = m !== name;
    });
    tabs.hidden = !["login", "signup"].includes(name);
    document.getElementById("auth-provider").hidden = !["login", "signup"].includes(name);
    tabs.querySelectorAll("[data-auth-mode]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.authMode === name)));
    document.getElementById("auth-title").textContent = ({
      login: "Bem-vindo de volta", signup: "Crie sua conta",
      forgot: "Recuperar acesso", reset: "Crie uma nova senha",
    })[name];
    status(note || (name === "login" ? "Seus dados, acessíveis apenas a você." :
      name === "signup" ? "Use um e-mail válido e uma senha forte." : ""));
  }
  function lock() {
    sessionTicket += 1;
    signedUserId = null;
    pendingUserId = null;
    app.lockCloud();
    document.documentElement.classList.remove("is-authed");
    authScreen.hidden = false;
  }
  function getError(error) {
    if (error?.message?.includes("CONFLICT"))
      return new Error("Outro dispositivo atualizou seus dados. Recarregue a página antes de salvar novamente.");
    return error instanceof Error ? error : new Error("Erro ao acessar o banco de dados.");
  }
  async function openUser(user) {
    if (!user?.id || recovering || signedUserId === user.id || pendingUserId === user.id) return;
    const ticket = ++sessionTicket;
    pendingUserId = user.id;
    authScreen.hidden = false;
    status("Carregando seus dados com segurança...");
    try {
      const { data: row, error } = await db.from("contador_data")
        .select("data,revision").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      if (ticket !== sessionTicket) return;
      let revision = row?.revision || 0;
      const backend = {
        async save(next) {
          const { data, error: rpcError } = await db.rpc("save_contador", {
            p_expected: revision, p_payload: next,
          });
          if (rpcError) throw getError(rpcError);
          if (!Number.isInteger(data) || data <= revision)
            throw Error("O banco não confirmou o salvamento.");
          revision = data;
        },
      };
      app.startCloud(backend, row?.data || app.emptyState());
      app.setEmail(user.email || "Conta conectada");
      signedUserId = user.id;
      pendingUserId = null;
      document.documentElement.classList.add("is-authed");
      authScreen.hidden = true;
    } catch (error) {
      if (ticket !== sessionTicket) return;
      pendingUserId = null;
      app.lockCloud();
      document.documentElement.classList.remove("is-authed");
      authScreen.hidden = false;
      mode("login", "Não foi possível carregar seus dados. Verifique o SQL, as permissões ou a conexão. Detalhe: " + error.message);
      console.error("Falha ao carregar dados", error);
    }
  }
  async function submit(id, handler) {
    const form = document.getElementById(id);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (inflight || !form.reportValidity()) return;
      inflight = true;
      form.querySelectorAll("button").forEach((b) => (b.disabled = true));
      status("Verificando...");
      try {
        const fields = Object.fromEntries(new FormData(form));
        await handler(fields);
      } catch (error) {
        status(getError(error).message);
      } finally {
        inflight = false;
        form.querySelectorAll("button").forEach((b) => (b.disabled = false));
      }
    });
  }
  document.querySelectorAll("[data-auth-mode]").forEach((b) =>
    b.addEventListener("click", () => { if (!inflight) mode(b.dataset.authMode); }));
  await submit("login-form", async ({ email, password }) => {
    const { data, error } = await db.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    if (data.user) await openUser(data.user);
  });
  await submit("signup-form", async ({ name, email, password, confirm }) => {
    if (!name || name.trim().length < 2 || name.trim().length > 80) throw Error("Informe um nome válido.");
    if (password !== confirm) throw Error("As senhas não coincidem.");
    const { data, error } = await db.auth.signUp({
      email: email.trim(), password,
      options: { emailRedirectTo: location.origin + location.pathname, data: { name: name.trim() } },
    });
    if (error) throw error;
    if (data.session?.user) await openUser(data.session.user);
    else mode("login", "Se o cadastro for aceito, você receberá um e-mail de confirmação. Confira sua caixa de entrada e spam.");
  });
  await submit("forgot-form", async ({ email }) => {
    const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: location.origin + location.pathname,
    });
    if (error) throw error;
    mode("login", "Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.");
  });
  await submit("reset-form", async ({ password, confirm }) => {
    if (password !== confirm) throw Error("As senhas não coincidem.");
    const { data, error } = await db.auth.updateUser({ password });
    if (error) throw error;
    recovering = false;
    mode("login", "Senha atualizada. Sua conta está pronta.");
    if (data.user) await openUser(data.user);
  });
  document.getElementById("google-login").addEventListener("click", async () => {
    if (inflight) return;
    inflight = true;
    const button = document.getElementById("google-login");
    button.disabled = true;
    status("Conectando ao Google...");
    try {
      const { error } = await db.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: location.origin + location.pathname },
      });
      if (error) throw error;
    } catch (error) {
      status("Não foi possível entrar com Google: " + (error.message || "Confira o provedor de login no Supabase."));
    } finally {
      inflight = false;
      button.disabled = false;
    }
  });
  document.getElementById("logout").addEventListener("click", async () => {
    if (app.isSaving()) { window.alert("Aguarde o salvamento antes de sair."); return; }
    const { error } = await db.auth.signOut();
    if (error) { window.alert("Não foi possível sair: " + error.message); return; }
    lock();
    mode("login", "Você saiu da sua conta.");
  });
  db.auth.onAuthStateChange((event, session) => {
    // Callback sem chamadas assíncronas ao cliente: evita deadlock no SDK.
    if (event === "PASSWORD_RECOVERY") {
      recovering = true;
      lock();
      mode("reset", "Digite uma nova senha para concluir a recuperação.");
    } else if (event === "SIGNED_OUT") {
      recovering = false;
      lock();
      mode("login", "Entre novamente para acessar seus dados.");
    } else if (session?.user && !recovering) {
      // Solicita acesso somente após o cliente concluir o evento de Auth.
      queueMicrotask(() => { void openUser(session.user); });
    } else if (event === "INITIAL_SESSION") {
      lock();
      mode("login");
    }
  });
  authScreen.hidden = false;
  mode("login");
}
