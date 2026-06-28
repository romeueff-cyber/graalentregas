# Prompt Mestre — Recriação do Sistema Graal Beer Entregas

Use este documento como **prompt único** para qualquer outra IA (Cursor, Claude, GPT, v0, Bolt, Replit Agent etc.) recriar o sistema **exatamente como ele opera hoje em produção**. Ele descreve stack, domínio, regras, schema, edge functions, integrações externas e fluxos. Sem omissões.

---

## 1. Visão geral

**Produto:** PWA mobile‑first usado pela distribuidora **Graal Beer / Grott Beer** (Jaraguá do Sul / SC) para:

1. Receber pedidos do ERP Firebird, geocodificar, exibir em mapa e otimizar rotas.
2. Registrar entrega física, foto e GPS, com fila offline.
3. Controlar **equipamentos alocados** (barris, chopeiras, growlers) — entrega → liberação → recolha.
4. Cadastrar **pedidos de venda** pelo vendedor (com autocomplete de endereço Google Places + preço por cliente).
5. Emitir e conciliar **boletos Cora Bank** (mTLS).
6. Agenda de **higienização** de chopeiras instaladas em clientes fixos.
7. Dashboards de **Saúde do Cliente** (churn, ticket médio, previsão), financeiro, motoristas, rentabilidade.
8. Operar **multi‑empresa**: ID_EMPRESA 1 = Graal, 3 = Grott. Cada usuário pode ter 1 ou as 2.

Tudo é **offline‑first** com Service Worker + localforage + fila `PENDING_SYNC`. **Não usar Capacitor** — é estritamente PWA.

---

## 2. Stack obrigatória

- React 18 + TypeScript 5 + Vite 5
- Tailwind CSS v3 + shadcn/ui (Radix)
- React Router v6, TanStack Query v5
- Supabase (Postgres + Auth + Edge Functions Deno + Storage)
- Google Maps JS API via `@react-google-maps/api` (`useJsApiLoader`)
- Framer Motion para micro‑animações
- localforage + Workbox (vite-plugin-pwa, NetworkFirst para HTML/JS)
- date-fns, zod, react-hook-form
- Proxy ERP separado: Node.js + Express + `node-firebird` (charset WIN1252, Srp AuthServer), gerenciado por PM2 no servidor do cliente
- Cora Bank: mTLS com certificado/chave em secrets
- Zapster API para envio WhatsApp (grupos por empresa)

---

## 3. Regras invioláveis

1. **Cores apenas via tokens HSL** em `src/index.css` (`--status-*`, `--primary`...). Proibido hex/`text-white` direto em componentes.
2. **Datas** sempre setadas para **midday local (`T12:00:00`)** antes de formatar — evita shift GMT-3.
3. **PKs do ERP Firebird são singulares**: `ID_CLIENTE`, `ID_PRODUTO`, `ID_EMPRESA` (não `IDS_…`).
4. **Charset Firebird = WIN1252**.
5. **Roles em tabela separada** `user_roles` + função `SECURITY DEFINER has_role(uuid, app_role)`. Nunca armazenar role em `profiles`.
6. **Edge Functions de auth devem priorizar `getClaims()`** sobre `getUser()` (evita 401 intermitente).
7. **Registro de entrega gated**: pedido só pode ser entregue se `ID_STATUS` do ERP for **3 (Faturado)** ou **19 (A Entregar)**.
8. **Multi‑empresa**: TODA query que retorna dados do ERP (pedidos, clientes, alocações, boletos) deve filtrar por `id_empresa IN (empresas do usuário)` **OU `id_empresa IS NULL`** (fallback p/ cadastros incompletos no ERP). Inferir empresa pelo nome do grupo quando NULL: contém "GROTT" → 3, senão 1.
9. **Prevenir React Error #185**: transições de estado interativas envolvidas em `setTimeout(…, 250)`; hooks sempre antes de early returns.
10. **Geocodificação Google Places** restrita a raio **150 km de Jaraguá do Sul** (lat -26.4862, lng -49.0664) — usar `locationBias` circular.
11. **Tokens de confirmação cliente**: UUID, validade 30 dias, consumidos uma única vez.
12. Boletos: campo `id_empresa` obrigatório em INSERT; chave de idempotência Cora determinística (`order_number-empresa-due_date`).

