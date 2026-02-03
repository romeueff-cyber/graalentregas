# API Firebird para Integração com Graal Entregas

Esta API Node.js deve ser instalada no servidor do ERP para permitir a busca de pedidos no Firebird.

## Requisitos

- Node.js 18+ instalado no servidor
- Acesso de rede ao banco Firebird

## Instalação

### 1. Criar pasta do projeto

```bash
mkdir erp-api
cd erp-api
```

### 2. Inicializar projeto e instalar dependências

```bash
npm init -y
npm install express node-firebird cors dotenv
```

### 3. Criar arquivo `.env`

```env
FIREBIRD_HOST=localhost
FIREBIRD_PORT=3050
FIREBIRD_DATABASE=C:\Program Files (x86)\Beer_Sales\Database\BS_GRAALBEER.FDB
FIREBIRD_USER=sysdba
FIREBIRD_PASSWORD=masterkey
API_PORT=3051
API_KEY=sua_chave_secreta_aqui
```

### 4. Criar arquivo `server.js`

```javascript
require('dotenv').config();
const express = require('express');
const Firebird = require('node-firebird');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração do Firebird
const fbOptions = {
  host: process.env.FIREBIRD_HOST || 'localhost',
  port: parseInt(process.env.FIREBIRD_PORT) || 3050,
  database: process.env.FIREBIRD_DATABASE,
  user: process.env.FIREBIRD_USER || 'SYSDBA',
  password: process.env.FIREBIRD_PASSWORD || 'masterkey',
  lowercase_keys: false,
  role: null,
  pageSize: 4096
};

// Middleware de autenticação
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'API key inválida' });
  }
  next();
};

// Helper para executar queries
const executeQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    Firebird.attach(fbOptions, (err, db) => {
      if (err) {
        console.error('Erro ao conectar:', err);
        return reject(err);
      }
      
      db.query(query, params, (err, result) => {
        db.detach();
        if (err) {
          console.error('Erro na query:', err);
          return reject(err);
        }
        resolve(result);
      });
    });
  });
};

// Endpoint de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint para buscar pedido por número
app.get('/api/orders/:orderNumber', authenticate, async (req, res) => {
  try {
    const orderNumber = req.params.orderNumber;
    
    // Query principal com endereço completo
    const query = `
      SELECT FIRST 1
        ov.N_PEDIDO,
        ov.ID_ORDENS_VENDA,
        ov.DATA_PREV_RETORNO,
        ov.DATA_PREV_ENTREGA,
        ov.OBS,
        ov.NUMERO,
        ov.COMPLEMENTO,
        p.NOME,
        p.APELIDO,
        e.NOME AS ESTADO,
        e.SIGLA AS UF,
        c.NOME AS CIDADE,
        b.NOME AS BAIRRO,
        r.NOME AS RUA
      FROM ORDENS_VENDA ov
      JOIN CLIENTES cl ON ov.ID_CLIENTE = cl.ID_CLIENTE
      JOIN PESSOAS p ON cl.ID_PESSOA = p.ID_PESSOA
      LEFT JOIN ESTADO e ON ov.ID_ESTADO = e.ID_ESTADO
      LEFT JOIN CIDADE c ON ov.ID_CIDADE = c.ID_CIDADE
      LEFT JOIN BAIRRO b ON ov.ID_BAIRRO = b.ID_BAIRRO
      LEFT JOIN RUA r ON ov.ID_RUA = r.ID_RUA
      WHERE ov.N_PEDIDO = ?
        AND (ov.DELETED IS NULL OR ov.DELETED = 0)
      ORDER BY ov.DATE_CAD DESC
    `;
    
    const orders = await executeQuery(query, [parseInt(orderNumber)]);
    
    if (!orders || orders.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    
    const order = orders[0];
    const orderId = order.ID_ORDENS_VENDA;
    
    // Buscar celular do cliente (prioridade) ou telefone fixo
    const phoneQuery = `
      SELECT FIRST 1 c.DESCRICAO
      FROM CONTATO c
      JOIN TIPO_CONTATO tc ON c.ID_TIPO_CONTATO = tc.ID_TIPO_CONTATO
      JOIN CLIENTES cl ON c.ID_PESSOA = cl.ID_PESSOA
      JOIN ORDENS_VENDA ov ON ov.ID_CLIENTE = cl.ID_CLIENTE
      WHERE ov.N_PEDIDO = ?
        AND (c.DELETED IS NULL OR c.DELETED = 0)
        AND UPPER(tc.DESCRICAO) IN ('CELULAR', 'FONE')
      ORDER BY 
        CASE UPPER(tc.DESCRICAO) 
          WHEN 'CELULAR' THEN 1 
          WHEN 'FONE' THEN 2 
          ELSE 3 
        END
    `;
    
    const phones = await executeQuery(phoneQuery, [parseInt(orderNumber)]);
    const phone = phones && phones.length > 0 ? phones[0].DESCRICAO : null;
    
    // Buscar itens do pedido (produtos)
    const itemsQuery = `
      SELECT 
        pr.DESCRICAO AS PRODUTO,
        iov.QTDE_PEDIDA AS QUANTIDADE,
        iov.PRECO_UNIT AS VALOR_UNITARIO,
        iov.VALOR_ITEM AS VALOR_TOTAL
      FROM ITENS_ORDENS_VENDA iov
      JOIN PRODUTOS pr ON iov.ID_PRODUTO = pr.ID_PRODUTOS
      WHERE iov.ID_ORDENS_VENDA = ?
        AND (iov.DELETED IS NULL OR iov.DELETED = 0)
    `;
    
    const itemsResult = await executeQuery(itemsQuery, [orderId]);
    const items = (itemsResult || []).map(item => ({
      product: item.PRODUTO || '',
      quantity: item.QUANTIDADE || 0,
      unit_price: item.VALOR_UNITARIO || 0,
      total: item.VALOR_TOTAL || 0
    }));
    
    // Buscar equipamentos do pedido (barris, chopeiras, etc.)
    const equipmentsQuery = `
      SELECT 
        te.DESCRICAO AS TIPO,
        eov.QTDE AS QUANTIDADE,
        eov.N_PATRIMONIO AS PATRIMONIO
      FROM EQUIP_ORDENS_VENDA eov
      JOIN TIPO_EQUIPAMENTO te ON eov.ID_TIPO_EQUIPAMENTO = te.ID_TIPO_EQUIPAMENTO
      WHERE eov.ID_ORDENS_VENDA = ?
        AND (eov.DELETED IS NULL OR eov.DELETED = 0)
    `;
    
    const equipmentsResult = await executeQuery(equipmentsQuery, [orderId]);
    const equipments = (equipmentsResult || []).map(eq => ({
      type: eq.TIPO || '',
      quantity: eq.QUANTIDADE || 0,
      patrimony: eq.PATRIMONIO || null
    }));
    
    // Montar endereço completo
    const addressParts = [];
    if (order.RUA) addressParts.push(order.RUA);
    if (order.NUMERO) addressParts.push(order.NUMERO);
    if (order.COMPLEMENTO) addressParts.push(order.COMPLEMENTO);
    
    const locationParts = [];
    if (order.BAIRRO) locationParts.push(order.BAIRRO);
    if (order.CIDADE) locationParts.push(order.CIDADE);
    if (order.UF) locationParts.push(order.UF);
    
    const fullAddress = addressParts.join(', ');
    const location = locationParts.join(' - ');
    
    res.json({
      order_number: order.N_PEDIDO?.toString() || orderNumber,
      customer_name: order.NOME || order.APELIDO || '',
      phone: phone || '',
      pickup_date: order.DATA_PREV_RETORNO || order.DATA_PREV_ENTREGA || null,
      delivery_date: order.DATA_PREV_ENTREGA || null,
      observations: order.OBS || '',
      address: fullAddress,
      location: location,
      address_details: {
        street: order.RUA || '',
        number: order.NUMERO || '',
        complement: order.COMPLEMENTO || '',
        neighborhood: order.BAIRRO || '',
        city: order.CIDADE || '',
        state: order.UF || ''
      },
      items: items,
      equipments: equipments
    });
    
  } catch (error) {
    console.error('Erro ao buscar pedido:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Endpoint para listar pedidos por data
app.get('/api/orders', authenticate, async (req, res) => {
  try {
    const dateParam = req.query.date; // formato YYYY-MM-DD
    
    if (!dateParam) {
      return res.status(400).json({ error: 'Parâmetro date é obrigatório (YYYY-MM-DD)' });
    }
    
    // Converter data para formato Firebird
    const [year, month, day] = dateParam.split('-');
    const firebirdDate = `${month}/${day}/${year}`;
    
    console.log(`Buscando pedidos para data: ${firebirdDate}`);
    
    // Query para buscar pedidos do dia marcados para entrega
    // IMPORTANTE: ov.ENTREGAR = 1 filtra apenas pedidos marcados para entrega
    const ordersQuery = `
      SELECT 
        ov.N_PEDIDO,
        ov.ID_ORDENS_VENDA,
        ov.DATA_PREV_RETORNO,
        ov.DATA_PREV_ENTREGA,
        ov.OBS,
        p.NOME,
        p.APELIDO,
        e.SIGLA AS UF,
        ci.NOME AS CIDADE,
        b.NOME AS BAIRRO,
        r.NOME AS RUA,
        ov.NUMERO,
        ov.COMPLEMENTO,
        s.DESCRICAO AS STATUS_DESCRICAO
      FROM ORDENS_VENDA ov
      LEFT JOIN CLIENTES cl ON ov.ID_CLIENTE = cl.ID_CLIENTE
      LEFT JOIN PESSOAS p ON cl.ID_PESSOA = p.ID_PESSOA
      LEFT JOIN ESTADO e ON ov.ID_ESTADO = e.ID_ESTADO
      LEFT JOIN CIDADE ci ON ov.ID_CIDADE = ci.ID_CIDADE
      LEFT JOIN BAIRRO b ON ov.ID_BAIRRO = b.ID_BAIRRO
      LEFT JOIN RUA r ON ov.ID_RUA = r.ID_RUA
      LEFT JOIN STATUS s ON ov.ID_STATUS = s.ID_STATUS
      WHERE CAST(ov.DATA_PREV_ENTREGA AS DATE) = ?
        AND ov.ENTREGAR = 1
        AND (ov.DELETED IS NULL OR ov.DELETED = 0)
      ORDER BY ov.N_PEDIDO DESC
    `;
    
    const orders = await executeQuery(ordersQuery, [firebirdDate]);
    
    if (!orders || orders.length === 0) {
      return res.json([]);
    }
    
    // Para cada pedido, buscar telefone, itens e equipamentos
    const ordersWithDetails = await Promise.all(orders.map(async (order) => {
      const orderId = order.ID_ORDENS_VENDA;
      const orderNumber = order.N_PEDIDO?.toString();
      
      // Buscar telefone
      const phoneQuery = `
        SELECT FIRST 1 co.DESCRICAO
        FROM CONTATO co
        JOIN CLIENTES cl ON co.ID_PESSOA = cl.ID_PESSOA
        JOIN ORDENS_VENDA ov ON ov.ID_CLIENTE = cl.ID_CLIENTE
        WHERE ov.N_PEDIDO = ?
          AND co.ID_TIPO_CONTATO IN (1, 2)
        ORDER BY co.ID_TIPO_CONTATO ASC
      `;
      const phones = await executeQuery(phoneQuery, [parseInt(orderNumber)]);
      const phone = phones && phones.length > 0 ? phones[0].DESCRICAO : null;
      
      // Buscar itens
      const itemsQuery = `
        SELECT 
          pr.DESCRICAO AS PRODUTO,
          iov.QTDE_PEDIDA AS QUANTIDADE,
          iov.PRECO_UNIT AS VALOR_UNITARIO,
          iov.VALOR_ITEM AS VALOR_TOTAL
        FROM ITENS_ORDENS_VENDA iov
        JOIN PRODUTOS pr ON iov.ID_PRODUTO = pr.ID_PRODUTOS
        WHERE iov.ID_ORDENS_VENDA = ?
          AND (iov.DELETED IS NULL OR iov.DELETED = 0)
      `;
      const itemsResult = await executeQuery(itemsQuery, [orderId]);
      const items = (itemsResult || []).map(item => ({
        product: item.PRODUTO || '',
        quantity: item.QUANTIDADE || 0,
        unit_price: item.VALOR_UNITARIO || 0,
        total: item.VALOR_TOTAL || 0
      }));
      
      // Buscar equipamentos com patrimônio
      const equipmentsQuery = `
        SELECT 
          te.DESCRICAO AS TIPO,
          eov.QTDE AS QUANTIDADE,
          eov.N_PATRIMONIO AS PATRIMONIO
        FROM EQUIP_ORDENS_VENDA eov
        JOIN TIPO_EQUIPAMENTO te ON eov.ID_TIPO_EQUIPAMENTO = te.ID_TIPO_EQUIPAMENTO
        WHERE eov.ID_ORDENS_VENDA = ?
          AND (eov.DELETED IS NULL OR eov.DELETED = 0)
      `;
      const equipmentsResult = await executeQuery(equipmentsQuery, [orderId]);
      const equipments = (equipmentsResult || []).map(eq => ({
        type: eq.TIPO || '',
        quantity: eq.QUANTIDADE || 0,
        patrimony: eq.PATRIMONIO || null
      }));
      
      return {
        order_number: orderNumber,
        client_name: order.NOME || order.APELIDO || '',
        phone: phone || null,
        expected_delivery: order.DATA_PREV_ENTREGA || null,
        expected_return: order.DATA_PREV_RETORNO || null,
        observations: order.OBS || null,
        erp_status: order.STATUS_DESCRICAO || null,
        address: {
          street: order.RUA || '',
          number: order.NUMERO || '',
          complement: order.COMPLEMENTO || '',
          neighborhood: order.BAIRRO || '',
          city: order.CIDADE || '',
          state: order.UF || ''
        },
        items: items,
        equipments: equipments
      };
    }));
    
    res.json(ordersWithDetails);
    
  } catch (error) {
    console.error('Erro ao listar pedidos:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Endpoint para atualizar status do pedido
app.put('/api/orders/:orderNumber/status', authenticate, async (req, res) => {
  try {
    const orderNumber = req.params.orderNumber;
    const { statusId } = req.body;
    
    if (!statusId) {
      return res.status(400).json({ error: 'statusId é obrigatório' });
    }
    
    console.log(`Atualizando pedido ${orderNumber} para status ${statusId}`);
    
    // Buscar o pedido para verificar se existe
    const checkQuery = `
      SELECT ID_ORDENS_VENDA, ID_STATUS 
      FROM ORDENS_VENDA 
      WHERE N_PEDIDO = ? 
        AND (DELETED IS NULL OR DELETED = 0)
    `;
    
    const orders = await executeQuery(checkQuery, [parseInt(orderNumber)]);
    
    if (!orders || orders.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    
    const orderId = orders[0].ID_ORDENS_VENDA;
    const previousStatus = orders[0].ID_STATUS;
    
    // Atualizar o status
    const updateQuery = `
      UPDATE ORDENS_VENDA 
      SET ID_STATUS = ?, DATE_UPDATE = CURRENT_TIMESTAMP 
      WHERE ID_ORDENS_VENDA = ?
    `;
    
    await executeQuery(updateQuery, [statusId, orderId]);
    
    console.log(`Pedido ${orderNumber} atualizado: status ${previousStatus} -> ${statusId}`);
    
    res.json({
      success: true,
      order_number: orderNumber,
      previous_status: previousStatus,
      new_status: statusId
    });
    
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Endpoint para buscar dados de boleto do pedido
app.get('/api/orders/:orderNumber/boleto', authenticate, async (req, res) => {
  try {
    const orderNumber = req.params.orderNumber;
    
    console.log(`Buscando dados de boleto para pedido: ${orderNumber}`);
    
    const query = `
      SELECT 
        ov.ID_ORDENS_VENDA AS ORDER_ID,
        ov.N_PEDIDO AS ORDER_NUMBER,
        p.NOME AS CUSTOMER_NAME,
        p.CPF_CNPJ AS CUSTOMER_DOCUMENT,
        CASE WHEN p.JURIDICA = 1 THEN 'CNPJ' ELSE 'CPF' END AS DOCUMENT_TYPE,
        p.ID_PESSOA,
        fp.ID_FORMA_PAGAMENTO AS PAYMENT_METHOD_ID,
        fp.DESCRICAO AS PAYMENT_METHOD_DESCRIPTION,
        fp.TIPO AS PAYMENT_METHOD_TYPE,
        fpgto.ID_FPGTO AS PAYMENT_TERMS_ID,
        fpgto.CODIGO AS PAYMENT_TERMS_CODE,
        fpgto.DESCRICAO AS PAYMENT_TERMS_DESCRIPTION,
        ov.VALOR_PEDIDO AS TOTAL_AMOUNT
      FROM ORDENS_VENDA ov
      INNER JOIN CLIENTES cl ON cl.ID_CLIENTE = ov.ID_CLIENTE
      INNER JOIN PESSOAS p ON p.ID_PESSOA = cl.ID_PESSOA
      LEFT JOIN FORMA_PAGAMENTO fp ON fp.ID_FORMA_PAGAMENTO = ov.ID_FORMA_PAGAMENTO
      LEFT JOIN FPGTO fpgto ON fpgto.ID_FPGTO = ov.ID_FPGTO
      WHERE ov.N_PEDIDO = ?
        AND (ov.DELETED IS NULL OR ov.DELETED = 0)
    `;
    
    const result = await executeQuery(query, [parseInt(orderNumber)]);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    
    const order = result[0];
    
    // Buscar email do cliente (ID_TIPO_CONTATO = 3 é email)
    const emailQuery = `
      SELECT FIRST 1 c.DESCRICAO
      FROM CONTATO c
      WHERE c.ID_PESSOA = ?
        AND c.ID_TIPO_CONTATO = 3
        AND (c.DELETED IS NULL OR c.DELETED = 0)
    `;
    
    const emailResult = await executeQuery(emailQuery, [order.ID_PESSOA]);
    const customerEmail = emailResult && emailResult.length > 0 ? emailResult[0].DESCRICAO : null;
    
    // Calcular dias de vencimento baseado no CODIGO
    // CODIGO pode ser: "14" (uma parcela) ou "7;14;21" (múltiplas parcelas)
    const paymentCode = order.PAYMENT_TERMS_CODE || '0';
    const dueDays = paymentCode.split(';').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d));
    
    res.json({
      order_id: order.ORDER_ID,
      order_number: order.ORDER_NUMBER?.toString() || orderNumber,
      customer: {
        name: order.CUSTOMER_NAME,
        document: order.CUSTOMER_DOCUMENT,
        document_type: order.DOCUMENT_TYPE,
        email: customerEmail
      },
      payment: {
        method_id: order.PAYMENT_METHOD_ID,
        method_description: order.PAYMENT_METHOD_DESCRIPTION,
        method_type: order.PAYMENT_METHOD_TYPE,
        terms_id: order.PAYMENT_TERMS_ID,
        terms_code: order.PAYMENT_TERMS_CODE,
        terms_description: order.PAYMENT_TERMS_DESCRIPTION,
        due_days: dueDays.length > 0 ? dueDays : [0]
      },
      total_amount: order.TOTAL_AMOUNT
    });
    
  } catch (error) {
    console.error('Erro ao buscar dados do boleto:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

const PORT = process.env.API_PORT || 3051;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API ERP rodando na porta ${PORT}`);
});
```

### 5. Iniciar a API

```bash
node server.js
```

### 6. (Opcional) Configurar como serviço Windows

Usando PM2:
```bash
npm install -g pm2
pm2 start server.js --name erp-api
pm2 save
pm2 startup
```

## Configuração no Lovable

Após iniciar a API, configure no Lovable:

1. **ERP_API_URL**: `http://eget-graalbeer.sytes.net:3051` (ou a porta que escolher)
2. **ERP_API_KEY**: A mesma chave que definiu no `.env` da API

