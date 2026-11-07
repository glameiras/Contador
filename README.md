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

Abra a pasta no VS Code e use *Live Server* ou o terminal:

```bash
python -m http.server 5500
```

Acesse `http://localhost:5500`. Como `js/config.js` está vazio, o aplicativo abre em **modo LOCAL**, salvando no `localStorage`. O backup permite migração posterior.

## Ativar autenticação e salvar no Supabase

1. Crie um projeto no [Supabase](https://supabase.com/dashboard) e, no **SQL Editor**, execute `supabase/schema.sql`. Ele cria `contador_data`, habilita RLS por `auth.uid()` e configura a função transacional de salvamento com controle de versão.
2. Em **Project Settings > API Keys**, copie somente a **Publishable key** (`sb_publishable_...`) e a **Project URL** (`https://...supabase.co`). Nunca use uma Secret key, `service_role` ou senha de banco.
3. Preencha esses dois campos em `js/config.js`:

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

## Publicar com GitHub Pages

1. No GitHub, crie um novo repositório **Contador** (de preferência privado enquanto estiver em testes).
2. Envie esta pasta inteira mantendo `index.html` na raiz, `css/`, `js/`, `supabase/` e `README.md`.
3. Após revisar o código e as chaves públicas, caso queira disponibilizar para testes externos, deixe o repositório público, vá em **Settings > Pages > Deploy from a branch > main / root**.
4. Se você usa o Windows, pode fazer o upload por Git usando o script `publicar-github.ps1` **depois de criar o repositório vazio**. Execute `powershell -ExecutionPolicy Bypass -File .\publicar-github.ps1` na pasta do projeto, caso sua política local impeça a execução direta.
5. Adicione a URL publicada à lista de redirecionamentos do Auth. Para domínio próprio, configure DNS/CNAME e a opção **Custom domain** do Pages.

**Atenção:** GitHub Pages é hospedagem de arquivos estáticos, não servidor de pagamento. Para Premium, uma API segura (Edge Function / servidor) com checkout e webhook assinado deve conceder o plano no banco; nunca dê Premium alterando `localStorage` ou apenas JavaScript.

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

## Testes mínimos antes de produção

- Duas contas diferentes: cada uma vê apenas seus registros.
- Cadastro, confirmação de e-mail, logout, login, esqueci minha senha e troca de senha.
- Despesas, receitas, transferências, limite de cartão, pagamento de fatura e recorrências.
- Teste simultâneo em duas abas e dois dispositivos, com conflito detectado.
- Importar backup inválido e backup de uma versão anterior.
- Aplicativo no celular via HTTPS; checar acessibilidade, limites e cenários de erro.

**Estado:** código pronto para **configuração e testes reais de integração**; não confundir com produção auditada, pagamentos Premium ou conexão bancária efetiva.


## Tela de acesso (inspirada no FitTrack)

A interface inclui **entrar, criar conta com nome, mostrar/ocultar senha, recuperar senha e continuar com Google**. A identidade é própria do Contador.

**Antes do Supabase estar configurado:** a tela funciona como apresentação do produto e o botão **Experimentar demonstração** abre a versão local. Os botões de login e cadastro NÃO simulam credenciais nem criam usuários. Dados inseridos na demonstração ficam apenas no navegador e devem ser fictícios.

**Após configurar o Supabase:** o sistema usa login real e sincronização, e o modo demonstração sai da tela de acesso. Para habilitar o botão Google, também configure o provedor Google no **Authentication > Providers** do Supabase e os endereços de redirecionamento autorizados; o OAuth do Google pode exigir configuração adicional no Google Cloud.

## Publicação provisória sem domínio

URL prevista depois de habilitar o GitHub Pages: **https://glameiras.github.io/Contador/**.

A integração do GitHub disponível no chat consegue editar código, mas a opção **Settings > Pages** precisa ser acionada pelo proprietário do repositório:
1. Entre em https://github.com/glameiras/Contador/settings/pages
2. Em **Build and deployment**, selecione **Deploy from a branch**.
3. Selecione a branch **main** e a pasta **/(root)**, depois clique em **Save**.
4. Aguarde a publicação e use o botão **Visit site** na mesma tela.

O endereço `github.io` não exige Registro.br. O app tem URLs relativas (`./css/`, `./js/`) e navegação por hash, compatíveis com o subcaminho `/Contador/`.

**Importante:** GitHub Pages só hospeda o frontend estático; Supabase fornece login, banco e políticas RLS. Não divulgue a demonstração como sistema bancário seguro nem use dados financeiros reais enquanto os testes de autenticação e isolamento entre usuários não forem concluídos.
