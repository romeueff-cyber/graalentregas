# Prompt do Sistema Graal Beer Entregas - Recriação Completa

## Visão Geral do Sistema

Você vai criar um sistema completo de gerenciamento de entregas para a distribuidora **Graal Beer**, localizada em Jaraguá do Sul, Santa Catarina, Brasil. O sistema é um PWA (Progressive Web App) mobile-first usado por entregadores para gerenciar entregas de barris de chopp, chopeiras e growlers.

---

## Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Storage)
- **Mapas**: Google Maps JavaScript API
- **Animações**: Framer Motion
- **Banco ERP Legado**: Firebird (via proxy Node.js Express)
- **Banco Cora**: API para emissão de boletos (mTLS)

---

## Funcionalidades Principais

### 1. Autenticação
- Login com email/senha via Supabase Auth
- Dois perfis: `admin` e `entregador`
- Tabela `profiles` para dados adicionais do usuário
- Tabela `user_roles` para controle de permissões

### 2. Mapa Principal (`/`)
Página inicial com mapa do Google Maps mostrando:

**Filtros de visualização:**
- **Pedidos do Dia**: Pedidos do ERP agendados para hoje (marcadores azuis)
- **Higiene**: Clientes com equipamentos que precisam limpeza (marcadores verdes)
- **Equipamentos por Status**:
  - 🔴 ENTREGUE (vermelho) - Aguardando recolha
  - 🟢 LIBERADO_PARA_RECOLHA (verde) - Cliente liberou
  - 🟣 RECOLHIDO (roxo) - Já coletado
  - 🟠 CLIENTE_IRA_AVISAR (âmbar) - Aguardando cliente confirmar data

**Marcadores no mapa:**
- Clique abre dialog com detalhes do equipamento/pedido
- Botões de ação: Confirmar Recolha, Ver Detalhes, Editar, WhatsApp

### 3. Cadastro de Entrega (`/new`)
Formulário para registrar nova entrega:

**Campos:**
- Nome do Cliente *
- Telefone do Cliente (para WhatsApp)
- Número do Pedido * (dropdown dos pedidos do dia + busca ERP)
- Data Prevista de Recolha
- Período: Manhã, Tarde, Noite, Dia Todo, Cliente Irá Avisar
- Observações
- Localização GPS (mapa interativo)
- Foto do local (opcional)

**Lógica especial:**
- "Cliente irá avisar" marca status como "Aguardando Cliente" (âmbar)
- Growler/Barril SEM chopeira = auto-recolha imediata (status RECOLHIDO)
- Chopeira sempre requer data de recolha futura

**Integração ERP:**
- Botão "Buscar no ERP" consulta dados do pedido
- Atualiza status no ERP para "ENTREGUE" após registrar

### 4. Pedidos do Dia (`/pedidos-dia`)
Lista de todos os pedidos do ERP para uma data específica:

**Funcionalidades:**
- Seletor de data
- Mapa com marcadores geocodificados
- Lista accordion com detalhes de cada pedido
- Ícones indicando tipo de equipamento (Growler, Barril, Chopeira)
- Botão "Entregar" que abre formulário pré-preenchido
- Status de sincronização (cache offline)

**Informações do pedido:**
- Cliente, telefone, endereço completo
- Itens (produtos) com quantidades e valores
- Equipamentos (barris, chopeiras) com volumes

### 5. Otimização de Rotas (`/rotas`)
Sistema inteligente de planejamento de rotas:

**Entrada:**
- Data e período (Manhã 08:00-12:00 ou Tarde/Noite 13:00-18:00)
- Pedidos do ERP geocodificados

**Sugestão de IA:**
- Analisa quantidade de entregas, volume total (litros), horários fixos
- Sugere número ideal de entregadores
- Considera proximidade geográfica

**Regras de negócio:**
- Capacidade máxima por veículo: 400 litros
- Tempo de serviço por volume: 30L=30min, 60L=40min, 100L+=60min
- Horário fixo (:00 ou :30) = limite máximo (pode entregar antes)
- 00:00 = horário flexível

**Atribuição de entregadores:**
- Dropdown para selecionar usuários com role `entregador`
- Auto-atribuição ao gerar rotas
- Drag & Drop (desktop) ou botão Mover (mobile) para realocar paradas

