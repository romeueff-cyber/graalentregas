# Correções Multi-Empresa & Ajustes Pedidos de Venda

Vários pontos do sistema ainda não respeitam a empresa do usuário, e há ajustes UX no fluxo de Pedido de Venda. Plano abaixo agrupado por tema.

## 1. Filtro de empresa nos clientes (Pedido de Venda)

Problema: usuário Marcel (somente Grott / `id_empresa = 3`) não consegue ver o cliente "Potus" (que tem nome fantasia diferente da razão social).

Causas a corrigir:
- `ClienteCombobox` busca pelo termo digitado, mas o ERP só filtra por `RAZAO`. Cliente cadastrado como "Potus" no fantasia não aparece.
- A busca no `erp-api/server.js` precisa considerar `NOME_FANTASIA` (ou equivalente) além de `RAZAO`, mantendo filtro `ID_EMPRESA IN (...)`.

Ação:
- Atualizar query no `/api/clients` do `erp-api/server.js` para `WHERE (RAZAO LIKE ? OR FANTASIA LIKE ? OR CNPJ_CPF LIKE ?) AND ID_EMPRESA IN (...)`.
- Confirmar que `list-erp-clients` repassa `empresas` corretamente (já feito) e que o front sempre injeta `[selectedEmpresa]`.

## 2. Autocomplete de endereço (Pedido de Venda)

Problemas:
- Ao clicar numa sugestão, ela não é selecionável (sugestões abrem fora do modal/sheet → conflito de foco/touch com Radix Dialog/Sheet).
- Raio de 150 km não restringe — Google retorna endereços de São Paulo. `LocationBias` por bounds é apenas viés, não restrição.

Ação:
- Em `AddressAutocomplete.tsx`:
  - Renderizar a `pac-container` dentro do dialog/sheet (anexar manualmente ao container do form via `MutationObserver` movendo `.pac-container` para `document.body` com `z-index` alto, **OU** trocar pelo `AutocompleteService` + lista própria controlada — mais robusto dentro de dialogs).
  - Reduzir raio para **100 km** e validar resultado: se `lat/lng` cair fora do raio, descartar/avisar.
  - Para a busca manual (botão lupa), usar `Geocoder` e filtrar resultados por distância haversine ao centro de Jaraguá; se nenhum dentro de 100 km, mostrar toast "fora do raio".
- Atualizar constante `RADIUS_KM = 100`.

## 3. UX em "Adicionar Produto" (Pedido de Venda)

Problema: botões `+1` e `+10` são pouco flexíveis para barris (volumes típicos 10/20/30/50 L) vs growlers (unidade).

Ação em `AddItemSheet.tsx`:
- Detectar se o item é **barril** (via `tipo === 'equipamento'` ou nome contendo "barril"/"chopeira"): mostrar botões **+10, +20, +30, +50**.
- Caso contrário (produto normal, growler, etc.): mostrar somente **+1**.
- Manter campo numérico editável.

## 4. Filtro de empresa no Mapa do dia (pedidos, recolhas, higienização)

Problema:
- Admin vê pedidos do dia de todas as empresas mesmo com empresa selecionada (não respeita `selectedEmpresa`).
- Marcel não vê pedidos (mas vê recolhas/higiene de outras empresas).

Ação:
- `useDailyOrders`: já filtra por `empresasFilter`. Verificar se `list-erp-orders` está retornando `id_empresa` nas linhas e se o filtro SQL `ID_EMPRESA IN (...)` está ativo (corrigir lá se faltar).
- **Recolhas/Equipamentos** (`equipments`): adicionar coluna `id_empresa` se ainda não existe e filtrar no front por `selectedEmpresa`. Preencher `id_empresa` no momento da entrega a partir do pedido ERP. Aplicar filtro em `DailyOrdersMapView`, `DailyOrdersSidebar`, hooks de recolha.
- **Higienização** (`hygiene_clients`/`hygiene_equipment`): adicionar `id_empresa` e filtrar nas listagens/marcadores. Default empresa atual ao criar.

## 5. Financeiro / Boletos por empresa

Problema: boletos exibidos de todas as empresas.

Ação:
- Garantir que `boletos` tenha `id_empresa` (já incluído em migração anterior) e que `useBoletos` / `useERPBoletoData` filtrem por `selectedEmpresa`.
- Atualizar Edge Functions `get-erp-boleto-data` e `sync-boletos-status` para receber/usar `empresas` e filtrar por `ID_EMPRESA`.
- Filtrar UI em `FinanceiroPage.tsx`.

## 6. Auditoria geral multi-empresa

Revisar todas as telas com dados ERP/Supabase e aplicar filtro por `selectedEmpresa` quando aplicável:

- Pedidos de Venda (já filtrado — revalidar).
- Pedidos do Dia / Mapa (item 4).
- Recolhas / Equipamentos (item 4).
- Higienização / Alocações (item 4 + `AllocationsTab` já filtra — revalidar).
- Financeiro / Boletos (item 5).
- Analytics / Saúde do Cliente / Performance / Profitability: filtrar por `selectedEmpresa`.
- Rotas / Otimização: filtrar pontos de entrega por empresa.
- Etiquetas / Templates: opcional — manter global por enquanto.
- Configurações: já tem card por empresa (WhatsApp).

Para cada hook ERP (`useERPOrders`, `useERPAnalytics`, `useERPBoletoData`, `useERPAllocations`, `useClientesVendedor`, `useDeliveredOrders`, etc.), garantir que:
1. `queryKey` inclui `selectedEmpresa`.
2. Body do `functions.invoke` envia `empresas: [selectedEmpresa]`.
3. Edge function aplica `WHERE ID_EMPRESA IN (...)` no SQL Firebird.
4. Fallback usa `allowedEmpresas` se nenhuma selecionada (admin com várias).

## Detalhes técnicos

- **Migração SQL**: adicionar `id_empresa INT` (nullable inicialmente) em `equipments`, `hygiene_clients`, `hygiene_equipment` se ausente; backfill por join com pedidos quando possível; index em `(id_empresa)`.
- **erp-api**: padronizar helper `buildEmpresaClause(empresas)` retornando `AND ID_EMPRESA IN (1,3)` validado.
- **Edge Functions**: validar `empresas` vs `user_companies` do JWT antes de repassar ao ERP, evitando bypass.
- **Front**: criar util `useEmpresaFilter()` que devolve `{ empresasParam, queryKeySuffix }` reutilizado em todos os hooks ERP.

## Ordem de execução sugerida

1. Endereço (autocomplete + raio 100 km) — bug bloqueante UX.
2. Busca de clientes por fantasia — bug funcional Marcel.
3. Botões de quantidade (+10/+20/+30/+50) — UX rápida.
4. Filtro empresa em pedidos do dia / mapa / recolhas / higiene.
5. Filtro empresa no Financeiro/Boletos.
6. Auditoria final dos demais hooks/telas ERP.

Quer que eu siga nessa ordem ou prefere priorizar algo (ex.: financeiro primeiro)?