---

## 4. Identidade visual

- Marca laranja Graal `--primary: 24 95% 53%`.
- Tipografia padrão Tailwind (sans system); **não usar Inter/Poppins clichê** nem gradientes roxo/índigo.
- Layout mobile‑first com safe-area-inset; bottom-nav fixa nas páginas principais.
- Status colors (HSL):
  - `--status-delivered: 0 84% 60%` (vermelho — Entregue, aguardando recolha)
  - `--status-ready: 142 76% 36%` (verde — Liberado p/ recolha)
  - `--status-collected: 271 91% 65%` (roxo — Recolhido)
  - `--status-waiting: 38 92% 50%` (âmbar — Cliente irá avisar)

---

## 5. Schema Postgres (público)

Toda tabela em `public` exige bloco GRANT logo após CREATE e antes do RLS:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tbl> TO authenticated;
GRANT ALL ON public.<tbl> TO service_role;
-- GRANT SELECT TO anon apenas quando há política pública (ex: confirm-by-client)
```

### Tipos
```sql
CREATE TYPE app_role AS ENUM ('admin','entregador','vendedor','financeiro');
CREATE TYPE equipment_status AS ENUM ('ENTREGUE','LIBERADO_PARA_RECOLHA','RECOLHIDO');
CREATE TYPE collection_period AS ENUM ('DIA_TODO','MANHA','TARDE','NOITE','CLIENTE_IRA_AVISAR');
CREATE TYPE sync_status AS ENUM ('synced','pending');
CREATE TYPE hygiene_equipment_type AS ENUM ('chopeira','geladeira','balcao');
CREATE TYPE hygiene_service_type AS ENUM ('limpeza','troca');
```

### Tabelas (resumo — todas com RLS habilitada)

| Tabela | Função | Campos-chave |
|---|---|---|
| `profiles` | dados do usuário | id (=auth.users), name, email |
| `user_roles` | papéis | user_id, role (app_role) |
| `user_companies` | acesso multi-empresa | user_id, empresa_id (1 ou 3) |
| `empresa_settings` | config por empresa | empresa_id PK, whatsapp_group_id, etc |
| `settings` | flags globais | dias_exibir_recolhido, boleto_multa_*, boleto_juros_*, boleto_desconto_*, boleto_producao |
| `equipments` | entregas físicas | id, nome_cliente, telefone_cliente, pedido_dia, periodo_recolha, data_prevista_recolha, data_entrega, data_real_recolha, status, latitude, longitude, foto_url, foto_local_path, cliente_ira_avisar, confirmation_token, token_used_at, sync_status, created_by_user_id |
| `equipment_history` | rastreio independente | equipment_id, action, actor, created_at |
| `visit_attempts` | tentativas de recolha | equipment_id, attempted_at, note |
| `optimized_routes` | rotas salvas | route_date, period, driver_index, driver_label, color, start_time, end_time, total_distance, total_duration, total_volume_liters |
| `route_stops` | paradas | route_id FK, stop_order, order_number, client_name, address, lat/lng, arrival_time, departure_time, volume_liters, estimated_service_time |
| `pedidos_venda` | pedidos criados no app | id, numero_pedido (#APP-NNN), cliente_nome, documento_cliente, vendedor_id, data_entrega, periodo, endereco, latitude, longitude, observacoes, status (pendente/aprovado/sincronizado), id_empresa |
| `pedidos_venda_itens` | itens | pedido_id, produto_id, descricao, quantidade, preco_unitario, desconto, tipo (produto/equipamento) |
| `clientes_vendedor` | clientes cadastrados pelo vendedor (offline) | id, nome, telefone, doc, endereco, lat/lng, id_empresa |
| `vendedor_clientes_erp` | mapeamento ERP ↔ vendedor | user_id, id_cliente_erp |
| `boletos` | boletos Cora | order_number, cora_invoice_id UNIQUE, customer_name, customer_document, customer_email, total_amount, due_date, status, pdf_url, barcode, digitable_line, pix_emv, pix_qr_code_url, reconciled, reconciled_at, reconciled_by_user_id, id_empresa |
| `client_notes` | anotações livres | client_name, note, follow_up_date, resolved |
| `hygiene_clients` | clientes de higiene | nome, endereco, lat/lng, intervalo_limpeza_dias (default 30) |
| `hygiene_equipment` | equipamentos no cliente | client_id, tipo (chopeira/geladeira/balcao), numero_serie, modelo_chopeira, ultima_limpeza, proxima_limpeza, ativo |
| `hygiene_services` | execuções | equipment_id, tipo_servico (limpeza/troca), data_servico, novo_numero_serie, motivo_troca, foto_url, executado_por_user_id |
| `driver_locations` | last-seen GPS | user_id PK, lat, lng, updated_at |
| `label_templates` | layout etiquetas Argox | nome, jsonb_layout, larguraMM, alturaMM |

### Funções SECURITY DEFINER essenciais
```sql
has_role(_user_id uuid, _role app_role) returns boolean
user_has_empresa(_user_id uuid, _empresa_id int) returns boolean
confirm_collection(_equipment_id uuid)        -- bypassa restrição de criador
get_delivered_order_numbers(_date date)
```

### Padrão de policy (exemplo)
```sql
-- Boletos: visíveis somente para usuários da empresa correspondente
CREATE POLICY boletos_select_by_empresa ON public.boletos
FOR SELECT TO authenticated
USING (public.user_has_empresa(auth.uid(), id_empresa));
```

---

## 6. Edge Functions (Deno)

Todas validam JWT via `_shared/auth.ts` priorizando `getClaims()`. Lista completa:

| Function | Propósito |
|---|---|
| `list-erp-orders` | GET pedidos do dia por data + empresas do usuário |
| `search-erp-order` | busca pedido único por número |
| `update-erp-order-status` | seta ID_STATUS no Firebird (4 = ENTREGUE) |
| `update-erp-equipment-status` | seta DISPONÍVEL no equipamento |
| `list-erp-clients` | busca clientes do ERP com filtro de empresa (inclui NULL para admins multi) |
| `list-erp-products` | catálogo |
| `list-erp-equipment-types` | barris/chopeiras |
| `list-erp-allocations` | join clientes × equipamentos × tempo alocado |
| `get-erp-analytics` | métricas para Saúde do Cliente |
| `get-erp-client-last-order` | repetir último pedido |
| `get-erp-product-price` | LEFT JOIN PRECO por cliente, fallback tabela padrão |
| `get-erp-boleto-data` | dados financeiros do pedido |
| `gerar-boleto` | emite na Cora (mTLS), idempotência determinística |
| `sync-boletos-status` | poll Cora para atualizar pagos/vencidos |
| `backfill-boletos-empresa` | preenche id_empresa em históricos |
| `notify-pedido-venda-whatsapp` | envia para grupo Zapster da empresa correta; mensagem inclui `#APP-NNN`, itens com preço unit + subtotal, total geral |
| `confirm-by-client` | endpoint público com token (anon) — cliente escolhe data/período |
| `get-equipment-by-token` | resolve token → equipamento |
| `get-client-equipment` | lista alocados ao cliente |
| `validate-equipment-patrimony` | valida nº patrimônio antes de retorno |
| `ocr-patrimony` | Lovable AI Gateway → Gemini Vision lê manuscrito |
| `optimize-routes-ai` | Lovable AI Gateway (Gemini): sugere nº de motoristas / otimiza |
| `sync-vendedor-clients` | sincroniza clientes do vendedor com ERP |
| `delete-equipment`, `list-users`, `create-user`, `manage-user` | admin tooling |

