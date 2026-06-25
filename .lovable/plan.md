## Objetivo

Suportar duas empresas no ERP (ID_EMPRESA: **1 = Graal Beer**, **3 = Grott Beer**) e filtrar todos os dados exibidos no app conforme as empresas que o usuário tem permissão de acessar.

## 1. Backend ERP (`erp-api/server.js`)

Incluir `ID_EMPRESA` em todas as queries que retornam dados de cliente, pedidos, equipamentos, alocações, boletos e produtos:

- `/api/clients` e `/api/clients/search` → adicionar `c.ID_EMPRESA` no SELECT
- `/api/orders/*` → adicionar `o.ID_EMPRESA`
- `/api/allocations` → adicionar `ID_EMPRESA` do cliente
- `/api/equipments`, `/api/financial/*` → idem
- Aceitar query param opcional `?empresas=1,3` para já filtrar no servidor (otimização)

## 2. Banco (Lovable Cloud)

Nova tabela `user_companies`:
```
user_id (uuid → auth.users)
empresa_id (int)  -- 1 ou 3
PRIMARY KEY (user_id, empresa_id)
```
- GRANT padrão + RLS (admin gerencia, usuário lê o próprio)
- Função `get_user_empresas(_user_id)` retornando `int[]`
- Função `user_has_empresa(_user_id, _empresa_id)` → boolean

Adicionar coluna `id_empresa INT` em:
- `clientes_vendedor`
- `pedidos_venda`
- `boletos`
- `equipments` (quando vier do ERP)

Backfill: default `1` (Graal) para dados existentes.

Atualizar políticas RLS dessas tabelas para exigir `user_has_empresa(auth.uid(), id_empresa)`.

## 3. Edge Functions

Todas as functions que chamam o ERP passam a:
1. Ler `user_companies` do usuário autenticado
2. Repassar `?empresas=...` para o ERP
3. Filtrar resposta por segurança

Functions impactadas: `sync-vendedor-clients`, `get-erp-allocations`, `get-erp-orders`, `get-erp-product-price`, `erp-clients-search`, etc.

## 4. Frontend

**Contexto novo** `useUserCompanies()` — carrega empresas permitidas do usuário logado, cacheia, e expõe seletor quando o usuário tem acesso a mais de uma.

**Header global**: dropdown "Empresa" (só aparece se usuário tem >1). Default = primeira. Persistido em localStorage.

**Hooks impactados** passam a filtrar/incluir a empresa ativa:
- `useClientesVendedor`, `useERPOrders`, `useERPAllocations`, `useBoletos`, `useERPCatalog`

**Tela Admin → Usuários**: nova seção "Empresas do usuário" com checkboxes (Graal Beer / Grott Beer) salvando em `user_companies`. Só admin acessa.

**Badges visuais**: nos cards de cliente/pedido/alocação, exibir mini-badge com a empresa (cor distinta para cada uma) quando o usuário tem acesso a múltiplas.

## 5. Migração de dados existentes

- `UPDATE clientes_vendedor SET id_empresa = 1` (todos atuais são Graal)
- Reexecutar `sync-vendedor-clients` para popular `id_empresa` correto vindo do ERP
- Inserir `user_companies` para todos os usuários atuais com `empresa_id = 1` (mantém acesso atual)

## 6. Ordem de implementação

1. `erp-api/server.js` — expor ID_EMPRESA (requer `pm2 restart`)
2. Migration: tabela `user_companies`, colunas `id_empresa`, funções, RLS, backfill
3. Edge functions — propagar filtro
4. Hooks + contexto + seletor no header
5. Tela admin para gerenciar empresas por usuário
6. Badges nos cards

## Observações técnicas

- IDs hardcoded como constantes em `src/lib/empresas.ts`: `{ GRAAL: 1, GROTT: 3 }` com labels e cores.
- Admin sempre vê tudo (bypass via `has_role(uid,'admin')` nas políticas).
- Memory nova será criada documentando a regra multi-empresa.
