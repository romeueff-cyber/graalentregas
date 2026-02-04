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

// ==========================================
// ANALYTICS DE PEDIDOS (por período)
// IMPORTANTE: Esta rota DEVE vir ANTES de /api/orders/:orderNumber
// ==========================================
app.get('/api/orders/analytics', authenticate, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Parâmetros start_date e end_date são obrigatórios (YYYY-MM-DD)' });
    }
    
    // Converter datas para formato Firebird
    const [startYear, startMonth, startDay] = start_date.split('-');
    const [endYear, endMonth, endDay] = end_date.split('-');
    const firebirdStartDate = `${startMonth}/${startDay}/${startYear}`;
    const firebirdEndDate = `${endMonth}/${endDay}/${endYear}`;
    
    console.log(`Buscando analytics de ${firebirdStartDate} até ${firebirdEndDate}`);
    
    const query = `
      SELECT 
        OV.ID_ORDENS_VENDA,
        OV.N_PEDIDO,
        OV.VALOR_PEDIDO,
        OV.DATA_PREV_ENTREGA,
        P.APELIDO AS NOME_CLIENTE,
        P.NOME AS NOME_COMPLETO,
        C.ID_CLIENTE
      FROM ORDENS_VENDA OV
      LEFT JOIN CLIENTES C ON OV.ID_CLIENTE = C.ID_CLIENTE
      LEFT JOIN PESSOAS P ON C.ID_PESSOA = P.ID_PESSOA
      WHERE OV.DATA_PREV_ENTREGA BETWEEN ? AND ?
        AND (OV.DELETED IS NULL OR OV.DELETED = 0)
      ORDER BY OV.DATA_PREV_ENTREGA DESC
    `;
    
    const result = await executeQuery(query, [firebirdStartDate, firebirdEndDate]);
    
    if (!result || result.length === 0) {
      return res.json([]);
    }
    
    const orders = result.map(row => ({
      id: row.ID_ORDENS_VENDA,
      orderNumber: row.N_PEDIDO?.toString() || '',
      value: row.VALOR_PEDIDO || 0,
      date: row.DATA_PREV_ENTREGA || null,
      clientName: row.NOME_CLIENTE || row.NOME_COMPLETO || '',
      clientId: row.ID_CLIENTE
    }));
    
    res.json(orders);
    
  } catch (error) {
    console.error('Erro ao buscar analytics:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// ==========================================
// BUSCAR PEDIDO POR NÚMERO
// ==========================================
app.get('/api/orders/:orderNumber', authenticate, async (req, res) => {
  try {
    const orderNumber = req.params.orderNumber;
    
    // Query principal com endereço completo
    const query = `
      SELECT FIRST 1
        ov.N_PEDIDO,
        ov.ID_ORDENS_VENDA,
        ov.ID_CLIENTE,
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
    const clientId = order.ID_CLIENTE;
    
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
    
    // Buscar equipamentos do pedido via EQUIP_ORDENS_VENDA (tipos genéricos)
    const equipTypesQuery = `
      SELECT 
        te.DESCRICAO AS TIPO,
        eov.QTDE AS QUANTIDADE
      FROM EQUIP_ORDENS_VENDA eov
      JOIN TIPO_EQUIPAMENTO te ON eov.ID_TIPO_EQUIPAMENTO = te.ID_TIPO_EQUIPAMENTO
      WHERE eov.ID_ORDENS_VENDA = ?
        AND (eov.DELETED IS NULL OR eov.DELETED = 0)
    `;
    
    const equipTypesResult = await executeQuery(equipTypesQuery, [orderId]);
    
    // Buscar equipamentos específicos com patrimônio via FATURAMENTO
    // Caminho: ORDENS_VENDA → FATURAMENTO → EQUIP_FATURAMENTOS → EQUIPAMENTOS
    const equipPatrimonyQuery = `
      SELECT 
        te.DESCRICAO AS TIPO,
        e.DESCRICAO AS DESCRICAO_EQUIP,
        e.PATRIMONIO,
        e.MODELO
      FROM FATURAMENTO f
      JOIN EQUIP_FATURAMENTOS ef ON ef.ID_FATURAMENTO = f.ID_FATURAMENTO
      JOIN EQUIPAMENTOS e ON e.ID_EQUIPAMENTO = ef.ID_EQUIPAMENTO
      JOIN TIPO_EQUIPAMENTO te ON te.ID_TIPO_EQUIPAMENTO = e.ID_TIPO_EQUIPAMENTO
      WHERE f.ID_ORDENS_VENDA = ?
        AND (f.DELETED IS NULL OR f.DELETED = 0)
        AND (ef.DELETED IS NULL OR ef.DELETED = 0)
        AND (e.DELETED IS NULL OR e.DELETED = 0)
    `;
    
    const equipPatrimonyResult = await executeQuery(equipPatrimonyQuery, [orderId]);
    
    // Se tem faturamento com patrimônio, usa esses dados; senão usa os tipos genéricos
    let equipments = [];
    if (equipPatrimonyResult && equipPatrimonyResult.length > 0) {
      equipments = equipPatrimonyResult.map(eq => ({
        type: eq.TIPO || '',
        description: eq.DESCRICAO_EQUIP || '',
        patrimony: eq.PATRIMONIO || null,
        model: eq.MODELO || null,
        quantity: 1
      }));
    } else {
      equipments = (equipTypesResult || []).map(eq => ({
        type: eq.TIPO || '',
        description: null,
        patrimony: null,
        model: null,
        quantity: eq.QUANTIDADE || 0
      }));
    }
    
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
      client_id: clientId,
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

// ==========================================
// LISTAR PEDIDOS POR DATA
// ==========================================
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
        ov.ID_CLIENTE,
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
      const clientId = order.ID_CLIENTE;
      
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
      
      // Buscar equipamentos do pedido via EQUIP_ORDENS_VENDA (tipos genéricos)
      const equipTypesQuery = `
        SELECT 
          te.DESCRICAO AS TIPO,
          eov.QTDE AS QUANTIDADE
        FROM EQUIP_ORDENS_VENDA eov
        JOIN TIPO_EQUIPAMENTO te ON eov.ID_TIPO_EQUIPAMENTO = te.ID_TIPO_EQUIPAMENTO
        WHERE eov.ID_ORDENS_VENDA = ?
          AND (eov.DELETED IS NULL OR eov.DELETED = 0)
      `;
      const equipTypesResult = await executeQuery(equipTypesQuery, [orderId]);
      
      // Buscar equipamentos específicos com patrimônio via FATURAMENTO
      const equipPatrimonyQuery = `
        SELECT 
          te.DESCRICAO AS TIPO,
          e.DESCRICAO AS DESCRICAO_EQUIP,
          e.PATRIMONIO,
          e.MODELO
        FROM FATURAMENTO f
        JOIN EQUIP_FATURAMENTOS ef ON ef.ID_FATURAMENTO = f.ID_FATURAMENTO
        JOIN EQUIPAMENTOS e ON e.ID_EQUIPAMENTO = ef.ID_EQUIPAMENTO
        JOIN TIPO_EQUIPAMENTO te ON te.ID_TIPO_EQUIPAMENTO = e.ID_TIPO_EQUIPAMENTO
        WHERE f.ID_ORDENS_VENDA = ?
          AND (f.DELETED IS NULL OR f.DELETED = 0)
          AND (ef.DELETED IS NULL OR ef.DELETED = 0)
          AND (e.DELETED IS NULL OR e.DELETED = 0)
      `;
      const equipPatrimonyResult = await executeQuery(equipPatrimonyQuery, [orderId]);
      
      // Se tem faturamento com patrimônio, usa esses dados; senão usa os tipos genéricos
      let equipments = [];
      if (equipPatrimonyResult && equipPatrimonyResult.length > 0) {
        equipments = equipPatrimonyResult.map(eq => ({
          type: eq.TIPO || '',
          description: eq.DESCRICAO_EQUIP || '',
          patrimony: eq.PATRIMONIO || null,
          model: eq.MODELO || null,
          quantity: 1
        }));
      } else {
        equipments = (equipTypesResult || []).map(eq => ({
          type: eq.TIPO || '',
          description: null,
          patrimony: null,
          model: null,
          quantity: eq.QUANTIDADE || 0
        }));
      }
      
      return {
        order_number: orderNumber,
        client_id: clientId,
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

// ==========================================
// LISTAR EQUIPAMENTOS ALOCADOS AO CLIENTE
// Retorna todos os equipamentos com STATUS = 'OCUPADO'
// que estão vinculados ao cliente via faturamento
// ==========================================
app.get('/api/clients/:clientId/equipment', authenticate, async (req, res) => {
  try {
    const clientId = req.params.clientId;
    
    if (!clientId) {
      return res.status(400).json({ error: 'clientId é obrigatório' });
    }
    
    console.log(`Buscando equipamentos alocados ao cliente: ${clientId}`);
    
    // Busca todos os equipamentos OCUPADOS vinculados ao cliente
    // via EQUIP_FATURAMENTOS → FATURAMENTO (que tem ID_CLIENTE diretamente!)
    // Exclui equipamentos já retornados (ID_STATUS = 10)
    // IMPORTANTE: FATURAMENTO.ID_CLIENTE é o link direto - não precisa passar por ORDENS_VENDA
    const query = `
      SELECT DISTINCT
        e.ID_EQUIPAMENTO,
        e.PATRIMONIO,
        e.STATUS,
        e.MODELO,
        te.DESCRICAO AS TIPO
      FROM EQUIPAMENTOS e
      LEFT JOIN TIPO_EQUIPAMENTO te ON te.ID_TIPO_EQUIPAMENTO = e.ID_TIPO_EQUIPAMENTO
      INNER JOIN EQUIP_FATURAMENTOS ef ON ef.ID_EQUIPAMENTO = e.ID_EQUIPAMENTO
      INNER JOIN FATURAMENTO f ON f.ID_FATURAMENTO = ef.ID_FATURAMENTO
      WHERE f.ID_CLIENTE = ?
        AND e.STATUS = 'OCUPADO'
        AND (ef.ID_STATUS IS NULL OR ef.ID_STATUS <> 10)
        AND (e.DELETED IS NULL OR e.DELETED = 0)
        AND (ef.DELETED IS NULL OR ef.DELETED = 0)
        AND (f.DELETED IS NULL OR f.DELETED = 0)
      ORDER BY te.DESCRICAO, e.PATRIMONIO
    `;
    
    const result = await executeQuery(query, [parseInt(clientId)]);
    
    const equipments = (result || []).map(row => ({
      type: row.TIPO?.trim() || 'Equipamento',
      description: row.TIPO?.trim() || null,
      patrimony: row.PATRIMONIO?.trim() || null,
      model: row.MODELO?.trim() || null,
      quantity: 1
    }));
    
    console.log(`[GET /api/clients/${clientId}/equipment] Found ${equipments.length} allocated equipment(s)`);
    
    res.json(equipments);
    
  } catch (error) {
    console.error('Erro ao buscar equipamentos do cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// ==========================================
// ATUALIZAR STATUS DO PEDIDO
// ==========================================
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

// ==========================================
// BUSCAR DADOS DE BOLETO DO PEDIDO
// ==========================================
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

// ==========================================
// LIBERAR EQUIPAMENTO (RECOLHA)
// Atualiza status na EQUIPAMENTOS e EQUIP_FATURAMENTOS
// ==========================================
app.put('/api/equipment/:patrimonio/release', authenticate, async (req, res) => {
  try {
    const patrimonio = req.params.patrimonio;
    const { statusId } = req.body; // 10 = RETORNADO
    
    console.log(`Liberando equipamento: ${patrimonio}, statusId: ${statusId || 10}`);
    
    // 1. Buscar o ID do equipamento pelo patrimônio
    const equipQuery = `
      SELECT ID_EQUIPAMENTO, STATUS 
      FROM EQUIPAMENTOS 
      WHERE PATRIMONIO = ?
        AND (DELETED IS NULL OR DELETED = 0)
    `;
    
    const equipResult = await executeQuery(equipQuery, [patrimonio]);
    
    if (!equipResult || equipResult.length === 0) {
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }
    
    const equipmentId = equipResult[0].ID_EQUIPAMENTO;
    const previousEquipStatus = equipResult[0].STATUS;
    
    // 2. Atualizar status na tabela EQUIPAMENTOS para DISPONIVEL
    const updateEquipQuery = `
      UPDATE EQUIPAMENTOS 
      SET STATUS = 'DISPONIVEL', DATE_UPDATE = CURRENT_TIMESTAMP 
      WHERE ID_EQUIPAMENTO = ?
    `;
    
    await executeQuery(updateEquipQuery, [equipmentId]);
    console.log(`EQUIPAMENTOS.STATUS atualizado para DISPONIVEL (ID: ${equipmentId})`);
    
    // 3. Buscar o registro mais recente em EQUIP_FATURAMENTOS para este equipamento
    const fatQuery = `
      SELECT FIRST 1 ID_EQUIP_FATURAMENTOS, ID_STATUS 
      FROM EQUIP_FATURAMENTOS 
      WHERE ID_EQUIPAMENTO = ?
        AND (DELETED IS NULL OR DELETED = 0)
      ORDER BY DATE_CAD DESC
    `;
    
    const fatResult = await executeQuery(fatQuery, [equipmentId]);
    
    let previousFatStatus = null;
    if (fatResult && fatResult.length > 0) {
      const fatId = fatResult[0].ID_EQUIP_FATURAMENTOS;
      previousFatStatus = fatResult[0].ID_STATUS;
      
      // 4. Atualizar ID_STATUS para RETORNADO (10) em EQUIP_FATURAMENTOS
      const updateFatQuery = `
        UPDATE EQUIP_FATURAMENTOS 
        SET ID_STATUS = ?, DATE_UPDATE = CURRENT_TIMESTAMP 
        WHERE ID_EQUIP_FATURAMENTOS = ?
      `;
      
      await executeQuery(updateFatQuery, [statusId || 10, fatId]);
      console.log(`EQUIP_FATURAMENTOS.ID_STATUS atualizado para ${statusId || 10} (ID: ${fatId})`);
    } else {
      console.log('Nenhum registro em EQUIP_FATURAMENTOS encontrado para este equipamento');
    }
    
    res.json({
      success: true,
      patrimonio: patrimonio,
      equipment_id: equipmentId,
      previous_equip_status: previousEquipStatus,
      new_equip_status: 'DISPONIVEL',
      previous_fat_status: previousFatStatus,
      new_fat_status: statusId || 10
    });
    
  } catch (error) {
    console.error('Erro ao liberar equipamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

const PORT = process.env.API_PORT || 3051;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API ERP rodando na porta ${PORT}`);
});
```

### 5. Iniciar o servidor

**Desenvolvimento:**
```bash
node server.js
```

**Produção (PM2):**
```bash
npm install -g pm2
pm2 start server.js --name erp-api
pm2 save
pm2 startup
```

**Windows Service (node-windows):**
```bash
npm install node-windows
```

Criar arquivo `install-service.js`:
```javascript
const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'ERP API Graal',
  description: 'API de integração Firebird para Graal Entregas',
  script: path.join(__dirname, 'server.js'),
  nodeOptions: ['--harmony', '--max_old_space_size=4096']
});