Secrets (Supabase Functions env):
`ERP_API_URL`, `ERP_API_KEY`, `CORA_PRIVATE_KEY`, `CORA_CERTIFICATE`, `CORA_CLIENT_ID`, `GOOGLE_MAPS_API_KEY`, `LOVABLE_API_KEY`, `ZAPSTER_API_KEY`.

---

## 7. Proxy ERP (Node + Firebird)

Servidor Express separado, rodando dentro da rede do ERP, exposto por túnel HTTPS. Autenticação por header `X-API-KEY`. Conexão Firebird com `lowercase_keys: false`, charset `WIN1252`, AuthServer `Srp`.

Endpoints:
- `GET /health`
- `GET /api/orders?date=YYYY-MM-DD&empresas=1,3`
- `GET /api/orders/:orderNumber`
- `GET /api/orders/:orderNumber/boleto`
- `PUT /api/orders/:orderNumber/status` (body `{statusId}`)
- `GET /api/clients?search=&empresas=1,3` (aceita `ID_EMPRESA IS NULL`)
- `GET /api/products?empresas=...`
- `GET /api/products/:productId/price?clienteId=...`
- `GET /api/allocations?empresas=...`
- `GET /api/orders/analytics?empresas=...` (inclui `GRUPO_CLIENTE`)
- `PUT /api/equipment/:id/status`

