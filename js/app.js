/* CONTADOR — versão local 1.1 (validações revisadas)
 * Valores monetários são inteiros em centavos.
 * Contas guardam apenas o saldo inicial; o saldo atual deriva dos lançamentos.
 * Uma única gravação JSON confirma cada operação antes de atualizar a interface.
 * Supabase e autenticação serão implementados na etapa de produção.
 */
"use strict";
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const KEY = "contador-local-v1";
const LIMIT = 1000000000000;
const types = {
  income: "Entrada",
  expense: "Gasto",
  transfer: "Transferência",
  payment: "Pagamento de fatura",
  purchase: "Compra no crédito",
};
const titles = {
  dashboard: "Início",
  accounts: "Saldo",
  income: "Entradas",
  expense: "Gastos",
  transfer: "Transferências",
  cards: "Cartões",
  recurring: "Recorrências",
  goals: "Metas",
  history: "Histórico",
  settings: "Preferências",
  more: "Mais",
};
const uid = () => crypto.randomUUID();
const clone = (value) => JSON.parse(JSON.stringify(value));
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const currentMonth = () => today().slice(0, 7);
const format = (cents) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (date) => date.split("-").reverse().join("/");
// Validação de calendário sem converter datas locais para UTC.
const validDate = (date) => {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return false;
  const [year, month, day] = date.split("-").map(Number);
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1)
    return false;
  return day <= new Date(year, month, 0).getDate();
};
const validMonth = (month) =>
  typeof month === "string" &&
  /^\d{4}-(0[1-9]|1[0-2])$/.test(month) &&
  Number(month.slice(0, 4)) >= 1900;
const validMoney = (n) => Number.isSafeInteger(n) && Math.abs(n) <= LIMIT;
function cents(value, negative = false) {
  const str = String(value).trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(str))
    throw Error("Informe um valor com até duas casas decimais.");
  // Monta os centavos a partir do texto, sem multiplicação decimal.
  const sign = str.startsWith("-") ? -1 : 1;
  const [whole, decimal = ""] = str.replace(/^-/, "").split(".");
  const n = sign * (Number(whole) * 100 + Number(decimal.padEnd(2, "0")));
  if (!validMoney(n) || (!negative && n <= 0))
    throw Error("Informe um valor válido e maior que zero.");
  return n;
}
function text(value, max = 100) {
  if (typeof value !== "string") throw Error("O texto informado é inválido.");
  const s = value.trim();
  if (!s || s.length > max)
    throw Error(`Preencha o texto com até ${max} caracteres.`);
  return s;
}
function receivedDate(value) {
  if (!validDate(value) || value > today())
    throw Error("Use uma data válida, de hoje ou anterior.");
  return value;
}
function el(tag, cls, content) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (content !== undefined) node.textContent = content;
  return node;
}
function button(label, callback, cls = "small-button") {
  const b = el("button", cls, label);
  b.type = "button";
  b.addEventListener("click", () => {
    try {
      callback();
    } catch (e) {
      notify(e.message);
    }
  });
  return b;
}
let noticeTimer;
function notify(message) {
  $("#notice").textContent = message;
  $("#notice").hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => ($("#notice").hidden = true), 6000);
}
const emptyState = () => ({
  version: 1,
  accounts: [],
  transactions: [],
  cards: [],
  purchases: [],
  recurring: [],
  goals: [],
});
let state = emptyState();
let blocked = false;
let cloudBackend = null;
let cloudSavePending = false;