svc.on('install', () => {
  svc.start();
  console.log('Serviço instalado e iniciado!');
});

svc.install();
```

Executar: `node install-service.js`

## Endpoints Disponíveis

### Health Check
```
GET /health
```
Retorna status da API.

---

### Analytics de Pedidos
```
GET /api/orders/analytics?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
Headers: X-API-KEY: sua_chave
```

Retorna lista de pedidos com valores para dashboards de analytics.

**Resposta:**
```json
[
  {
    "id": 12345,
    "orderNumber": "54321",
    "value": 1500.50,
    "date": "2026-02-04T00:00:00.000Z",
    "clientName": "Bar do João",
    "clientId": 789
  }
]
```

**Uso:** Cálculo de valor total de vendas, ticket médio, ranking de clientes por valor.

---

### Buscar Pedido por Número
```
GET /api/orders/:orderNumber
Headers: X-API-KEY: sua_chave
```

Retorna detalhes completos de um pedido específico.

**Resposta:**
```json
{
  "order_number": "12345",
  "client_id": 789,
  "customer_name": "Bar do João",
  "phone": "(11) 99999-9999",
  "pickup_date": "2024-12-20T00:00:00.000Z",
  "delivery_date": "2024-12-15T00:00:00.000Z",
  "observations": "Entregar pela manhã",
  "address": "Rua das Flores, 123, Apto 45",
  "location": "Centro - São Paulo - SP",
  "address_details": {
    "street": "Rua das Flores",
    "number": "123",
    "complement": "Apto 45",
    "neighborhood": "Centro",
    "city": "São Paulo",
    "state": "SP"
  },
  "items": [
    {
      "product": "Chopp Pilsen 30L",
      "quantity": 2,
      "unit_price": 150.00,
      "total": 300.00
    }
  ],
  "equipments": [
    {
      "type": "Chopeira",
      "description": "Chopeira 2 vias Premium",
      "patrimony": "PAT-001234",
      "model": "Premium 2V",
      "quantity": 1
    }
  ]
}
```

---

### Listar Pedidos por Data
```
GET /api/orders?date=YYYY-MM-DD
Headers: X-API-KEY: sua_chave
```

Retorna todos os pedidos marcados para entrega na data especificada.

**Resposta:** Array de objetos com estrutura similar ao endpoint de busca individual, incluindo `client_id`.

---

### Listar Equipamentos Alocados ao Cliente (NOVO v2.6.0)
```
GET /api/clients/:clientId/equipment
Headers: X-API-KEY: sua_chave
```

Retorna todos os equipamentos atualmente alocados (STATUS = 'OCUPADO') ao cliente.

**Parâmetros:**
- `clientId`: ID do cliente no ERP

**Resposta:**
```json
[
  {
    "type": "BARRIL 30L",
    "description": "BARRIL 30L",
    "patrimony": "B1004",
    "model": null,
    "quantity": 1
  },
  {
    "type": "CHOPEIRA 2 VIAS",
    "description": "CHOPEIRA 2 VIAS",
    "patrimony": "CH0045",
    "model": "Premium 2V",
    "quantity": 1
  }
]
```

**Uso:** Exibir todos os equipamentos do cliente durante entrega/recolha para seleção de retorno.

---

### Atualizar Status do Pedido
```
PUT /api/orders/:orderNumber/status
Headers: X-API-KEY: sua_chave
Content-Type: application/json

