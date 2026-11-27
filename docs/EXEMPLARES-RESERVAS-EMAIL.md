# Exemplares, reservas e e-mails

## Modelo do estoque

Um registro em books representa uma oferta de exemplar (ou lote de cópias
equivalentes), não uma obra única. Dois exemplares de Marina podem ter o mesmo
ISBN, título e autor, mas preços, conservação, observações e fotos diferentes.
Não há restrição de unicidade por título/ISBN.

- No painel do sebo, o botão + de cada livro abre outro exemplar com quantidade 1.
- Título, autor e edição são reaproveitados. Fotos e observações são limpas.
- Escolha a conservação, confira o preço e descreva marcas reais de uso.
- Até três fotos JPG/PNG/WebP de 5 MB vão para a pasta do usuário no Storage.
- Quantidade deve agrupar somente cópias com o mesmo preço e conservação.
- Uma reserva sempre aponta para o registro escolhido, nunca apenas para o título.

## Leitor e lojista

Na ficha, Comparar exemplares lista ofertas do mesmo título e autor por preço.
A lista de desejos mostra disponibilidade no catálogo carregado quando o leitor
abre sua conta. Não é um e-mail nem uma notificação em segundo plano.
O painel do sebo mostra demanda agregada, sem expor identidade dos leitores.

Reservar exige login e um sebo aprovado. O banco baixa uma unidade atomicamente,
inclusive se houver duas tentativas sobre a última unidade. O cliente não define
preço, loja, leitor ou estado da reserva. Esses campos são preenchidos pelo banco.

A reserva guarda título, preço, conservação e observações do momento da escolha.
O leitor pode cancelar; o lojista pode cancelar ou confirmar retirada.
Cancelar devolve uma unidade; retirar não devolve. Não há pagamento ou expiração
automática nesta versão. Reservas ativas impedem excluir o anúncio.

O editor usa updated_at para recusar alterações de estoque feitas a partir de
formulário desatualizado, por exemplo quando chegou uma reserva durante a edição.

## Autenticação e entrega de e-mail

Google continua no OAuth do Supabase. E-mail/senha, confirmação por código,
reenvio e recuperação de senha continuam no Supabase Auth com o SMTP configurado
no painel (Brevo). Nenhuma senha SMTP deve ir para VITE_, Git ou navegador.

O frontend mantém o endereço pendente na sessionStorage da aba, aceita códigos
de 6 a 12 dígitos e aguarda 60 segundos entre reenvios. Recarregar não remove a
espera. Login com e-mail não confirmado abre a confirmação com opção de reenvio.
Os limites reais do servidor continuam valendo, independentemente da interface.

Para testar entrega real:
1. Confirme que o projeto está ACTIVE_HEALTHY no Supabase.
2. Confira o SMTP e o remetente verificado no Brevo.
3. Cadastre um endereço de teste que você controla.
4. Confira código, spam, confirmação e login após confirmar.
5. Teste recuperar senha e confirme que o link termina no domínio de produção,
   na rota /auth/reset-password, não em localhost.
6. Se falhar, consulte logs do Auth e a atividade transacional no Brevo, sem
   compartilhar tokens, senhas ou códigos.

O SMTP e a caixa de entrada não foram validados pelos testes simulados de UI.
O projeto estava pausado e foi reativado durante este trabalho.

## Verificação

- npm test: validação das fotos e observações, além dos testes existentes.
- npm run test:ui: confirmação, código completo, recarga e espera de reenvio.
- npm run test:panels: criar/editar, outro exemplar e demais painéis.
- npm run test:copies: comparação, foto real, reserva da oferta
  selecionada, cancelamento e disponibilidade dos desejos em desktop/celular.
- Banco: reserva da última unidade, tentativa sem estoque, cancelamento,
  impedimento de retirada pelo leitor e retirada pelo lojista, com rollback.
