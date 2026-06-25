## Objetivo

Adicionar na página **Saúde (Higienização)** uma nova aba **"Alocações"** que lista todos os clientes do ERP que têm equipamentos atualmente alocados, mostrando os equipamentos e há quanto tempo cada um está alocado (desde a data de entrega no ERP).

## Tela

Topo da página Saúde passa a ter um seletor de abas:

- **Higienização** (visão atual — clientes/equipamentos da agenda de limpeza)
- **Alocações** (nova)

A aba **Alocações** mostra:

- Busca por nome do cliente / patrimônio
- Resumo: total de clientes, total de equipamentos, alocações >60d, >180d
- Lista de cards por cliente:
  - Nome do cliente + telefone (se houver)
  - Lista de equipamentos: tipo, modelo, patrimônio
  - Para cada equipamento: data de entrega + dias alocados (badge colorido: verde ≤30d, amarelo 31–90d, laranja 91–180d, vermelho >180d)
- Ordenação padrão: maior tempo alocado primeiro

## Origem dos dados

Novo endpoint no ERP que retorna **todos os equipamentos atualmente alocados**, com cliente e data de entrega:

```text
GET /api/allocations
→ [{ client_id, client_name, client_phone, patrimony, type, model,
     order_number, delivery_date }]
```

Query (Firebird):

```sql
SELECT
  c.ID_CLIENTE, c.RAZAO_SOCIAL, c.NOME_FANTASIA, c.TELEFONE,
  e.PATRIMONIO, e.MODELO, te.DESCRICAO AS TIPO,
  ov.N_PEDIDO, ov.DATA_PREV_ENTREGA
FROM EQUIPAMENTOS e
JOIN EQUIP_FATURAMENTOS ef ON ef.ID_EQUIPAMENTO = e.ID_EQUIPAMENTO
JOIN FATURAMENTO f         ON f.ID_FATURAMENTO  = ef.ID_FATURAMENTO
JOIN ORDENS_VENDA ov       ON ov.ID_ORDENS_VENDA = f.ID_ORDENS_VENDA
JOIN PESSOAS c             ON c.ID_CLIENTE       = f.ID_CLIENTE
WHERE e.STATUS = 'ALOCADO'
  AND (ef.ID_STATUS IS NULL OR ef.ID_STATUS <> 10)
  AND COALESCE(e.DELETED,0) = 0
  AND COALESCE(ef.DELETED,0) = 0
  AND COALESCE(f.DELETED,0)  = 0
```

(Ajustar nomes de colunas em PESSOAS conforme schema existente do projeto.)

## Implementação

1. **erp-api/server.js** — novo handler `GET /api/allocations` com a query acima.
2. **Edge function** `supabase/functions/list-erp-allocations/index.ts` — auth + proxy para o endpoint, retorna `{ allocations: [...] }`.
3. **Hook** `src/hooks/useERPAllocations.tsx` — react-query, staleTime 5min, agrupamento por cliente, cálculo de dias alocados via `differenceInDays(today, delivery_date)`.
4. **Componente** `src/components/hygiene/AllocationsTab.tsx` — busca, resumo, lista agrupada com badges de tempo.
5. **HygienePage** — envolver conteúdo em `Tabs` com as duas abas; manter o FAB visível só na aba Higienização.

## Observação

O endpoint novo precisa do servidor ERP reiniciado (PM2) para entrar em vigor. Avisarei isso ao final.