Body: { "statusId": 5 }
```

Atualiza o status de um pedido no ERP.

**Resposta:**
```json
{
  "success": true,
  "order_number": "12345",
  "previous_status": 3,
  "new_status": 5
}
```

---

### Buscar Dados de Boleto
```
GET /api/orders/:orderNumber/boleto
Headers: X-API-KEY: sua_chave
```

Retorna dados do cliente e condições de pagamento para geração de boleto.

**Resposta:**
```json
{
  "order_id": 12345,
  "order_number": "54321",
  "customer": {
    "name": "Bar do João LTDA",
    "document": "12.345.678/0001-90",
    "document_type": "CNPJ",
    "email": "contato@bardojoao.com.br"
  },
  "payment": {
    "method_id": 2,
    "method_description": "Boleto Bancário",
    "method_type": "BOLETO",
    "terms_id": 5,
    "terms_code": "30;60;90",
    "terms_description": "30/60/90 dias",
    "due_days": [30, 60, 90]
  },
  "total_amount": 1500.50
}
```

---

### Liberar Equipamento (Recolha)
```
PUT /api/equipment/:patrimonio/release
Headers: X-API-KEY: sua_chave
Content-Type: application/json

Body: { "statusId": 10 }
```

Libera um equipamento após recolha, atualizando:
1. `EQUIPAMENTOS.STATUS` → `'DISPONIVEL'`
2. `EQUIP_FATURAMENTOS.ID_STATUS` → `10` (RETORNADO)

**Parâmetros:**
- `patrimonio`: Código do patrimônio do equipamento (ex: "B1004")
- `statusId` (opcional): ID do status na tabela EQUIP_FATURAMENTOS (default: 10 = RETORNADO)

**Resposta:**
```json
{
  "success": true,
  "patrimonio": "B1004",
  "equipment_id": 306,
  "previous_equip_status": "OCUPADO",
  "new_equip_status": "DISPONIVEL",
  "previous_fat_status": 4,
  "new_fat_status": 10
}
```

---

## Configuração no Lovable Cloud

Adicione as seguintes variáveis de ambiente no Supabase (Secrets):

| Secret | Descrição |
|--------|-----------|
| `ERP_API_URL` | URL base da API (ex: `http://192.168.1.100:3051`) |
| `ERP_API_KEY` | Chave de autenticação configurada no `.env` do servidor |

