# Integração ERP - Dados para Boleto

## Resumo da Estrutura

```
ORDENS_VENDA
  ├── ID_CLIENTE → CLIENTES.ID_CLIENTE
  │                  └── ID_PESSOA → PESSOAS (CPF_CNPJ, JURIDICA, NOME)
  │                                    └── CONTATO (ID_TIPO_CONTATO=3 para email)
  ├── ID_FORMA_PAGAMENTO → FORMA_PAGAMENTO (TIPO='BOL' = boleto bancário)
  └── ID_FPGTO → FPGTO (CODIGO = dias das parcelas, ex: "7;14")
```

## Novo Endpoint: GET /api/orders/:orderNumber/boleto

Este endpoint retorna os dados necessários para gerar boleto de um pedido.

### Query SQL

```sql
SELECT 
  ov.ID_ORDENS_VENDA as order_id,
  ov.N_PEDIDO as order_number,
  
  -- Dados do cliente
  p.NOME as customer_name,
  p.CPF_CNPJ as customer_document,
  CASE WHEN p.JURIDICA = 1 THEN 'CNPJ' ELSE 'CPF' END as document_type,
  
  -- Email do cliente (TIPO_CONTATO = 3)
  (
    SELECT FIRST 1 c.DESCRICAO 
    FROM CONTATO c 
    WHERE c.ID_PESSOA = p.ID_PESSOA 
      AND c.ID_TIPO_CONTATO = 3 
      AND (c.DELETED IS NULL OR c.DELETED = 0)
  ) as customer_email,
  
  -- Forma de pagamento
  fp.ID_FORMA_PAGAMENTO as payment_method_id,
  fp.DESCRICAO as payment_method_description,
  fp.TIPO as payment_method_type,
  
  -- Condições de pagamento (parcelas)
  fpgto.ID_FPGTO as payment_terms_id,
  fpgto.CODIGO as payment_terms_code,
  fpgto.DESCRICAO as payment_terms_description,
  
  -- Valor total do pedido (se existir na tabela)
  ov.VALOR_TOTAL as total_amount

FROM ORDENS_VENDA ov
INNER JOIN CLIENTES cl ON cl.ID_CLIENTE = ov.ID_CLIENTE
INNER JOIN PESSOAS p ON p.ID_PESSOA = cl.ID_PESSOA
LEFT JOIN FORMA_PAGAMENTO fp ON fp.ID_FORMA_PAGAMENTO = ov.ID_FORMA_PAGAMENTO
LEFT JOIN FPGTO fpgto ON fpgto.ID_FPGTO = ov.ID_FPGTO

WHERE ov.N_PEDIDO = ?
  AND (ov.DELETED IS NULL OR ov.DELETED = 0)
```

### Resposta Esperada

```json
{
  "order_id": 7163,
  "order_number": "7163",
  "customer_name": "ROMEU EFFTING",
  "customer_document": "05857657903",
  "document_type": "CPF",
  "customer_email": "romeu@graalbeer.com.br",
  "payment_method_id": 7,
  "payment_method_description": "BOLETO BANCÁRIO",
  "payment_method_type": "BOL",
  "payment_terms_id": 3,
  "payment_terms_code": "14",
  "payment_terms_description": "14 DIAS",
  "total_amount": 1465.00
}
```

### Implementação no server.js