Schema relevante:
```
ORDENS_VENDA(ID_ORDEM_VENDA, NUMERO, DATA, ID_CLIENTE, ID_EMPRESA, ID_STATUS, ID_FORMA_PAGAMENTO, ID_FPGTO, ENTREGAR)
  ITENS_ORDENS_VENDA(ID_ORDEM_VENDA, ID_PRODUTO, QUANTIDADE, VALOR)
  EQUIP_ORDENS_VENDA(ID_ORDEM_VENDA, ID_TIPO_EQUIPAMENTO, QUANTIDADE)
CLIENTES(ID_CLIENTE, ID_EMPRESA, ID_PESSOA, ID_GRUPO_CLIENTE)
PESSOAS(ID_PESSOA, NOME, CPF_CNPJ, EMAIL)
GRUPO_CLIENTE(ID_GRUPO_CLIENTE, DESCRICAO)  -- "PONTO DE VENDA - GROTT"...
PRODUTOS(ID_PRODUTO, DESCRICAO, ID_EMPRESA)
TABELA_PRECO(ID_TABELA_PRECO, DESCRICAO)
PRECO(ID_PRODUTO, ID_CLIENTE NULL, ID_TABELA_PRECO, VALOR)
ESTADOS/CIDADES/BAIRROS/RUAS  (endereço normalizado)
FPGTO(...) -- condições de pagamento (parcelas)
```

Filtro `ENTREGAR = 1` aplicado **apenas** no endpoint de lista bulk, nunca em buscas individuais.

---

## 8. Páginas e rotas (React Router)

```
/auth                 Login
/                     MainMap (mapa principal com filtros)
/pedidos-dia          Lista pedidos do ERP por data + mapa
/new                  Cadastro de entrega (form com GPS)
/edit/:id             Editar entrega
/equipment/:id        Detalhe equipamento (histórico, recolha)
/rotas                Otimização de rotas (admin)
/pedidos-venda        Lista + criação pedidos de venda (vendedor)
/higienizacao         Agenda + aba Alocações
/financeiro           Boletos Cora
/analytics            Dashboards (admin)
/saude-cliente        Saúde do cliente (todos respeitando empresa)
/etiquetas            Editor de etiquetas Argox
/usuarios             Gerenciamento (admin)
/configuracoes        Settings + multi-empresa + WhatsApp por empresa
/install              Instruções PWA
/confirm/:token       Página PÚBLICA cliente
```

---

## 9. Fluxos de negócio (estado atual)

### 9.1 Entrega normal
1. Entregador abre **Pedidos do Dia** → seleciona → "Entregar".
2. Form pré-preenchido; captura GPS via `navigator.geolocation`, foto opcional.
3. Persiste em `equipments` (status `ENTREGUE`). Se offline → `sync_status='pending'`, fila localforage.
4. Chama `update-erp-order-status` (ID_STATUS = 4). Gate: só permitido se status atual ∈ {3,19}.
5. Equipamentos sem chopeira (growler/garrafa avulso) → status já vai para `RECOLHIDO`.