## Versão

**v2.6.0** - Adicionado endpoint `/api/clients/:clientId/equipment` para listar todos os equipamentos alocados ao cliente (com STATUS = 'OCUPADO' e não retornados).
**v2.5.0** - Adicionado endpoint `/api/equipment/:patrimonio/release` para liberar equipamentos na recolha.
**v2.4.0** - Adicionado endpoint `/api/orders/analytics` para dashboards de performance financeira.

## Troubleshooting

### Erro "Pedido não encontrado" no endpoint analytics
**Causa:** Ordem das rotas no Express. Rotas com parâmetros (`:orderNumber`) capturam rotas estáticas (`/analytics`).

**Solução:** A rota `/api/orders/analytics` DEVE estar definida ANTES de `/api/orders/:orderNumber` no arquivo server.js.

### Conexão recusada
- Verificar se o Firebird está rodando
- Verificar firewall para porta 3050 e 3051
- Verificar credenciais no `.env`

### Dados não encontrados
- Verificar se o filtro `DELETED IS NULL OR DELETED = 0` está correto para sua versão do ERP
- Verificar se a coluna `ENTREGAR = 1` existe nos pedidos

### Endpoint de equipamentos do cliente retorna vazio
- Verificar se o cliente possui equipamentos com `STATUS = 'OCUPADO'` na tabela EQUIPAMENTOS
- Verificar se existe registro em EQUIP_FATURAMENTOS com `ID_STATUS` diferente de 10 (RETORNADO)
- Confirmar que os joins EQUIP_FATURAMENTOS → FATURAMENTO → ORDENS_VENDA estão corretos para o cliente
