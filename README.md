# Contador

Aplicativo web **mobile-first** de controle financeiro pessoal, desenvolvido com HTML, CSS e JavaScript puro.

## Funcionalidades
- Dashboard, contas e saldos, receitas e despesas.
- Transferências entre contas, cartões, compras no crédito, limite e pagamento de faturas.
- Recorrências, metas financeiras, histórico com filtros e edição, backup JSON.
- Tema claro/escuro, privacidade visual, importação/exportação.
- **Opcional:** cadastro, login, recuperação de senha e dados individuais no Supabase.

## Rodar sem Supabase
Abra no VS Code com Live Server ou rode `python -m http.server 5500` e acesse `http://localhost:5500`. Com `js/config.js` vazio, os dados ficam apenas no navegador (**modo LOCAL**).

## Ativar Supabase
1. Crie um projeto em https://supabase.com/dashboard.
2. Execute `supabase/schema.sql` no SQL Editor.
3. Em `js/config.js`, informe apenas a **Project URL** HTTPS e a chave **publishable** pública (`sb_publishable_...`). **Nunca** exponha `service_role`, `sb_secret_`, senha de banco ou tokens privados.
4. Configure Authentication > URL Configuration (Site URL e Redirect URLs), habilite autenticação por email e confira a configuração do envio de email.
5. Teste cadastro, confirmação por email, login, logout, recuperar senha, RLS com **dois usuários**, atualização em duas abas, importação de backup e sincronização em dois aparelhos.

O arquivo JSON de backup não é criptografado; guarde-o em local privado. A sincronização usa documento por usuário, RLS e revisão para impedir sobrescritas concorrentes. Ainda exige testes reais antes de liberar usuários.

## GitHub Pages
Após revisar o código, habilite Settings > Pages > Deploy from a branch > `main` / `(root)`. A URL padrão deve ser `https://glameiras.github.io/Contador/` quando publicada. Acrescente esse endereço aos Redirect URLs no Supabase. GitHub Pages é hospedagem estática, não backend de cobrança.

## Ainda não implementado
Cobrança Premium, Stripe, conexão bancária automática, PIX, domínio próprio e integração de APIs externas. Não utilize esta versão como um serviço financeiro comercial sem testes adicionais de segurança.

## Estrutura
```
index.html
css/style.css
js/app.js
js/cloud.js
js/config.js
supabase/schema.sql
```
