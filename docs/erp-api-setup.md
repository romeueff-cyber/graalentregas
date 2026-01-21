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
    
    // Buscar equipamentos do pedido (barris)
    const equipmentsQuery = `
      SELECT 
        te.DESCRICAO AS TIPO,
        eov.QTDE AS QUANTIDADE
      FROM EQUIP_ORDENS_VENDA eov
      JOIN TIPO_EQUIPAMENTO te ON eov.ID_TIPO_EQUIPAMENTO = te.ID_TIPO_EQUIPAMENTO
      WHERE eov.ID_ORDENS_VENDA = ?
        AND (eov.DELETED IS NULL OR eov.DELETED = 0)
    `;
    
    const equipmentsResult = await executeQuery(equipmentsQuery, [orderId]);
    const equipments = (equipmentsResult || []).map(eq => ({
      type: eq.TIPO || '',
      quantity: eq.QUANTIDADE || 0
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

## Teste

```bash
curl -H "X-API-KEY: sua_chave_secreta" http://localhost:3051/api/orders/12345
```

## Segurança

- Use HTTPS em produção (configure um proxy reverso com nginx/caddy)
- Mantenha a API_KEY segura
- Considere adicionar rate limiting