## Endpoints Disponíveis

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/health` | Health check (sem autenticação) |
| GET | `/api/orders/:orderNumber` | Buscar pedido por número |
| GET | `/api/orders?date=YYYY-MM-DD` | Listar pedidos do dia (apenas com `ENTREGAR = 1`) |
| PUT | `/api/orders/:orderNumber/status` | Atualizar status do pedido |
| GET | `/api/orders/:orderNumber/boleto` | Buscar dados para emissão de boleto |

## Teste

```bash
# Health check
curl http://localhost:3051/health

# Buscar pedido
curl -H "X-API-KEY: sua_chave_secreta" http://localhost:3051/api/orders/12345

# Dados para boleto
curl -H "X-API-KEY: sua_chave_secreta" http://localhost:3051/api/orders/12345/boleto
```

## Segurança

- Use HTTPS em produção (configure um proxy reverso com nginx/caddy)
- Mantenha a API_KEY segura
- Considere adicionar rate limiting

## Estrutura do Banco de Dados

### Caminho para dados do cliente

```
ORDENS_VENDA
  └── ID_CLIENTE → CLIENTES
                     └── ID_PESSOA → PESSOAS (CPF_CNPJ, NOME, JURIDICA)
                                       └── CONTATO (ID_TIPO_CONTATO=3 para email)
```

### Colunas importantes

| Tabela | Coluna | Descrição |
|--------|--------|-----------|
| ORDENS_VENDA | VALOR_PEDIDO | Valor total do pedido |
| ORDENS_VENDA | ID_FPGTO | FK para condições de pagamento |
| ORDENS_VENDA | ID_FORMA_PAGAMENTO | FK para forma de pagamento |
| ORDENS_VENDA | ENTREGAR | 1 = marcado para entrega |
| PESSOAS | CPF_CNPJ | Documento do cliente |
| PESSOAS | JURIDICA | 0 = PF, 1 = PJ |
| FPGTO | CODIGO | Dias das parcelas (ex: "7;14") |
| FORMA_PAGAMENTO | TIPO | "BOL" = boleto bancário |