// Validação da estrutura persistida: não sobrescreve dados ilegíveis.
function validate(s) {
  if (!s || s.version !== 1) throw Error("Versão de dados incompatível.");
  for (const key of [
    "accounts",
    "transactions",
    "cards",
    "purchases",
    "recurring",
    "goals",
  ]) {
    if (!Array.isArray(s[key])) throw Error("Estrutura de dados inválida.");
    const ids = new Set();
    for (const item of s[key]) {
      if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id))
        throw Error("Identificadores inválidos.");
      ids.add(item.id);
    }
  }
  const accountExists = (id) => s.accounts.some((a) => a.id === id);
  for (const a of s.accounts) {
    text(a.name, 60);
    if (!validMoney(a.initial)) throw Error("Saldo inicial inválido.");
  }
  for (const t of s.transactions) {
    if (
      !["income", "expense", "transfer", "payment"].includes(t.type) ||
      !accountExists(t.account) ||
      !validMoney(t.value) ||
      t.value <= 0 ||
      !validDate(t.date) ||
      t.date > today()
    )
      throw Error("Movimentação inválida.");
    text(t.description);
    text(t.category, 40);
    if (t.type === "transfer" && (!accountExists(t.to) || t.to === t.account))
      throw Error("Transferência inválida.");
    if (t.type === "payment" && !s.cards.some((c) => c.id === t.card))
      throw Error("Cartão não encontrado.");
  }
  for (const c of s.cards) {
    text(c.name, 60);
    if (
      !validMoney(c.limit) ||
      c.limit <= 0 ||
      !Number.isInteger(c.due) ||
      c.due < 1 ||
      c.due > 31
    )
      throw Error("Cartão inválido.");
  }
  for (const p of s.purchases) {
    text(p.description);
    if (
      !s.cards.some((c) => c.id === p.card) ||
      !validDate(p.date) ||
      p.date > today() ||
      !validMonth(p.month) ||
      p.month < p.date.slice(0, 7) ||
      !validMoney(p.value) ||
      p.value <= 0
    )
      throw Error("Compra inválida.");
    if (p.payment !== null && (typeof p.payment !== "string" || !p.payment))
      throw Error("Referência de pagamento inválida.");
    if (
      p.payment &&
      !s.transactions.some(
        (t) =>
          t.id === p.payment &&
          t.type === "payment" &&
          t.card === p.card &&
          t.date >= p.date,
      )
    )
      throw Error("Pagamento de compra inválido.");
  }
  for (const t of s.transactions.filter((t) => t.type === "payment")) {
    if (
      s.purchases
        .filter((p) => p.payment === t.id)
        .reduce((sum, p) => sum + p.value, 0) !== t.value
    )
      throw Error("Total da fatura inconsistente.");
  }
  // O mesmo pagamento não pode quitar faturas de meses diferentes.
  for (const t of s.transactions.filter((t) => t.type === "payment")) {
    const months = new Set(
      s.purchases.filter((p) => p.payment === t.id).map((p) => p.month),
    );
    if (months.size !== 1)
      throw Error("O pagamento deve corresponder a uma única fatura.");
  }
  for (const c of s.cards) {
    const used = s.purchases
      .filter((p) => p.card === c.id && !p.payment)
      .reduce((sum, p) => sum + p.value, 0);
    if (used > c.limit)
      throw Error(
        "Esta operação ultrapassa o limite do cartão. Revise as compras em aberto antes de continuar.",
      );
  }
  const occurrences = new Set();
  for (const t of s.transactions) {
    if (t.recurring !== undefined || t.occurrence !== undefined) {
      if (
        t.type !== "expense" ||
        typeof t.recurring !== "string" ||
        !t.recurring ||
        !validDate(t.occurrence) ||
        t.occurrence > t.date
      )
        throw Error("Ocorrência de gasto recorrente inválida.");
      const key = JSON.stringify([t.recurring, t.occurrence]);
      if (occurrences.has(key)) throw Error("Ocorrência recorrente duplicada.");
      occurrences.add(key);
      const rule = s.recurring.find((r) => r.id === t.recurring);
      if (
        rule &&
        (!Array.isArray(rule.runs) || !rule.runs.includes(t.occurrence))
      )
        throw Error("Histórico da recorrência inconsistente.");
    }
  }
  for (const r of s.recurring) {
    text(r.description);
    if (
      !accountExists(r.account) ||
      !validMoney(r.value) ||
      r.value <= 0 ||
      !validDate(r.next) ||
      !["monthly", "weekly", "yearly"].includes(r.period) ||
      !Array.isArray(r.runs) ||
      !r.runs.every(validDate) ||
      new Set(r.runs).size !== r.runs.length ||
      r.runs.some((date) => date >= r.next || date > today()) ||
      !Number.isInteger(r.anchor) ||
      r.anchor < 1 ||
      r.anchor > 31
    )
      throw Error("Recorrência inválida.");
  }
  for (const g of s.goals) {
    text(g.name, 60);
    if (
      !validMoney(g.target) ||
      g.target <= 0 ||
      !validMoney(g.saved) ||
      g.saved < 0 ||
      g.saved > g.target
    )
      throw Error("Meta inválida.");
  }
  const balances = balanceMap(s);
  if (
    [...balances.values()].some((v) => !validMoney(v)) ||
    !validMoney([...balances.values()].reduce((a, b) => a + b, 0))
  )
    throw Error("O saldo ultrapassa o limite desta versão.");
  if (
    s.transactions.reduce((a, t) => a + t.value, 0) +
      s.purchases.reduce((a, p) => a + p.value, 0) >
    LIMIT
  )
    throw Error("O volume de registros ultrapassa o limite desta versão.");
  return s;
}
function load() {
  const saved = localStorage.getItem(KEY);
  if (saved !== null) return validate(JSON.parse(saved));
  // Migração não destrutiva das chaves usadas nas aulas anteriores.
  const previousAccounts = JSON.parse(
    localStorage.getItem("contador-contas") || "[]",
  );
  const previousMoves = JSON.parse(
    localStorage.getItem("contador-movimentacoes") || "[]",
  );
  if (!Array.isArray(previousAccounts) || !Array.isArray(previousMoves))
    throw Error("Os dados anteriores precisam de revisão.");
  const s = emptyState();
  s.accounts = previousAccounts.map((a) => ({
    id: a.id,
    name: a.nome,
    initial: a.saldoInicialEmCentavos,
  }));
  s.transactions = previousMoves.map((t) => ({
    id: t.id,
    type:
      t.tipo === "entrada"
        ? "income"
        : t.tipo === "saida"
          ? "expense"
          : "invalid",
    description: t.descricao,
    value: t.valorEmCentavos,
    account: t.contaId,
    date: t.data,
    category: t.categoria || "Outros",
  }));
  validate(s);
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}
function commit(next, message = "Salvo com sucesso.") {
  if (blocked || cloudSavePending) throw Error("Aguarde a operação anterior.");
  validate(next);
  if (cloudBackend) {
    // A nuvem confirma o salvamento antes de o novo estado aparecer na interface.
    // Regras RLS e revisão otimista são verificadas no PostgreSQL.
    cloudSavePending = true;
    cloudBackend.save(next).then(() => {
      state = next;
      cloudSavePending = false;
      render();
      notify(message);
    }).catch((error) => {
      cloudSavePending = false;
      blocked = true; // Nunca sobrescreva uma revisão remota em conflito.
      notify("Não foi possível salvar: " + (error.message || "erro de conexão") + ". Recarregue a página para consultar os dados salvos.");
      console.error("Erro de persistência", error);
    });
    notify("Salvando com segurança...");
    return;
  }
  // Modo local: impede conflito entre abas, preservando a versão anterior.
  const disk = localStorage.getItem(KEY);
  if (disk !== JSON.stringify(state))
    throw Error("Os dados mudaram em outra aba. Recarregue antes de continuar.");
  localStorage.setItem(KEY, JSON.stringify(next));
  state = next;
  render();
  notify(message);
}
function balanceMap(s = state) {
  const map = new Map(s.accounts.map((a) => [a.id, a.initial]));
  for (const t of s.transactions) {
    map.set(
      t.account,
      (map.get(t.account) || 0) + (t.type === "income" ? t.value : -t.value),
    );
    if (t.type === "transfer") map.set(t.to, (map.get(t.to) || 0) + t.value);
  }
  return map;
}
function confirmBalances(next) {
  const before = balanceMap(),
    after = balanceMap(next);
  const affected = next.accounts.filter(
    (a) => after.get(a.id) < 0 && after.get(a.id) < (before.get(a.id) || 0),
  );
  if (!affected.length) return true;
  return confirm(
    "Esta operação deixará ou aumentará o saldo negativo:\n" +
      affected.map((a) => `${a.name}: ${format(after.get(a.id))}`).join("\n") +
      "\n\nDeseja confirmar?",
  );
}
function accountName(id) {
  return state.accounts.find((a) => a.id === id)?.name || "Conta indisponível";
}
function selectAccounts(select, placeholder = "Selecione uma conta") {
  const previous = select.value;
  select.replaceChildren(
    new Option(
      select.dataset.all === "true" ? "Todas as contas" : placeholder,
      "",
    ),
  );
  state.accounts.forEach((a) => select.add(new Option(a.name, a.id)));
  if (state.accounts.some((a) => a.id === previous)) select.value = previous;
}
function bindForm(id, handler) {
  $("#" + id).addEventListener("submit", (event) => {
    event.preventDefault();
    if (blocked) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    try {
      const success = handler(Object.fromEntries(new FormData(form)), form);
      if (success !== false) {
        form.reset();
        defaults(form);
      }
    } catch (error) {
      notify(error.message || "Não foi possível concluir a operação.");
    }
  });
}
function defaults(root = document) {
  $$("input[type=date]", root).forEach((i) => {
    i.min = "1900-01-01";
    i.max = "9999-12-31";
  });
  $$(".today", root).forEach((i) => (i.value = today()));
  [
    "income-form",
    "expense-form",
    "transfer-form",
    "purchase-form",
    "edit-form",
  ].forEach((id) => {
    const input = $(`#${id} input[name=date]`);
    if (input) input.max = today();
  });
  $$(".this-month", root).forEach((i) => (i.value = currentMonth()));
}
function requireAccount(id) {
  if (!state.accounts.some((a) => a.id === id))
    throw Error("Cadastre e selecione uma conta.");
  return id;
}
function addTransaction(type, d) {
  const next = clone(state);
  const transaction = {
    id: uid(),
    type,
    description: text(d.description),
    value: cents(d.value),
    account: requireAccount(d.account),
    date: receivedDate(d.date),
    category: text(d.category || "Transferência", 40),
  };
  if (type === "transfer") {
    transaction.to = requireAccount(d.to);
    if (transaction.account === transaction.to)
      throw Error("Selecione contas diferentes.");
  }
  next.transactions.push(transaction);
  if (!confirmBalances(next)) return false;
  commit(next, "Lançamento registrado.");
}
bindForm("account-form", (d) => {
  const next = clone(state),
    name = text(d.name, 60);
  if (
    next.accounts.some(
      (a) => a.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
  )
    throw Error("Use um nome diferente para esta conta.");
  next.accounts.push({ id: uid(), name, initial: cents(d.initial, true) });
  commit(next, "Conta cadastrada.");
});
bindForm("income-form", (d) => addTransaction("income", d));
bindForm("expense-form", (d) => addTransaction("expense", d));
bindForm("transfer-form", (d) => addTransaction("transfer", d));
bindForm("card-form", (d) => {
  const next = clone(state);
  next.cards.push({
    id: uid(),
    name: text(d.name, 60),
    limit: cents(d.limit),
    due: Number(d.due),
  });
  commit(next, "Cartão cadastrado.");
});
bindForm("purchase-form", (d) => {
  const card = state.cards.find((c) => c.id === d.card);
  if (!card) throw Error("Cadastre e selecione um cartão.");
  const value = cents(d.value),
    date = receivedDate(d.date);
  if (!validMonth(d.month) || d.month < date.slice(0, 7))
    throw Error("A fatura deve ser do mês da compra ou posterior.");
  const used = state.purchases
    .filter((p) => p.card === card.id && !p.payment)
    .reduce((a, p) => a + p.value, 0);
  if (value + used > card.limit)
    throw Error("A compra ultrapassa o limite disponível do cartão.");
  const next = clone(state);
  next.purchases.push({
    id: uid(),
    card: card.id,
    description: text(d.description),
    value,
    date,
    month: d.month,
    payment: null,
  });
  commit(next, "Compra registrada na fatura.");
});
bindForm("recurring-form", (d) => {
  if (!validDate(d.date)) throw Error("Informe um vencimento válido.");
  const next = clone(state);
  next.recurring.push({
    id: uid(),
    description: text(d.description),
    value: cents(d.value),
    account: requireAccount(d.account),
    next: d.date,
    anchor: Number(d.date.slice(8)),
    period: d.period,
    runs: [],
  });
  commit(next, "Recorrência criada.");
});
bindForm("goal-form", (d) => {
  const next = clone(state);
  next.goals.push({
    id: uid(),
    name: text(d.name, 60),
    target: cents(d.target),
    saved: 0,
  });
  commit(next, "Meta criada.");
});

// Dashboard: compras no crédito são despesas na data da compra.
// Pagamentos de fatura e transferências ficam fora das somas de receitas/despesas.
function expenses() {
  return [
    ...state.transactions.filter((t) => t.type === "expense"),
    ...state.purchases.map((p) => ({ ...p, type: "purchase" })),
  ];
}
function monthTotals(month) {
  const sum = (rows) =>
    rows
      .filter((t) => t.date.startsWith(month))
      .reduce((s, t) => s + t.value, 0);
  return {
    income: sum(state.transactions.filter((t) => t.type === "income")),
    expense: sum(expenses()),
  };
}
function priorMonth(month) {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(year, m - 2, 1, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function changeLabel(now, before) {
  if (!before)
    return now ? "Sem base no mês anterior" : "Sem movimentação nos dois meses";
  const percent = ((now - before) / before) * 100;
  return `${percent > 0 ? "+" : ""}${percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs. mês anterior`;
}
function renderDashboard() {
  const total = [...balanceMap().values()].reduce((a, b) => a + b, 0);
  $("#total-balance").textContent = format(total);
  $("#total-balance").classList.toggle("negative", total < 0);
  $("#account-count").textContent = state.accounts.length
    ? `${state.accounts.length} conta(s) cadastrada(s)`
    : "Cadastre sua primeira conta para começar";
  const month = $("#dashboard-month").value || currentMonth(),
    now = monthTotals(month),
    before = monthTotals(priorMonth(month));
  $("#month-income").textContent = format(now.income);
  $("#month-expense").textContent = format(now.expense);
  $("#income-change").textContent = changeLabel(now.income, before.income);
  $("#expense-change").textContent = changeLabel(now.expense, before.expense);
  renderChart(month);
  const list = $("#recent-list");
  list.replaceChildren();
  const rows = historyRows().slice(0, 4);
  rows.forEach((t) => list.append(historyCard(t, false)));
  if (!rows.length)
    list.append(
      el("p", "empty", "Seu histórico começa com o primeiro lançamento."),
    );
}
function renderChart(month) {
  const [year, m] = month.split("-").map(Number),
    days = new Date(year, m, 0).getDate();
  const income = Array(days).fill(0),
    expense = Array(days).fill(0);
  state.transactions
    .filter((t) => t.type === "income" && t.date.startsWith(month))
    .forEach((t) => (income[Number(t.date.slice(8)) - 1] += t.value));
  expenses()
    .filter((t) => t.date.startsWith(month))
    .forEach((t) => (expense[Number(t.date.slice(8)) - 1] += t.value));
  const ceiling = Math.max(10000, ...income, ...expense),
    max = ceiling / 100;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 760 240");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    `Entradas e gastos diários de ${month}. Escala de zero até ${format(ceiling)}.`,
  );
  function node(tag, attrs, content) {
    const n = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v)));
    if (content !== undefined) n.textContent = content;
    svg.append(n);
    return n;
  }
  for (let i = 0; i <= 4; i++) {
    const y = 20 + i * 45;
    node("line", { x1: 100, y1: y, x2: 745, y2: y, class: "chart-grid" });
    node(
      "text",
      { x: 90, y: y + 4, "text-anchor": "end" },
      ((max * (4 - i)) / 4).toLocaleString("pt-BR", {
        maximumFractionDigits: 0,
      }),
    );
  }
  node("text", { x: 14, y: 13 }, "R$");
  [1, Math.round(days / 2), days].forEach((day) =>
    node(
      "text",
      {
        x: 100 + ((day - 1) / (days - 1)) * 645,
        y: 225,
        "text-anchor": "middle",
      },
      String(day).padStart(2, "0"),
    ),
  );
  function line(values, cls) {
    node("polyline", {
      points: values
        .map(
          (v, i) =>
            `${100 + (i / (days - 1)) * 645},${200 - (v / ceiling) * 180}`,
        )
        .join(" "),
      class: `chart-line ${cls}`,
    });
  }
  line(income, "chart-income");
  line(expense, "chart-expense");
  $("#chart").replaceChildren(svg);
  const a = monthTotals(month),
    b = monthTotals(priorMonth(month));
  $("#chart-summary").textContent =
    `Mês anterior: ${format(b.income)} em entradas e ${format(b.expense)} em gastos. Resultado do mês selecionado: ${format(a.income - a.expense)}.`;
}
function renderAccounts() {
  const list = $("#account-list");
  list.replaceChildren();
  const balances = balanceMap();
  state.accounts.forEach((a) => {
    const row = el("article", "row-card"),
      body = el("div");
    body.append(
      el("h3", "", a.name),
      el(
        "p",
        `amount money ${balances.get(a.id) < 0 ? "negative" : ""}`,
        format(balances.get(a.id)),
      ),
      el("p", "muted money", `Saldo inicial: ${format(a.initial)}`),
    );
    row.append(body);
    list.append(row);
  });
  if (!state.accounts.length)
    list.append(el("p", "empty", "Nenhuma conta cadastrada. Comece ao lado."));
}
function historyRows() {
  return [
    ...state.transactions,
    ...state.purchases.map((p) => ({
      ...p,
      type: "purchase",
      category: "Cartão de crédito",
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}
function historyCard(t, actions = true) {
  const row = el("article", "row-card history-card"),
    body = el("div");
  let detail =
    t.type === "purchase"
      ? state.cards.find((c) => c.id === t.card)?.name || "Cartão"
      : accountName(t.account);
  if (t.type === "transfer") detail += ` → ${accountName(t.to)}`;
  body.append(
    el("h3", "", t.description),
    el("p", "muted", `${dateLabel(t.date)} · ${detail}`),
    el("span", "badge", types[t.type]),
  );
  if (actions) {
    const controls = el("div", "row-actions");
    if (["income", "expense"].includes(t.type) && !t.recurring)
      controls.append(button("Editar", () => openEdit(t)));
    if (t.type !== "purchase" || !t.payment)
      controls.append(button("Excluir", () => removeTransaction(t)));
    if (t.type === "purchase" && t.payment)
      controls.append(el("span", "muted", "Fatura paga"));
    body.append(controls);
  }
  const value = el(
    "p",
    `history-amount money ${t.type === "income" ? "positive" : ["expense", "purchase"].includes(t.type) ? "negative" : ""}`,
    `${t.type === "income" ? "+ " : ""}${format(t.value)}`,
  );
  row.append(body, value);
  return row;
}
function renderHistory() {
  const f = Object.fromEntries(new FormData($("#filters"))),
    list = $("#history-list");
  list.replaceChildren();
  if (f.from && f.until && f.from > f.until) {
    $("#history-count").textContent = "Período inválido";
    list.append(
      el(
        "p",
        "empty",
        "A data inicial deve ser anterior ou igual à data final.",
      ),
    );
    return;
  }
  const search = (f.search || "").toLocaleLowerCase();
  const rows = historyRows().filter((t) => {
    const accountMatch =
      !f.account || t.account === f.account || t.to === f.account;
    return (
      accountMatch &&
      (!f.type || t.type === f.type) &&
      (!f.from || t.date >= f.from) &&
      (!f.until || t.date <= f.until) &&
      (!f.value || t.value === Math.round(Number(f.value) * 100)) &&
      `${t.description} ${t.category}`.toLocaleLowerCase().includes(search)
    );
  });
  $("#history-count").textContent =
    `${rows.length} lançamento(s) encontrado(s)`;
  rows.forEach((t) => list.append(historyCard(t)));
  if (!rows.length)
    list.append(el("p", "empty", "Nenhum lançamento para estes filtros."));
}
function removeTransaction(t) {
  if (!confirm("Excluir este lançamento? Os saldos serão recalculados."))
    return;
  const next = clone(state);
  if (t.type === "purchase")
    next.purchases = next.purchases.filter((p) => p.id !== t.id);
  else {
    next.transactions = next.transactions.filter((x) => x.id !== t.id);
    if (t.type === "payment")
      next.purchases.forEach((p) => {
        if (p.payment === t.id) p.payment = null;
      });
  }
  if (!confirmBalances(next)) return;
  commit(next, "Lançamento excluído.");
}
function openEdit(t) {
  const f = $("#edit-form");
  for (const [key, val] of Object.entries({
    id: t.id,
    description: t.description,
    value: (t.value / 100).toFixed(2),
    account: t.account,
    date: t.date,
    category: t.category,
  }))
    f.elements.namedItem(key).value = val;
  $("#edit-dialog").showModal();
}
bindForm("edit-form", (d) => {
  const next = clone(state),
    t = next.transactions.find((t) => t.id === d.id);
  if (!t || !["income", "expense"].includes(t.type) || t.recurring)
    throw Error("Este lançamento não pode ser editado por este formulário.");
  Object.assign(t, {
    description: text(d.description),
    value: cents(d.value),
    account: requireAccount(d.account),
    date: receivedDate(d.date),
    category: text(d.category, 40),
  });
  if (!confirmBalances(next)) return false;
  commit(next, "Lançamento atualizado.");
  $("#edit-dialog").close();
});
$("#close-edit").addEventListener("click", () => $("#edit-dialog").close());

// Faturas: mês escolhido explicitamente; esta versão não divide compras em parcelas.
function dueDate(month, day) {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(Math.min(day, new Date(y, m, 0).getDate())).padStart(2, "0")}`;
}
function renderCards() {
  const list = $("#card-list");
  list.replaceChildren();
  state.cards.forEach((c) => {
    const purchases = state.purchases.filter((p) => p.card === c.id),
      used = purchases
        .filter((p) => !p.payment)
        .reduce((s, p) => s + p.value, 0);
    const card = el("article", "panel card-block");
    card.append(
      el("h2", "", c.name),
      el(
        "p",
        "muted money",
        `Limite: ${format(c.limit)} · Disponível: ${format(c.limit - used)}`,
      ),
    );
    const months = [...new Set(purchases.map((p) => p.month))].sort();
    months.forEach((month) => {
      const rows = purchases.filter((p) => p.month === month),
        open = rows.filter((p) => !p.payment),
        total = open.reduce((s, p) => s + p.value, 0),
        due = dueDate(month, c.due);
      const box = el("div", "invoice");
      box.append(
        el("h3", "", `Fatura ${month.split("-").reverse().join("/")}`),
        el(
          "p",
          "muted",
          `Vencimento: ${dateLabel(due)}${total && due < today() ? " · Vencida" : ""}`,
        ),
        el("p", "amount money", `Em aberto: ${format(total)}`),
      );
      rows.forEach((p) =>
        box.append(
          el(
            "p",
            "muted money",
            `${p.description} · ${format(p.value)}${p.payment ? " · Pago" : ""}`,
          ),
        ),
      );
      if (total) {
        const label = el("label", "", "Pagar com a conta");
        const select = el("select");
        selectAccounts(select);
        label.append(select);
        box.append(label);
        box.append(
          button(
            "Pagar fatura",
            () => {
              const account = requireAccount(select.value);
              if (
                !confirm(
                  `Confirmar pagamento de ${format(total)} com ${accountName(account)}?`,
                )
              )
                return;
              const next = clone(state),
                id = uid();
              next.transactions.push({
                id,
                type: "payment",
                description: `Fatura ${c.name} · ${month}`,
                value: total,
                account,
                date: today(),
                category: "Fatura",
                card: c.id,
              });
              next.purchases.forEach((p) => {
                if (p.card === c.id && p.month === month && !p.payment)
                  p.payment = id;
              });
              if (!confirmBalances(next)) return;
              commit(next, "Fatura paga. Limite liberado.");
            },
            "primary",
          ),
        );
      } else box.append(el("span", "badge", "Fatura quitada"));
      card.append(box);
    });
    if (!months.length)
      card.append(el("p", "muted", "Nenhuma compra registrada."));
    list.append(card);
  });
  if (!state.cards.length)
    list.append(
      el("p", "empty", "Cadastre um cartão para acompanhar compras e faturas."),
    );
}
function nextOccurrence(r) {
  const [y, m, d] = r.next.split("-").map(Number);
  if (r.period === "weekly") {
    const n = new Date(y, m - 1, d + 7, 12);
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }
  const n = new Date(
    y + (r.period === "yearly" ? 1 : 0),
    m - 1 + (r.period === "monthly" ? 1 : 0),
    1,
    12,
  );
  const year = n.getFullYear(),
    month = n.getMonth() + 1;
  return dueDate(`${year}-${String(month).padStart(2, "0")}`, r.anchor);
}
function renderRecurring() {
  const list = $("#recurring-list");
  list.replaceChildren();
  const periods = { monthly: "Mensal", weekly: "Semanal", yearly: "Anual" };
  state.recurring.forEach((r) => {
    const card = el("article", "panel");
    card.append(
      el("h3", "", r.description),
      el("p", "amount money", format(r.value)),
      el(
        "p",
        "muted",
        `${accountName(r.account)} · ${periods[r.period]} · Vencimento: ${dateLabel(r.next)}`,
      ),
    );
    const actions = el("div", "row-actions");
    const pay = button("Registrar pagamento", () => {
      if (r.next > today())
        throw Error("Aguarde o vencimento para registrar esta ocorrência.");
      if (r.runs.includes(r.next))
        throw Error("Esta ocorrência já foi registrada.");
      const next = clone(state),
        record = next.recurring.find((x) => x.id === r.id);
      next.transactions.push({
        id: uid(),
        type: "expense",
        description: r.description,
        value: r.value,
        account: r.account,
        date: today(),
        category: "Recorrente",
        recurring: r.id,
        occurrence: r.next,
      });
      record.runs.push(r.next);
      record.next = nextOccurrence(record);
      if (!confirmBalances(next)) return;
      commit(next, "Pagamento registrado; próximo vencimento atualizado.");
    });
    pay.disabled = r.next > today();
    actions.append(pay);
    actions.append(
      button("Encerrar", () => {
        if (
          !confirm(
            "Encerrar esta recorrência? Os pagamentos anteriores serão mantidos.",
          )
        )
          return;
        const next = clone(state);
        next.recurring = next.recurring.filter((x) => x.id !== r.id);
        commit(next, "Recorrência encerrada.");
      }),
    );
    card.append(actions);
    list.append(card);
  });
  if (!state.recurring.length)
    list.append(el("p", "empty", "Nenhum gasto recorrente cadastrado."));
}
function renderGoals() {
  const list = $("#goal-list");
  list.replaceChildren();
  state.goals.forEach((g) => {
    const card = el("article", "panel goal-card"),
      progress = el("progress", "money");
    progress.max = g.target;
    progress.value = g.saved;
    progress.setAttribute("aria-label", `Progresso de ${g.name}`);
    card.append(
      el("h3", "", g.name),
      progress,
      el(
        "p",
        "muted money",
        `${format(g.saved)} de ${format(g.target)} · ${Math.round((g.saved / g.target) * 100)}%`,
      ),
    );
    const form = el("form", "inline-form"),
      label = el("label", "", "Atualizar valor já reservado (R$)"),
      input = el("input");
    input.type = "number";
    input.step = ".01";
    input.min = "0";
    input.max = String(g.target / 100);
    input.value = (g.saved / 100).toFixed(2);
    input.required = true;
    input.setAttribute("aria-label", "Valor já reservado");
    const save = el("button", "small-button", "Atualizar");
    save.type = "submit";
    form.append(label, input, save);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const saved = cents(input.value, true);
        if (saved < 0 || saved > g.target)
          throw Error("A reserva deve ficar entre zero e o valor da meta.");
        const next = clone(state);
        next.goals.find((x) => x.id === g.id).saved = saved;
        commit(next, "Meta atualizada.");
      } catch (error) {
        notify(error.message);
      }
    });
    card.append(
      form,
      button("Excluir meta", () => {
        if (!confirm("Excluir esta meta?")) return;
        const next = clone(state);
        next.goals = next.goals.filter((x) => x.id !== g.id);
        commit(next, "Meta excluída.");
      }),
    );
    list.append(card);
  });
  if (!state.goals.length)
    list.append(
      el("p", "empty", "Qual é seu próximo objetivo? Crie uma meta."),
    );
}
function render() {
  $$(".account-options").forEach((s) => selectAccounts(s));
  $$(".card-options").forEach((s) => {
    const old = s.value;
    s.replaceChildren(new Option("Selecione um cartão", ""));
    state.cards.forEach((c) => s.add(new Option(c.name, c.id)));
    if (state.cards.some((c) => c.id === old)) s.value = old;
  });
  renderDashboard();
  renderAccounts();
  renderHistory();
  renderCards();
  renderRecurring();
  renderGoals();
}
function navigate(page, focus = false) {
  if (!titles[page]) page = "dashboard";
  $$(".page").forEach((s) => (s.hidden = s.id !== page));
  $$(".bottom-nav button").forEach((b) => {
    const active =
      b.dataset.page === page ||
      (b.dataset.page === "more" &&
        !["dashboard", "accounts", "income", "expense"].includes(page));
    if (active) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  document.title = `Contador | ${titles[page]}`;
  if (focus) {
    const h = $(`#${page} h1`);
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}
$$("[data-page]").forEach((b) =>
  b.addEventListener("click", () => {
    const page = b.dataset.page;
    if (location.hash === "#" + page) navigate(page, true);
    else location.hash = page;
  }),
);
window.addEventListener("hashchange", () =>
  navigate(location.hash.slice(1), true),
);
$("#dashboard-month").addEventListener("change", () => {
  if (!validMonth($("#dashboard-month").value))
    $("#dashboard-month").value = currentMonth();
  renderDashboard();
});
$("#filters").addEventListener("input", renderHistory);
$("#filters").addEventListener("change", renderHistory);
$("#filters").addEventListener("reset", () => setTimeout(renderHistory, 0));
function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
  $("#theme").textContent = dark ? "Modo claro" : "Modo escuro";
  $("#theme").setAttribute("aria-pressed", String(dark));
  $('meta[name="theme-color"]').content = dark ? "#000000" : "#FFFFFF";
}
$("#theme").addEventListener("click", () => {
  const dark = !document.body.classList.contains("dark");
  applyTheme(dark);
  try {
    localStorage.setItem("contador-tema", dark ? "escuro" : "claro");
  } catch {
    notify("Não foi possível salvar a preferência de tema.");
  }
});
$("#privacy").addEventListener("click", () => {
  const hidden = document.body.classList.toggle("private");
  $("#privacy").textContent = hidden ? "Mostrar valores" : "Ocultar valores";
  $("#privacy").setAttribute("aria-pressed", String(hidden));
});
$("#export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = el("a");
  a.href = url;
  a.download = `contador-backup-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener("storage", (e) => {
  if (!cloudBackend && e.key === KEY) {
    notify("Os dados foram alterados em outra aba. Recarregue para continuar.");
  }
});
// Autenticação: o modo nuvem NÃO acessa os dados financeiros do modo local.
window.ContadorApp = Object.freeze({
  emptyState,
  isSaving() { return cloudSavePending; },
  startCloud(backend, initial) {
    validate(initial);
    cloudBackend = backend;
    state = clone(initial);
    blocked = false;
    cloudSavePending = false;
    $("#mode-badge").textContent = "NUVEM";
    $("#data-heading").textContent = "Dados sincronizados";
    $("#storage-description").textContent = "Os lançamentos desta conta são salvos no Supabase. Cada usuário acessa somente seus próprios registros através de RLS.";
    $("#logout").hidden = false;
    $("#current-user").hidden = false;
    render();
    navigate(location.hash.slice(1));
  },
  lockCloud() {
    blocked = true;
    cloudBackend = null;
    cloudSavePending = false;
    state = emptyState();
    $("#current-user").textContent = "";
    $("#current-user").hidden = true;
    $("#logout").hidden = true;
    render();
  },
  setEmail(email) { $("#current-user").textContent = email; },
});
$("#import-file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw Error("O arquivo deve ter até 1 MB.");
    const next = validate(JSON.parse(await file.text()));
    if (!confirm("Importar este backup substituirá todos os dados atuais. Faça um backup antes. Continuar?")) return;
    commit(next, "Backup importado com sucesso.");
  } catch (error) { notify("Falha na importação: " + error.message); }
  finally { e.target.value = ""; }
});
try {
  applyTheme(localStorage.getItem("contador-tema") === "escuro");
  defaults();
  $("#dashboard-month").value = currentMonth();
  if (!document.documentElement.classList.contains("cloud-mode")) {
    state = load();
    render();
    navigate(location.hash.slice(1));
  } else blocked = true;
} catch (error) {
  blocked = true;
  $("#fatal").hidden = false;
  $("#fatal").textContent = "Não foi possível abrir os dados. Os registros não foram apagados. Detalhe: " + error.message;
  console.error(error);
}
