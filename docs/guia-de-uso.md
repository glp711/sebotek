# Guia de uso - Sebo Virtual

Este guia explica como usar o Sebo Virtual como leitor, como responsavel por um sebo e como executar o projeto em ambiente local.

## Acesso ao sistema

- Site em producao: https://sebo-virtual.vercel.app/
- Repositorio: https://github.com/glp711/sebotek

O sistema e um MVP de TCC para centralizar catalogos de sebos independentes. A ideia principal e permitir que o leitor encontre livros usados em diferentes sebos e fale diretamente com o estabelecimento que possui o exemplar.

## Como usar como leitor

1. Acesse https://sebo-virtual.vercel.app/
2. Use a busca principal para procurar por titulo, autor, categoria, ISBN ou nome do sebo.
3. Use os filtros do catalogo:
   - Categoria: filtra por genero ou classificacao do livro.
   - Estado: filtra por conservacao do exemplar.
   - Ordenar: organiza por recentes, menor preco, maior preco ou titulo.
4. Clique em um card de livro para abrir os detalhes.
5. Confira capa, resumo, preco, estado, quantidade, ISBN, editora, ano e dados do sebo.
6. Clique em `Chamar no WhatsApp` para conversar com o sebo sobre disponibilidade, reserva ou retirada.

## Como ver os sebos parceiros

1. Clique em `Sebos` no menu superior.
2. Veja a lista de sebos cadastrados.
3. Cada card mostra:
   - Nome do sebo.
   - Status de verificacao.
   - Quantidade de titulos no acervo.
   - Quantidade total de exemplares.
   - Menor preco do acervo.
   - Endereco, cidade, telefone e horario.
4. Clique em `Ver acervo` para voltar ao catalogo filtrando pelos livros daquele sebo.

## Como usar a area do sebo

1. Clique em `Area do sebo`.
2. Escolha `Entrar` ou `Cadastrar`.
3. Para criar uma conta, informe:
   - Nome do responsavel.
   - Email.
   - Senha com no minimo 6 caracteres.
4. Depois do login, cadastre os dados do sebo:
   - Nome.
   - Descricao.
   - Cidade e UF.
   - Endereco.
   - CEP.
   - WhatsApp.
   - Horario de funcionamento.
5. Envie o cadastro para aprovacao.
6. Depois de carregar o sebo associado a conta, cadastre livros informando:
   - Titulo.
   - Autor.
   - ISBN.
   - Estado de conservacao.
   - Preco.
   - Quantidade.

No MVP atual, a aprovacao administrativa do sebo ainda nao tem uma tela propria. Essa validacao pode ser feita diretamente no Supabase enquanto a area administrativa nao for criada.

## Login, confirmacao de email e recuperacao de senha

O Sebo Virtual possui dois fluxos de conta:

- `Cliente`: usado pelo leitor para manter perfil e wishlist.
- `Area do sebo`: usado pelo responsavel pelo sebo para cadastrar o estabelecimento e publicar livros.

Ao criar conta, o Supabase envia um email de confirmacao. O link volta para:

```text
https://sebo-virtual.vercel.app/auth/confirm
```

Ao pedir recuperacao de senha, o link volta para:

```text
https://sebo-virtual.vercel.app/auth/reset-password
```

Em desenvolvimento local, use tambem:

```text
http://127.0.0.1:5174/auth/confirm
http://127.0.0.1:5174/auth/reset-password
http://localhost:5174/auth/confirm
http://localhost:5174/auth/reset-password
```

No painel do Supabase, configure em `Authentication > URL Configuration`:

- Site URL: `https://sebo-virtual.vercel.app`
- Redirect URLs: as URLs de confirmacao e reset listadas acima.

Sem essas URLs liberadas, o Supabase pode bloquear o redirecionamento ou mandar o usuario para uma URL antiga.

## Fluxo sugerido para demonstracao

1. Abrir o site em producao.
2. Mostrar a busca por `Marina`.
3. Abrir o card do livro e mostrar capa, resumo e WhatsApp.
4. Limpar filtros e ordenar por menor preco.
5. Entrar na aba `Sebos` e mostrar os cards dos sebos parceiros.
6. Clicar em `Ver acervo` em um sebo.
7. Abrir a `Area do sebo` e explicar o fluxo de cadastro, aprovacao e publicacao de livros.
8. Explicar que o backend usa Supabase com Auth, Postgres, RLS e Storage.

## Como rodar localmente

Requisitos:

- Node.js instalado.
- npm instalado.
- Conta/projeto no Supabase para usar dados reais.

Passos:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Depois, abra o endereco mostrado pelo Vite, normalmente:

```text
http://localhost:5174/
```

No Windows PowerShell, se `cp` nao estiver disponivel, use:

```powershell
Copy-Item .env.example .env.local
```

## Variaveis de ambiente

O arquivo `.env.local` deve conter:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica
```

Nunca coloque no frontend:

- `sb_secret_...`
- `service_role`
- senhas privadas
- tokens administrativos

Somente a chave publishable/anon deve ser usada no Vite, pois qualquer variavel com prefixo `VITE_` pode ficar visivel no navegador.

## Banco de dados

As migrations ficam em:

```text
supabase/migrations/
```

Principais tabelas do modelo Supabase-native:

- `profiles`
- `stores`
- `books`
- `reviews`
- `wishlists`
- `wishlist_matches`

Tambem existem buckets de storage previstos para:

- `book-covers`
- `store-photos`

O modelo usa RLS para proteger escrita e permitir leitura publica do catalogo aprovado.

## Deploy na Vercel

O projeto ja esta configurado com `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Para fazer deploy manual:

```bash
npx vercel --prod
```

Na Vercel, configure as mesmas variaveis:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Comandos uteis

```bash
npm run dev
npm run build
npm run lint
```

## Melhorias futuras

- Tela administrativa para aprovar sebos.
- Upload de capas pelo painel do sebo.
- Wishlist com alerta quando um livro desejado aparecer.
- Reserva de exemplar.
- Avaliacoes de sebos.
- Mapa com sebos proximos.
- Historico de contato/reserva para o leitor.
