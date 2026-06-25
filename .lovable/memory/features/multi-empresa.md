---
name: Multi-empresa Architecture
description: ID_EMPRESA filtering across ERP (Graal=1, Grott=3), user_companies table, EmpresaContext for selected empresa
type: feature
---
ERP trabalha com 2 empresas: **ID_EMPRESA = 1 (Graal Beer)** e **ID_EMPRESA = 3 (Grott Beer)**.

## Estrutura
- Tabela `public.user_companies (user_id, empresa_id)` controla acesso. Admins veem todas.
- Funções `get_user_empresas(uuid)` e `user_has_empresa(uuid, int)` (security definer).
- Coluna `id_empresa INT DEFAULT 1` em: `clientes_vendedor`, `pedidos_venda`, `boletos`, `equipments`.

## Frontend
- Constantes: `src/lib/empresas.ts` (EMPRESAS, EMPRESA_OPTIONS).
- Contexto: `src/contexts/EmpresaContext.tsx` (`useEmpresa()` → `selectedEmpresa`, `allowedEmpresas`, `hasMultiple`). Persiste seleção em localStorage `graal_selected_empresa`. Wrapping em App.tsx dentro de AuthProvider.
- Seletor visual: `src/components/empresa/EmpresaSelector.tsx` (só aparece se `hasMultiple`).
- Editor admin: `src/components/empresa/UserCompaniesEditor.tsx` em UsersManagementPage.

## ERP Server (server.js)
- `/api/clients`, `/api/allocations` aceitam `?empresas=1,3` e retornam `id_empresa` no payload.
- Filtragem por `cl.ID_EMPRESA IN (...)`.

## Edge Functions
- `list-erp-clients`, `list-erp-allocations` propagam `?empresas=` para o ERP.
- `sync-vendedor-clients` grava `id_empresa` em `clientes_vendedor`.

## Hooks
- `useEmpresa()` é a fonte da empresa ativa.
- Hooks que consomem ERP filtram pela `selectedEmpresa` na queryKey + chamada.
- `useClientesVendedor` aplica filtro client-side por `id_empresa`.