**Salvar rotas:**
- Persiste em `optimized_routes` e `route_stops`
- Associa cada rota a um entregador

### 6. Agenda de Higienização (`/higienizacao`)
Controle de limpeza de equipamentos em clientes fixos:

**Cadastro de cliente de higiene:**
- Nome, endereço, telefone
- Localização GPS
- Intervalo de limpeza em dias (padrão 30)

**Equipamentos:**
- Tipos: Chopeira, Geladeira, Balcão
- Número de série
- Modelo (para chopeiras)
- Data da última limpeza
- Próxima limpeza calculada automaticamente

**Serviços:**
- Limpeza: Atualiza `ultima_limpeza` e calcula `proxima_limpeza`
- Troca: Registra novo número de série

**Alertas:**
- Badge vermelho: Atrasadas
- Badge âmbar: Próximos 7 dias

### 7. Financeiro (`/financeiro`)
Gerenciamento de boletos via Cora Bank:

**Funcionalidades:**
- Lista de boletos emitidos
- Sincronização com Cora para atualizar status
- Marcação de conciliação (confirmação de baixa no ERP)
- Filtros por status: Pendente, Pago, Vencido, A Conciliar
- Estatísticas: Total, Pendentes, Pagos, Vencidos, Valor recebido

**Status de boletos:**
- PENDING/REGISTERED: Aguardando pagamento
- PAID: Pago (verificar conciliação)
- OVERDUE: Vencido
- CANCELLED: Cancelado

---

## Estrutura do Banco de Dados (Supabase)

### Tabela `profiles`
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabela `user_roles`
```sql
CREATE TYPE app_role AS ENUM ('admin', 'entregador');
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users,
  role app_role DEFAULT 'entregador'
);
```

### Tabela `equipments` (entregas)
```sql
CREATE TYPE equipment_status AS ENUM ('ENTREGUE', 'LIBERADO_PARA_RECOLHA', 'RECOLHIDO');
CREATE TYPE collection_period AS ENUM ('DIA_TODO', 'MANHA', 'TARDE', 'NOITE', 'CLIENTE_IRA_AVISAR');
CREATE TYPE sync_status AS ENUM ('synced', 'pending');

CREATE TABLE equipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL REFERENCES auth.users,
  nome_cliente TEXT NOT NULL,
  telefone_cliente TEXT,
  pedido_dia TEXT NOT NULL,
  periodo_recolha collection_period NOT NULL,
  data_prevista_recolha DATE NOT NULL,
  data_entrega DATE,
  data_real_recolha DATE,
  status equipment_status DEFAULT 'ENTREGUE',
  observacoes TEXT,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  foto_url TEXT,
  foto_local_path TEXT,
  cliente_ira_avisar BOOLEAN DEFAULT false,
  confirmation_token TEXT,
  token_created_at TIMESTAMPTZ,
  token_used_at TIMESTAMPTZ,
  sync_status sync_status DEFAULT 'synced',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabela `optimized_routes`
```sql
CREATE TABLE optimized_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL REFERENCES auth.users,
  route_date DATE NOT NULL,
  period TEXT NOT NULL,
  driver_index INTEGER NOT NULL,
  driver_label TEXT NOT NULL,
  color TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  total_distance FLOAT DEFAULT 0,
  total_duration FLOAT DEFAULT 0,
  total_volume_liters FLOAT DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabela `route_stops`
```sql
CREATE TABLE route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES optimized_routes ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  order_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  expected_delivery TEXT,
  arrival_time TEXT NOT NULL,
  departure_time TEXT NOT NULL,
  volume_liters FLOAT DEFAULT 30,
  estimated_service_time INTEGER DEFAULT 30,
  distance_from_previous FLOAT DEFAULT 0,
  duration_from_previous FLOAT DEFAULT 0,
  status TEXT DEFAULT 'pending'
);
```

### Tabela `hygiene_clients`
```sql
CREATE TABLE hygiene_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL REFERENCES auth.users,
  nome_cliente TEXT NOT NULL,
  endereco TEXT NOT NULL,
  telefone_cliente TEXT,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  intervalo_limpeza_dias INTEGER DEFAULT 30,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabela `hygiene_equipment`
```sql
CREATE TYPE hygiene_equipment_type AS ENUM ('chopeira', 'geladeira', 'balcao');

