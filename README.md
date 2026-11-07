# Contador

Aplicativo web **mobile-first** para controle financeiro pessoal, feito com HTML, CSS e JavaScript sem bundler.

## O que está funcionando

- Dashboard mensal, gráfico de entradas e gastos, saldos por conta.
- Receitas, despesas, transferências entre contas (não alteram saldo total).
- Cartões de crédito: limite, compras, fatura mensal e pagamento sem duplicar despesa.
- Despesas recorrentes lançadas manualmente, metas, histórico com filtros, edição e exclusão.
- Tema claro/escuro, ocultação visual de valores, exportação e **importação de backup JSON**.
- **Modo nuvem configurável**: login, cadastro, confirmação de e-mail (conforme Auth), recuperação de senha, logout, sincronização por conta e RLS.

> Importante: ainda **não** há conexão automática com bancos, cobrança Premium, cobrança Stripe, importação OFX, PIX nem aplicativos nativos Android/iOS. Premium aparece como planejamento, sem assinatura ativa. O app não é instituição financeira.

## Rodar localmente (sem Supabase)

A configuração do Supabase já está ativa em `js/config.js`. Abra a pasta no VS Code e use *Live Server* ou o terminal:

```bash
python -m http.server 5500
```

Acesse `http://localhost:5500`. Agora o aplicativo usa **modo NUVEM com Supabase**; cadastros dependem de URLs autorizadas no painel. Para testes locais sem Supabase, use temporariamente uma cópia separada com os campos de `js/config.js` vazios. Nunca salve dados reais nesse modo de teste.

## Ativar autenticação e salvar no Supabase

1. **Concluído em 07/11/2026:** projeto Supabase `Contador` (São Paulo), tabela `contador_data`, RLS por `auth.uid()` e RPC `save_contador` com controle de versão. O SQL original permanece em `supabase/schema.sql` para referência.
2. Em **Project Settings > API Keys**, copie somente a **Publishable key** (`sb_publishable_...`) e a **Project URL** (`https://...supabase.co`). Nunca use uma Secret key, `service_role` ou senha de banco.
3. **Concluído:** os dois campos públicos já estão preenchidos em `js/config.js` (a publishable key não é segredo). Para alterar o projeto futuramente, use:

```js
window.CONTADOR_CONFIG = {
  url: "https://SEU-PROJETO.supabase.co",
  publishableKey: "sb_publishable_SUA-CHAVE-PUBLICA",
};
```

4. Em **Authentication > URL Configuration**, altere **Site URL** para seu domínio HTTPS e inclua em **Redirect URLs** os endereços completos que vão receber confirmação e recuperação (por exemplo, `https://usuario.github.io/Contador/` e `http://localhost:5500/` apenas para testes). Habilite o provedor **Email** e confirme que o serviço de e-mail do Supabase está adequado antes de abrir cadastro público.
5. Rode o projeto via Live Server, faça um cadastro de teste, confirme o e-mail e teste login, lançamento, reload, saída e recuperação de senha. O arquivo `js/cloud.js` usa **Supabase JS 2.119.0** no CDN; o navegador precisa de internet.
6. Para importar os dados locais, primeiro entre no modo local, exporte o backup e guarde-o. Depois ative a nuvem, faça login e importe o arquivo em **Preferências**. A importação **substitui** os dados existentes, mediante confirmação.

**Segurança:** Nunca confie só nas validações de JavaScript; as políticas do banco são a verdadeira separação entre contas. As operações usam um documento por usuário, revisão no servidor para detectar conflitos entre dispositivos e rejeição de documentos maiores que 1MB. A interface mostra falhas e impede novos salvamentos até recarregar se a confirmação remota falhar. O Supabase mantém a sessão de autenticação no navegador, mas os dados financeiros não são espelhados no localStorage do modo nuvem. Faça testes de permissões com dois usuários antes do lançamento comercial. O backup JSON fica sem criptografia e deve ser armazenado em segurança.


## Organização

```text
Contador/
├── index.html
├── css/style.css
├── js/
│   ├── app.js       # lógica financeira + validações
│   ├── cloud.js     # login, recuperação, sessão e sincronização
│   └── config.js    # SOMENTE configurações publicáveis
├── supabase/schema.sql
├── publicar-github.ps1
└── README.md
```



**Importante:** GitHub Pages só hospeda o frontend estático; Supabase fornece login, banco e políticas RLS. Não divulgue a demonstração como sistema bancário seguro nem use dados financeiros reais enquanto os testes de autenticação e isolamento entre usuários não forem concluídos.


## Etapas manuais ainda obrigatórias para login real

Os dados e o banco já estão conectados, mas **não divulgamos o app como produção validada** até conferir URLs de autenticação e fluxos em navegador real.

1. No [Supabase — URL Configuration](https://supabase.com/dashboard/project/upilhblozpwsiulybnsw/auth/url-configuration): configure **Site URL** como `https://glameiras.github.io/Contador/`, e adicione a mesma URL exatamente em **Redirect URLs**. Para testes em sua máquina, adicione separadamente `http://localhost:5500/`.
2. No [Supabase — Providers](https://supabase.com/dashboard/project/upilhblozpwsiulybnsw/auth/providers), confirme que **Email** está habilitado. O botão Google exige configurar Google Cloud OAuth (Client ID/Secret) no provedor Google. Não cole esses segredos no GitHub.
3. Teste dois e-mails diferentes e a recuperação de senha, além de redirecionamento e visibilidade dos dados. Configuração automática de URLs/provedores não está disponível na integração usada neste chat.
4. Confira em [Settings → Pages](https://github.com/glameiras/Contador/settings/pages) se a publicação **main / root** está ativa e o link responde com o app. A publicação não foi confirmada automaticamente por estas ferramentas.

**Status 07/11/2026:** banco, RLS e configuração pública do frontend implantados; Security Advisor sem alertas. Login humano real, fluxos de e-mail e Pages publicado requerem validação. O plano Supabase foi cotado em US$ 0/mês no momento da criação, dentro das condições e limites do plano gratuito.
