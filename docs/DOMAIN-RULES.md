# Regras de domínio preservadas

- Sondagem gera Intenção, nunca Pedido e nunca “quanto produzir”.
- Reservas permitem múltiplos itens em uma única confirmação.
- Capacidade é derivada pelo banco; `AWAITING_PAYMENT` válido + `PAYMENT_CONFIRMED` ocupam capacidade.
- “Quanto produzir” soma somente pedidos `PAYMENT_CONFIRMED`.
- Cliente cancela apenas `AWAITING_PAYMENT` antes da expiração; após pagamento, somente admin.
- Pix é externo e confirmado manualmente.
- Tokens de acesso não são armazenados em claro.