CREATE TABLE hygiene_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES hygiene_clients ON DELETE CASCADE,
  tipo_equipamento hygiene_equipment_type NOT NULL,
  numero_serie TEXT NOT NULL,
  modelo_chopeira TEXT,
  ultima_limpeza DATE,
  proxima_limpeza DATE,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabela `hygiene_services`
```sql
CREATE TYPE hygiene_service_type AS ENUM ('limpeza', 'troca');

CREATE TABLE hygiene_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES hygiene_equipment ON DELETE CASCADE,
  executado_por_user_id UUID NOT NULL REFERENCES auth.users,
  tipo_servico hygiene_service_type NOT NULL,
  data_servico DATE DEFAULT CURRENT_DATE,
  observacoes TEXT,
  foto_url TEXT,
  novo_numero_serie TEXT,
  motivo_troca TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabela `boletos`
```sql
CREATE TABLE boletos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  cora_invoice_id TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_document TEXT NOT NULL,
  customer_email TEXT,
  total_amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'PENDING',
  pdf_url TEXT,
  barcode TEXT,
  digitable_line TEXT,
  pix_emv TEXT,
  pix_qr_code_url TEXT,
  reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMPTZ,
  reconciled_by_user_id UUID,
  created_by_user_id UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabela `settings`
```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dias_exibir_recolhido INTEGER DEFAULT 7,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Edge Functions (Backend Serverless)

### 1. `list-erp-orders`
Busca pedidos do ERP por data.
- **Input**: `{ date: "YYYY-MM-DD" }`
- **Output**: Array de pedidos com cliente, endereço, itens, equipamentos

### 2. `search-erp-order`
Busca pedido específico por número.
- **Input**: `{ orderNumber: "12345" }`
- **Output**: Dados completos do pedido

### 3. `update-erp-order-status`
Atualiza status do pedido no ERP.
- **Input**: `{ orderNumber: "12345", statusId: 4 }`
- Status 4 = ENTREGUE

### 4. `get-erp-boleto-data`
Busca dados para emissão de boleto.
- **Input**: `{ orderNumber: "12345" }`
- **Output**: CPF/CNPJ, email, valor, condições de pagamento

### 5. `gerar-boleto`
Emite boleto na Cora Bank.
- **Input**: `{ orderNumber, customerName, customerDocument, totalAmount, dueDate, ... }`
- **Output**: PDF URL, linha digitável, PIX

### 6. `sync-boletos-status`
Sincroniza status de boletos com Cora.
- Atualiza pagamentos confirmados

### 7. `optimize-routes-ai`
Otimização de rotas com IA (Gemini).
- **Actions**: `suggest_drivers` ou `optimize_full`
- Usa Lovable AI Gateway

### 8. `confirm-by-client`
Página pública para cliente confirmar data de recolha.
- Valida token único
- Atualiza equipamento para LIBERADO_PARA_RECOLHA

### 9. `get-equipment-by-token`
Busca equipamento por token de confirmação.

### 10. `list-users` / `create-user` / `manage-user`
Gerenciamento de usuários (apenas admin).

---

## Proxy ERP (Node.js + Firebird)

Servidor Express rodando no ambiente do ERP que conecta ao Firebird:

### Endpoints:
- `GET /health` - Health check
- `GET /api/orders?date=YYYY-MM-DD` - Lista pedidos por data
- `GET /api/orders/:orderNumber` - Busca pedido específico
- `GET /api/orders/:orderNumber/boleto` - Dados para boleto
- `PUT /api/orders/:orderNumber/status` - Atualiza status

### Autenticação:
- Header `X-API-KEY` com chave secreta

### Estrutura do ERP:
```
ORDENS_VENDA
  ├── ID_CLIENTE → CLIENTES → PESSOAS (nome, CPF_CNPJ)
  ├── ID_ESTADO, ID_CIDADE, ID_BAIRRO, ID_RUA (endereço)
  ├── ITENS_ORDENS_VENDA → PRODUTOS (itens do pedido)
  ├── EQUIP_ORDENS_VENDA → TIPO_EQUIPAMENTO (equipamentos)
  ├── ID_FORMA_PAGAMENTO → FORMA_PAGAMENTO
  └── ID_FPGTO → FPGTO (condições de pagamento)