```javascript
// GET /api/orders/:orderNumber/boleto
app.get('/api/orders/:orderNumber/boleto', authenticateApiKey, async (req, res) => {
  const { orderNumber } = req.params;
  
  try {
    const query = `
      SELECT 
        ov.ID_ORDENS_VENDA as order_id,
        ov.N_PEDIDO as order_number,
        p.NOME as customer_name,
        p.CPF_CNPJ as customer_document,
        CASE WHEN p.JURIDICA = 1 THEN 'CNPJ' ELSE 'CPF' END as document_type,
        (
          SELECT FIRST 1 c.DESCRICAO 
          FROM CONTATO c 
          WHERE c.ID_PESSOA = p.ID_PESSOA 
            AND c.ID_TIPO_CONTATO = 3 
            AND (c.DELETED IS NULL OR c.DELETED = 0)
        ) as customer_email,
        fp.ID_FORMA_PAGAMENTO as payment_method_id,
        fp.DESCRICAO as payment_method_description,
        fp.TIPO as payment_method_type,
        fpgto.ID_FPGTO as payment_terms_id,
        fpgto.CODIGO as payment_terms_code,
        fpgto.DESCRICAO as payment_terms_description,
        ov.VALOR_TOTAL as total_amount
      FROM ORDENS_VENDA ov
      INNER JOIN CLIENTES cl ON cl.ID_CLIENTE = ov.ID_CLIENTE
      INNER JOIN PESSOAS p ON p.ID_PESSOA = cl.ID_PESSOA
      LEFT JOIN FORMA_PAGAMENTO fp ON fp.ID_FORMA_PAGAMENTO = ov.ID_FORMA_PAGAMENTO
      LEFT JOIN FPGTO fpgto ON fpgto.ID_FPGTO = ov.ID_FPGTO
      WHERE ov.N_PEDIDO = ?
        AND (ov.DELETED IS NULL OR ov.DELETED = 0)
    `;
    
    const result = await executeQuery(query, [orderNumber]);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    
    const order = result[0];
    
    // Verificar se é boleto bancário
    if (order.PAYMENT_METHOD_TYPE !== 'BOL') {
      return res.status(400).json({ 
        error: 'Pedido não é boleto bancário',
        payment_method: order.PAYMENT_METHOD_DESCRIPTION
      });
    }
    
    // Calcular datas de vencimento baseado no CODIGO
    // CODIGO pode ser: "14" (uma parcela) ou "7;14;21" (múltiplas parcelas)
    const paymentCode = order.PAYMENT_TERMS_CODE || '0';
    const dueDays = paymentCode.split(';').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d));
    
    res.json({
      order_id: order.ORDER_ID,
      order_number: order.ORDER_NUMBER,
      customer: {
        name: order.CUSTOMER_NAME,
        document: order.CUSTOMER_DOCUMENT,
        document_type: order.DOCUMENT_TYPE,
        email: order.CUSTOMER_EMAIL
      },
      payment: {
        method_id: order.PAYMENT_METHOD_ID,
        method_description: order.PAYMENT_METHOD_DESCRIPTION,
        method_type: order.PAYMENT_METHOD_TYPE,
        terms_id: order.PAYMENT_TERMS_ID,
        terms_code: order.PAYMENT_TERMS_CODE,
        terms_description: order.PAYMENT_TERMS_DESCRIPTION,
        due_days: dueDays // Array de dias para vencimento: [14] ou [7, 14, 21]
      },
      total_amount: order.TOTAL_AMOUNT
    });
    
  } catch (error) {
    console.error('Erro ao buscar dados do boleto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
```

## Lógica de Parcelas (FPGTO.CODIGO)

O campo `CODIGO` da tabela `FPGTO` contém os dias para vencimento:

| CODIGO | DESCRICAO | Interpretação |
|--------|-----------|---------------|
| 0 | A VISTA | Vencimento imediato |
| 7 | 7 DIAS | 1 parcela em 7 dias |
| 14 | 14 DIAS | 1 parcela em 14 dias |
| 7;14 | 7/14 | 2 parcelas: 7 e 14 dias |
| 7;14;21 | 7/14/21 DIAS | 3 parcelas: 7, 14 e 21 dias |
| 14;28 | 14/28 DIAS | 2 parcelas: 14 e 28 dias |

### Cálculo de Vencimento

```javascript
function calculateDueDates(orderDate, paymentCode) {
  const dueDays = paymentCode.split(';').map(d => parseInt(d.trim(), 10));
  const baseDate = new Date(orderDate);
  
  return dueDays.map((days, index) => {
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + days);
    return {
      installment: index + 1,
      days: days,
      due_date: dueDate.toISOString().split('T')[0]
    };
  });
}

// Exemplo:
// calculateDueDates('2026-01-30', '7;14')
// Retorna:
// [
//   { installment: 1, days: 7, due_date: '2026-02-06' },
//   { installment: 2, days: 14, due_date: '2026-02-13' }
// ]
```

## Filtrar Apenas Pedidos com Boleto

Se quiser listar apenas pedidos que usam boleto bancário:

```sql
SELECT ov.N_PEDIDO, p.NOME, fp.DESCRICAO
FROM ORDENS_VENDA ov
INNER JOIN CLIENTES cl ON cl.ID_CLIENTE = ov.ID_CLIENTE
INNER JOIN PESSOAS p ON p.ID_PESSOA = cl.ID_PESSOA
INNER JOIN FORMA_PAGAMENTO fp ON fp.ID_FORMA_PAGAMENTO = ov.ID_FORMA_PAGAMENTO
WHERE fp.TIPO = 'BOL'
  AND (ov.DELETED IS NULL OR ov.DELETED = 0)
ORDER BY ov.N_PEDIDO DESC
```

## Notas Importantes

1. **CPF_CNPJ**: Armazenado sem formatação (apenas números)
2. **JURIDICA**: 0 = Pessoa Física (CPF), 1 = Pessoa Jurídica (CNPJ)
3. **ID_TIPO_CONTATO = 3**: Email do cliente
4. **FPGTO.CODIGO**: Dias separados por `;` para múltiplas parcelas
5. **FORMA_PAGAMENTO.TIPO = 'BOL'**: Identifica boleto bancário