### 9.2 Cliente irá avisar
1. Form marca `cliente_ira_avisar=true`, periodo `CLIENTE_IRA_AVISAR`, status `ENTREGUE` (badge âmbar).
2. Botão WhatsApp gera `wa.me` com link `/confirm/<token>`. Token UUID, validade 30 dias.
3. Página pública (anon) lista equipamento, cliente escolhe data + período.
4. Edge `confirm-by-client` valida token, marca `token_used_at`, muda status para `LIBERADO_PARA_RECOLHA` (verde).

### 9.3 Recolha
- Verde no mapa → dialog → "Confirmar Recolha" → `confirm_collection` RPC (bypassa criador) → status `RECOLHIDO` (roxo).
- Visível por `settings.dias_exibir_recolhido` dias.

### 9.4 Otimização de rotas
- Período Manhã (08–12) / Tarde-Noite (13–18).
- Capacidade veículo **400 L**. Tempo serviço: 30 L→30 min, 60 L→40 min, ≥100 L→60 min.
- Horário fixo (`:00` ou `:30`) = limite máximo (pode antecipar). `00:00` = flexível.
- Lovable AI Gateway / Gemini sugere nº de motoristas; admin ajusta drag-and-drop (desktop) ou botão Mover (mobile).
- Persiste em `optimized_routes` + `route_stops`.

### 9.5 Higienização
- Cliente cadastrado com intervalo (default 30 d) → cálculo `proxima_limpeza`.
- Aba **Alocações** cruza ERP (clientes × equipamentos × tempo alocado) com alertas: >60d amarelo, >180d vermelho.

### 9.6 Pedido de venda (vendedor)
1. Aba clientes: combobox com busca no ERP (popover INLINE — não Radix portal — p/ rolagem mobile), recentes do vendedor; pode cadastrar novo `clientes_vendedor`.
2. Form:
   - Seleciona cliente → puxa endereço do cadastro automaticamente.
   - Botão **"Informar novo endereço"** abre `AddressAutocomplete` (Google Places, raio 150 km Jaraguá, extrai Rua/Número/Bairro/Cidade/UF + lat/lng).
   - Itens via `AddItemSheet`: filtrar produtos (chopp/garrafa/growler/equipamento). Step de quantidade = **10** para chopp, **1** para os demais. Preço via `get-erp-product-price` (PRECO específico do cliente, fallback tabela padrão).
   - Botão **"Sugerir equipamentos do chopp"**: algoritmo guloso barris (30/50/20/10 L) cobrindo total de litros, ignorando itens com "growler"/"garrafa" no nome.
   - Contador visual `X / 140 L`.
   - Campo horário tipo `time` nativo.
3. Salva em `pedidos_venda` numerado `#APP-NNN` (sequence), com `id_empresa` derivada do cliente.
4. Edge `notify-pedido-venda-whatsapp` posta no grupo Zapster correto da empresa, formato:
   ```
   🧾 *Novo pedido de venda* #APP-039
   👤 Cliente / 🧑‍💼 Vendedor / 📅 Entrega / 📍 Endereço
   🍺 Produtos: Nx NOME — R$ unit = *R$ subtotal*
   🛠️ Equipamentos: Nx tipo (sugerido p/ ...)
   💰 Subtotal / *Total*
   📝 Observações
   ```

### 9.7 Boletos Cora
- Geração mTLS, idempotência `order_number-empresa-due_date`.
- Sanitização: CEP inválido → null, documentos só dígitos.
- `id_empresa` obrigatório no INSERT.
- Sync periódico atualiza `status`/`reconciled`.
- UI: filtros status + empresa, dialog gerar manualmente, indicador lateral por status.
- Settings dinâmicos: multa (% ou fixo), juros (% a.m.), desconto até data, ambiente prod/homolog.

### 9.8 Saúde do Cliente
- Disponível a todos respeitando `user_companies`.
- KPIs: nº pedidos, valor total, ticket médio, intervalo médio (dias entre pedidos), score churn 0-100 (regra: dias desde último pedido vs intervalo médio + peso de queda), comparativo % vs média do grupo (`GRUPO_CLIENTE`).
- Aba Previsão usa `useJsApiLoader` (compartilhado) p/ evitar duplo load Maps.
- Aba Financeiro respeita filtro empresa (hook `useFinancialHealth`).
- Popover ℹ️ com legenda explicativa de churn e comparativos.