```

---

## Fluxos de Negócio

### Fluxo 1: Entrega Normal
1. Entregador acessa Pedidos do Dia
2. Seleciona pedido e clica "Entregar"
3. Preenche formulário com GPS automático
4. Sistema registra equipamento com status ENTREGUE
5. Atualiza ERP para status 4 (ENTREGUE)

### Fluxo 2: Cliente Irá Avisar
1. Mesma entrada, mas marca "Cliente irá avisar"
2. Status fica ENTREGUE com periodo CLIENTE_IRA_AVISAR (âmbar)
3. Botão WhatsApp envia link de confirmação
4. Cliente acessa página pública e escolhe data/período
5. Sistema atualiza para LIBERADO_PARA_RECOLHA

### Fluxo 3: Recolha
1. Entregador vê equipamento verde (LIBERADO) no mapa
2. Clica e seleciona "Confirmar Recolha"
3. Status muda para RECOLHIDO (roxo)
4. Fica visível por X dias (configurável)

### Fluxo 4: Otimização de Rotas
1. Admin acessa /rotas e seleciona data/período
2. IA analisa e sugere quantidade de entregadores
3. Admin ajusta se necessário e gera rotas
4. Atribui cada rota a um entregador
5. Pode realocar paradas entre rotas
6. Salva rotas no banco

### Fluxo 5: Higienização
1. Cadastra cliente e equipamentos
2. Sistema calcula próxima limpeza
3. Marcadores aparecem no mapa
4. Técnico registra limpeza/troca
5. Sistema atualiza datas

### Fluxo 6: Boletos
1. Busca dados do pedido no ERP
2. Gera boleto na Cora
3. Sincroniza status periodicamente
4. Marca como conciliado após baixa no ERP

---

## Cores do Sistema (Tokens CSS)

```css
--status-delivered: 0 84% 60%;     /* Vermelho - Entregue */
--status-ready: 142 76% 36%;       /* Verde - Liberado */
--status-collected: 271 91% 65%;   /* Roxo - Recolhido */
--status-waiting: 38 92% 50%;      /* Âmbar - Aguardando */
--primary: 24 95% 53%;             /* Laranja Graal */
```

---

## PWA e Offline

- Service Worker para cache de assets
- Armazenamento local com LocalForage
- Sync status: `synced` ou `pending`
- Fila de operações offline para sincronizar quando online
- Cache de pedidos do ERP com TTL

---

## Geocodificação

- Usa Google Maps Geocoder
- Paraleliza em lotes de 6 endereços
- Timeout de 7 segundos por requisição
- Fallback para pedidos sem localização (lista separada)

---

## Segurança

- RLS (Row Level Security) em todas as tabelas
- JWT verification nas Edge Functions
- API Key para proxy ERP
- mTLS para Cora Bank
- Tokens únicos para confirmação de cliente (UUID + expiração)

---

## Configurações de Ambiente

### Secrets (Supabase/Edge Functions):
- `ERP_API_URL` - URL do proxy ERP
- `ERP_API_KEY` - Chave de autenticação ERP
- `CORA_PRIVATE_KEY` - Chave privada mTLS Cora
- `CORA_CERTIFICATE` - Certificado mTLS Cora
- `CORA_CLIENT_ID` - Client ID Cora
- `GOOGLE_MAPS_API_KEY` - Chave Google Maps
- `LOVABLE_API_KEY` - Chave Lovable AI Gateway

---

## Considerações para Recriação

1. **Mobile-first**: Todo o design é otimizado para telas pequenas
2. **Gesture handling**: `gestureHandling: 'greedy'` no Google Maps
3. **Safe area**: Suporte a notch e home indicator
4. **Realtime**: Supabase Realtime para atualizações ao vivo
5. **Optimistic updates**: UI atualiza antes da confirmação do servidor
6. **Error boundaries**: Tratamento gracioso de erros
7. **Loading states**: Skeletons e spinners em todas as operações

---

Este prompt contém toda a lógica de negócio, estrutura de dados e fluxos necessários para recriar o sistema Graal Beer Entregas em qualquer plataforma de desenvolvimento.