### 9.9 Multi-empresa
- `EmpresaContext` carrega `user_companies` (admin sem registro = ambas, fallback legado).
- Seletor visível quando >1 empresa. Persistência em `localStorage` com **assinatura** do conjunto — se a assinatura muda (admin ganhou nova empresa), reseta para "Todas".
- Filtros frontend SEMPRE aceitam `id_empresa == null OR ∈ allowed`.
- Logout limpa cache e seletor.

---

## 10. PWA / Offline

- `vite-plugin-pwa` com Workbox; estratégia **NetworkFirst** para navegação (`pwaUpdate.ts` purga cache em update).
- `localforage` armazena: pedidos ERP (TTL 4 h), entregas pendentes, retornos de equipamento, sessão Supabase (permite login offline cacheado).
- Fila `PENDING_SYNC` reenvia ao reconectar.
- Bloquear `signOut` quando offline (perde cache → não consegue reentrar).
- Sem suporte nativo iOS (PWA apenas, política do produto).

---

## 11. Segurança

- RLS em **todas** as tabelas. Roles em `user_roles`. Permissões: admin (tudo), entregador (entregas + recolha), vendedor (pedidos venda + clientes), financeiro (boletos; sync Cora apenas admin).
- Admin-only: sync Cora, criar usuários, configurar empresas, ver `/usuarios`.
- Entregador NÃO lê dados financeiros.
- Tokens cliente: UUID + 30 dias + single-use.
- Edge functions validam JWT antes de bater no ERP.
- Boletos com `created_by_user_id` para auditoria.

---

## 12. Integrações externas

| Serviço | Uso | Auth |
|---|---|---|
| Firebird ERP | dados-mestre | API key proxy |
| Cora Bank | boletos | mTLS (cert+key) |
| Google Maps JS | mapa, places, geocoder, directions | API key restrita |
| Lovable AI Gateway | OCR (Gemini Vision), rota (Gemini), futuras IAs | LOVABLE_API_KEY |
| Zapster (WhatsApp) | notificações grupo | token + group_id por empresa |

---

## 13. Critérios de aceite (a IA recriadora deve reproduzir)

- [ ] Login Supabase com 4 roles funcionando, redirecionamento por papel.
- [ ] Multi-empresa com seletor e isolamento real em todas as listas.
- [ ] Mapa principal com 5 filtros (Pedidos dia, Higiene, Entregue, Liberado, Recolhido, Cliente irá avisar).
- [ ] Cadastro de entrega offline → sincroniza ao voltar online.
- [ ] Recolha por cliente via link público com token.
- [ ] Pedidos de venda com #APP-NNN, preço por cliente, sugestão de barris gulosa, notificação WhatsApp com total correto.
- [ ] Boletos Cora gerando, conciliando, com multa/juros/desconto configuráveis.
- [ ] Higienização com cálculo de próxima limpeza e aba Alocações.
- [ ] Saúde do cliente com score de churn e comparativos por grupo.
- [ ] PWA instalável, funciona offline, fila de sync visível.
- [ ] Todas as cores via tokens HSL; nenhuma cor hardcoded.
- [ ] Datas sem shift de timezone.

---

## 14. Dicas para a IA executora

1. Começar pelo **schema + RLS + roles + EmpresaContext** antes da UI.
2. Mockar o proxy ERP em dev (Express local devolvendo JSON fixture) para destravar o front.
3. Implementar `useJsApiLoader` UMA VEZ no provider — nunca por componente.
4. Sempre conferir `id_empresa` ao escrever queries; aceitar NULL.
5. Antes de qualquer cor, abrir `src/index.css` e criar/usar token.
6. Para datas: `setHours(12,0,0,0)` antes de `format`.
7. Edge function nova: copiar `_shared/auth.ts` e usar `getClaims()` primeiro.
8. Não recriar selects de Radix com portal dentro de Drawers/Sheets — quebra rolagem mobile; use Popover inline.

---

Fim. Este documento descreve o estado atual de produção. Recriar passo a passo seguindo seções 5 → 6 → 7 → 8 → 9 reproduz o sistema 1:1.
