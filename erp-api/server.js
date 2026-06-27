require('dotenv').config();
const express = require('express');
const Firebird = require('node-firebird');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração do Firebird
// IMPORTANTE: charset deve ser WIN1252 ou ISO8859_1 para compatibilidade com acentos do ERP
const fbOptions = {
  host: process.env.FIREBIRD_HOST || 'localhost',
  port: parseInt(process.env.FIREBIRD_PORT) || 3050,
  database: process.env.FIREBIRD_DATABASE,
  user: process.env.FIREBIRD_USER || 'SYSDBA',
  password: process.env.FIREBIRD_PASSWORD || 'masterkey',
  lowercase_keys: false,
  role: null,
  pageSize: 4096,
  charset: 'WIN1252'  // Charset para suporte a caracteres acentuados (DISPONÍVEL, etc.)
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
    const { start_date, end_date, empresas } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Parâmetros start_date e end_date são obrigatórios (YYYY-MM-DD)' });
    }
    
    const [startYear, startMonth, startDay] = start_date.split('-');
    const [endYear, endMonth, endDay] = end_date.split('-');
    const firebirdStartDate = `${startMonth}/${startDay}/${startYear}`;
    const firebirdEndDate = `${endMonth}/${endDay}/${endYear}`;
    
    // Filtro multi-empresa opcional — aplicado em JS depois da inferência para
    // não excluir clientes com C.ID_EMPRESA = NULL (caso comum no cadastro).
    const empresaIds = empresas
      ? String(empresas).split(',').map(s => parseInt(s.trim())).filter(Boolean)
      : [];

    console.log(`Buscando analytics de ${firebirdStartDate} até ${firebirdEndDate} empresas: ${empresas || 'todas'}`);

    // Tenta query com JOIN em GRUPO_CLIENTE; se falhar (nome de tabela/coluna), faz fallback sem grupo.
    const queryComGrupo = `
      SELECT 
        OV.ID_ORDENS_VENDA,
        OV.N_PEDIDO,
        OV.VALOR_PEDIDO,
        OV.DATA_PREV_ENTREGA,
        P.APELIDO AS NOME_CLIENTE,
        P.NOME AS NOME_COMPLETO,
        C.ID_CLIENTE,
        C.ID_EMPRESA,
        GC.DESCRICAO AS GRUPO_CLIENTE
      FROM ORDENS_VENDA OV
      LEFT JOIN CLIENTES C ON OV.ID_CLIENTE = C.ID_CLIENTE
      LEFT JOIN PESSOAS P ON C.ID_PESSOA = P.ID_PESSOA
      LEFT JOIN GRUPO_CLIENTE GC ON C.ID_GRUPO_CLIENTE = GC.ID_GRUPO_CLIENTE
      WHERE OV.DATA_PREV_ENTREGA BETWEEN ? AND ?
        AND (OV.DELETED IS NULL OR OV.DELETED = 0)
      ORDER BY OV.DATA_PREV_ENTREGA DESC
    `;

    const querySemGrupo = `
      SELECT 
        OV.ID_ORDENS_VENDA,
        OV.N_PEDIDO,
        OV.VALOR_PEDIDO,
        OV.DATA_PREV_ENTREGA,
        P.APELIDO AS NOME_CLIENTE,
        P.NOME AS NOME_COMPLETO,
        C.ID_CLIENTE,
        C.ID_EMPRESA
      FROM ORDENS_VENDA OV
      LEFT JOIN CLIENTES C ON OV.ID_CLIENTE = C.ID_CLIENTE
      LEFT JOIN PESSOAS P ON C.ID_PESSOA = P.ID_PESSOA
      WHERE OV.DATA_PREV_ENTREGA BETWEEN ? AND ?
        AND (OV.DELETED IS NULL OR OV.DELETED = 0)
      ORDER BY OV.DATA_PREV_ENTREGA DESC
    `;

    let result;
    try {
      result = await executeQuery(queryComGrupo, [firebirdStartDate, firebirdEndDate]);
    } catch (e) {
      console.warn('[analytics] JOIN GRUPO_CLIENTE falhou, usando query sem grupo:', e.message);
      result = await executeQuery(querySemGrupo, [firebirdStartDate, firebirdEndDate]);
    }

    // Infere empresa quando CLIENTES.ID_EMPRESA está NULL no cadastro:
    // usa o nome do grupo (...GROTT... => 3) como fallback, senão empresa 1.
    const inferEmpresa = (row) => {
      const direct = Number(row.ID_EMPRESA);
      if (Number.isFinite(direct) && [1, 3].includes(direct)) return direct;
      const grupo = String(row.GRUPO_CLIENTE || '').toUpperCase();
      if (grupo.includes('GROTT')) return 3;
      return 1;
    };

    if (Array.isArray(result) && empresaIds.length > 0) {
      result = result.filter(row => empresaIds.includes(inferEmpresa(row)));
    }
    
    if (!result || result.length === 0) {
      return res.json([]);
    }
    
    const orders = result.map(row => ({
      id: row.ID_ORDENS_VENDA,
      orderNumber: row.N_PEDIDO?.toString() || '',
      value: row.VALOR_PEDIDO || 0,
      date: row.DATA_PREV_ENTREGA || null,
      clientName: row.NOME_CLIENTE || row.NOME_COMPLETO || '',
      clientId: row.ID_CLIENTE,
      grupoCliente: row.GRUPO_CLIENTE || null,
      id_empresa: inferEmpresa(row),
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
    const empresasParam = req.query.empresas; // ex: "1,3"
    
    if (!dateParam) {
      return res.status(400).json({ error: 'Parâmetro date é obrigatório (YYYY-MM-DD)' });
    }
    
    // Converter data para formato Firebird
    const [year, month, day] = dateParam.split('-');
    const firebirdDate = `${month}/${day}/${year}`;
    
    // Filtro multi-empresa opcional
    let empresaWhere = '';
    const empresaParams = [];
    if (empresasParam) {
      const ids = String(empresasParam).split(',').map(s => parseInt(s.trim())).filter(Boolean);
      if (ids.length > 0) {
        empresaWhere = ` AND (cl.ID_EMPRESA IS NULL OR cl.ID_EMPRESA IN (${ids.map(() => '?').join(',')}))`;
        empresaParams.push(...ids);
      }
    }
    
    console.log(`Buscando pedidos para data: ${firebirdDate} empresas: ${empresasParam || 'todas'}`);
    
    // Query para buscar pedidos do dia marcados para entrega
    const ordersQuery = `
      SELECT 
        ov.N_PEDIDO,
        ov.ID_ORDENS_VENDA,
        ov.ID_CLIENTE,
        cl.ID_EMPRESA,
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
        AND (ov.DELETED IS NULL OR ov.DELETED = 0)${empresaWhere}
      ORDER BY ov.N_PEDIDO DESC
    `;
    
    const orders = await executeQuery(ordersQuery, [firebirdDate, ...empresaParams]);

    
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
        id_empresa: order.ID_EMPRESA || null,

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
// Retorna todos os equipamentos com STATUS = 'ALOCADO'
// que estão vinculados ao cliente via faturamento
// ==========================================
app.get('/api/clients/:clientId/equipment', authenticate, async (req, res) => {
  try {
    const clientId = req.params.clientId;
    
    if (!clientId) {
      return res.status(400).json({ error: 'clientId é obrigatório' });
    }
    
    console.log(`Buscando equipamentos alocados ao cliente: ${clientId}`);
    
    // Busca todos os equipamentos ALOCADOS vinculados ao cliente
    // via EQUIP_FATURAMENTOS → FATURAMENTO (que tem ID_CLIENTE diretamente!)
    // Exclui equipamentos já retornados (ID_STATUS = 10)
    // IMPORTANTE: FATURAMENTO.ID_CLIENTE é o link direto - não precisa passar por ORDENS_VENDA
    // IMPORTANTE: O ERP usa 'ALOCADO' (não 'OCUPADO') para equipamentos alocados
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
        AND e.STATUS = 'ALOCADO'
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
// CONSULTAR EQUIPAMENTO POR PATRIMÔNIO
// Retorna status e dados do equipamento
// ==========================================
app.get('/api/equipment/:patrimonio', authenticate, async (req, res) => {
  try {
    const patrimonio = req.params.patrimonio;
    
    if (!patrimonio) {
      return res.status(400).json({ error: 'patrimônio é obrigatório' });
    }
    
    console.log(`Consultando equipamento: ${patrimonio}`);
    
    const query = `
      SELECT 
        e.ID_EQUIPAMENTO,
        e.PATRIMONIO,
        e.STATUS,
        e.MODELO,
        e.DESCRICAO,
        te.DESCRICAO AS TIPO
      FROM EQUIPAMENTOS e
      LEFT JOIN TIPO_EQUIPAMENTO te ON te.ID_TIPO_EQUIPAMENTO = e.ID_TIPO_EQUIPAMENTO
      WHERE e.PATRIMONIO = ?
        AND (e.DELETED IS NULL OR e.DELETED = 0)
    `;
    
    const result = await executeQuery(query, [patrimonio]);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }
    
    const eq = result[0];
    
    // Verificar se está alocado (elegível para retorno)
    const isAllocated = eq.STATUS === 'ALOCADO' || eq.STATUS === 'OCUPADO';
    
    res.json({
      equipment_id: eq.ID_EQUIPAMENTO,
      patrimony: eq.PATRIMONIO?.trim() || patrimonio,
      status: eq.STATUS?.trim() || null,
      model: eq.MODELO?.trim() || null,
      description: eq.DESCRICAO?.trim() || null,
      type: eq.TIPO?.trim() || null,
      is_allocated: isAllocated,
      can_return: isAllocated
    });
    
  } catch (error) {
    console.error('Erro ao consultar equipamento:', error);
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
        ov.VALOR_PEDIDO AS TOTAL_AMOUNT,
        cl.ID_EMPRESA AS ID_EMPRESA
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
      total_amount: order.TOTAL_AMOUNT,
      id_empresa: order.ID_EMPRESA || null
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
    
    // 2. Atualizar status na tabela EQUIPAMENTOS para DISPONÍVEL
    // IMPORTANTE: Usar 'DISPONÍVEL' com acento para manter consistência com o ERP
    // O charset da conexão (WIN1252 ou ISO8859_1) deve estar configurado corretamente
    const updateEquipQuery = `
      UPDATE EQUIPAMENTOS 
      SET STATUS = 'DISPONÍVEL', DATE_UPDATE = CURRENT_TIMESTAMP 
      WHERE ID_EQUIPAMENTO = ?
    `;
    
    await executeQuery(updateEquipQuery, [equipmentId]);
    console.log(`EQUIPAMENTOS.STATUS atualizado para DISPONÍVEL (ID: ${equipmentId})`);
    
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
      new_equip_status: 'DISPONÍVEL',
      previous_fat_status: previousFatStatus,
      new_fat_status: statusId || 10
    });
    
  } catch (error) {
    console.error('Erro ao liberar equipamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// ==========================================
// LISTAR VENDEDORES (COLABORADORES)
// Vínculo: COLABORADORES.ID_PESSOA -> PESSOAS.NOME
// ==========================================
app.get('/api/vendedores', authenticate, async (req, res) => {
  try {
    const query = `
      SELECT
        col.ID_COLABORADORES,
        p.NOME,
        p.APELIDO
      FROM COLABORADORES col
      JOIN PESSOAS p ON col.ID_PESSOA = p.ID_PESSOA
      WHERE (col.DELETED IS NULL OR col.DELETED = 0)
      ORDER BY p.NOME
    `;
    const rows = await executeQuery(query);
    res.json((rows || []).map(r => ({
      id: r.ID_COLABORADORES,
      name: r.NOME || r.APELIDO || '',
      nickname: r.APELIDO || ''
    })));
  } catch (error) {
    console.error('Erro ao listar vendedores:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// ==========================================
// LISTAR CLIENTES (opcionalmente filtrados por vendedor)
// Query params:
//   - vendedor_id (opcional): ID_COLABORADORES do vendedor
//   - search (opcional): trecho do nome / apelido / documento
//   - limit (opcional, default 500)
// ==========================================
app.get('/api/clients', authenticate, async (req, res) => {
  try {
    const { vendedor_id, client_id, search, limit, empresas } = req.query;
    const max = Math.min(parseInt(limit) || 500, 2000);

    const where = ['(cl.DELETED IS NULL OR cl.DELETED = 0)'];
    const params = [];

    if (client_id) {
      where.push('cl.ID_CLIENTE = ?');
      params.push(parseInt(client_id));
    }
    if (vendedor_id) {
      where.push('cl.ID_VENDEDOR = ?');
      params.push(parseInt(vendedor_id));
    }
    if (search) {
      where.push('(UPPER(p.NOME) LIKE ? OR UPPER(p.APELIDO) LIKE ? OR p.CPF_CNPJ LIKE ?)');
      const term = `%${String(search).toUpperCase()}%`;
      params.push(term, term, `%${search}%`);
    }
    // Filtro multi-empresa: ?empresas=1,3
    // Importante: inclui clientes com ID_EMPRESA NULL (cadastro incompleto no ERP);
    // a empresa final é inferida pela edge function/JS a partir do grupo/produtos.
    if (empresas) {
      const ids = String(empresas).split(',').map(s => parseInt(s.trim())).filter(Boolean);
      if (ids.length > 0) {
        where.push(`(cl.ID_EMPRESA IS NULL OR cl.ID_EMPRESA IN (${ids.map(() => '?').join(',')}))`);
        params.push(...ids);
      }
    }

    const query = `
      SELECT FIRST ${max}
        cl.ID_CLIENTE,
        cl.ID_VENDEDOR,
        cl.ID_EMPRESA,
        p.ID_PESSOA,
        p.NOME,
        p.APELIDO,
        p.CPF_CNPJ,
        pv.NOME AS VENDEDOR_NOME,
        r.NOME AS RUA,
        ov_addr.NUMERO,
        ov_addr.COMPLEMENTO,
        b.NOME AS BAIRRO,
        ci.NOME AS CIDADE,
        e.SIGLA AS UF
      FROM CLIENTES cl
      JOIN PESSOAS p ON cl.ID_PESSOA = p.ID_PESSOA
      LEFT JOIN COLABORADORES col ON cl.ID_VENDEDOR = col.ID_COLABORADORES
      LEFT JOIN PESSOAS pv ON col.ID_PESSOA = pv.ID_PESSOA
      LEFT JOIN ORDENS_VENDA ov_addr ON ov_addr.ID_ORDENS_VENDA = (
        SELECT FIRST 1 ov2.ID_ORDENS_VENDA
        FROM ORDENS_VENDA ov2
        WHERE ov2.ID_CLIENTE = cl.ID_CLIENTE
          AND (ov2.DELETED IS NULL OR ov2.DELETED = 0)
          AND ov2.ID_RUA IS NOT NULL
        ORDER BY ov2.DATE_CAD DESC
      )
      LEFT JOIN ESTADO e ON ov_addr.ID_ESTADO = e.ID_ESTADO
      LEFT JOIN CIDADE ci ON ov_addr.ID_CIDADE = ci.ID_CIDADE
      LEFT JOIN BAIRRO b ON ov_addr.ID_BAIRRO = b.ID_BAIRRO
      LEFT JOIN RUA r ON ov_addr.ID_RUA = r.ID_RUA
      WHERE ${where.join(' AND ')}
      ORDER BY p.NOME
    `;

    const rows = await executeQuery(query, params);
    res.json((rows || []).map(r => ({
      id: r.ID_CLIENTE,
      name: r.NOME || '',
      nickname: r.APELIDO || '',
      document: r.CPF_CNPJ || '',
      address: r.RUA || '',
      street: r.RUA || '',
      number: r.NUMERO || '',
      complement: r.COMPLEMENTO || '',
      neighborhood: r.BAIRRO || '',
      city: r.CIDADE || '',
      state: r.UF || '',
      vendedor_id: r.ID_VENDEDOR || null,
      vendedor_name: r.VENDEDOR_NOME || null,
      id_empresa: r.ID_EMPRESA || null,
    })));
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// ==========================================
// LISTAR PRODUTOS
// ==========================================
app.get('/api/products', authenticate, async (req, res) => {
  try {
    const { search, limit } = req.query;
    const max = Math.min(parseInt(limit) || 1000, 5000);

    const where = ['(pr.DELETED IS NULL OR pr.DELETED = 0)'];
    const params = [];
    if (search) {
      where.push('UPPER(pr.DESCRICAO) LIKE ?');
      params.push(`%${String(search).toUpperCase()}%`);
    }

    const query = `
      SELECT FIRST ${max}
        pr.ID_PRODUTOS,
        pr.DESCRICAO
      FROM PRODUTOS pr
      WHERE ${where.join(' AND ')}
      ORDER BY pr.DESCRICAO
    `;
    const rows = await executeQuery(query, params);
    res.json((rows || []).map(r => ({
      id: r.ID_PRODUTOS,
      description: r.DESCRICAO || ''
    })));
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// ==========================================
// LISTAR TIPOS DE EQUIPAMENTO
// ==========================================
app.get('/api/equipment-types', authenticate, async (req, res) => {
  try {
    const query = `
      SELECT
        te.ID_TIPO_EQUIPAMENTO,
        te.DESCRICAO
      FROM TIPO_EQUIPAMENTO te
      WHERE (te.DELETED IS NULL OR te.DELETED = 0)
      ORDER BY te.DESCRICAO
    `;
    const rows = await executeQuery(query);
    res.json((rows || []).map(r => ({
      id: r.ID_TIPO_EQUIPAMENTO,
      description: r.DESCRICAO || ''
    })));
  } catch (error) {
    console.error('Erro ao listar tipos de equipamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// ==========================================
// ÚLTIMO PEDIDO DE UM CLIENTE (para "repetir pedido")
// ==========================================
app.get('/api/clients/:clientId/last-order', authenticate, async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (!clientId) return res.status(400).json({ error: 'clientId inválido' });

    const headerQuery = `
      SELECT FIRST 1
        ov.N_PEDIDO, ov.ID_ORDENS_VENDA, ov.DATA_PREV_ENTREGA
      FROM ORDENS_VENDA ov
      WHERE ov.ID_CLIENTE = ?
        AND (ov.DELETED IS NULL OR ov.DELETED = 0)
      ORDER BY ov.DATE_CAD DESC
    `;
    const headers = await executeQuery(headerQuery, [clientId]);
    if (!headers || headers.length === 0) return res.json(null);
    const order = headers[0];
    const orderId = order.ID_ORDENS_VENDA;

    const itemsQuery = `
      SELECT pr.DESCRICAO AS PRODUTO, iov.QTDE_PEDIDA AS QUANTIDADE
      FROM ITENS_ORDENS_VENDA iov
      JOIN PRODUTOS pr ON iov.ID_PRODUTO = pr.ID_PRODUTOS
      WHERE iov.ID_ORDENS_VENDA = ?
        AND (iov.DELETED IS NULL OR iov.DELETED = 0)
    `;
    const items = await executeQuery(itemsQuery, [orderId]);

    const equipQuery = `
      SELECT te.DESCRICAO AS TIPO, eov.QTDE AS QUANTIDADE
      FROM EQUIP_ORDENS_VENDA eov
      JOIN TIPO_EQUIPAMENTO te ON eov.ID_TIPO_EQUIPAMENTO = te.ID_TIPO_EQUIPAMENTO
      WHERE eov.ID_ORDENS_VENDA = ?
        AND (eov.DELETED IS NULL OR eov.DELETED = 0)
    `;
    const equipments = await executeQuery(equipQuery, [orderId]);

    res.json({
      order_number: order.N_PEDIDO?.toString() || '',
      delivery_date: order.DATA_PREV_ENTREGA || null,
      items: (items || []).map(i => ({ product: i.PRODUTO || '', quantity: i.QUANTIDADE || 0 })),
      equipments: (equipments || []).map(e => ({ type: e.TIPO || '', quantity: e.QUANTIDADE || 0 })),
    });
  } catch (error) {
    console.error('Erro ao buscar último pedido do cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// ==========================================
// LISTAR TODAS AS ALOCAÇÕES ATIVAS
// Retorna todos os equipamentos atualmente ALOCADOS,
// com cliente e data prevista de entrega (data de saída)
// ==========================================
app.get('/api/allocations', authenticate, async (req, res) => {
  try {
    const { empresas } = req.query;
    const where = [
      "e.STATUS = 'ALOCADO'",
      '(ef.ID_STATUS IS NULL OR ef.ID_STATUS <> 10)',
      '(e.DELETED IS NULL OR e.DELETED = 0)',
      '(ef.DELETED IS NULL OR ef.DELETED = 0)',
      '(f.DELETED IS NULL OR f.DELETED = 0)',
    ];
    const params = [];
    if (empresas) {
      const ids = String(empresas).split(',').map(s => parseInt(s.trim())).filter(Boolean);
      if (ids.length > 0) {
        where.push(`cl.ID_EMPRESA IN (${ids.map(() => '?').join(',')})`);
        params.push(...ids);
      }
    }

    const query = `
      SELECT
        cl.ID_CLIENTE,
        cl.ID_EMPRESA,
        p.NOME AS CLIENTE_NOME,
        p.APELIDO AS CLIENTE_APELIDO,
        e.PATRIMONIO,
        e.MODELO,
        te.DESCRICAO AS TIPO,
        ov.N_PEDIDO,
        ov.DATA_PREV_ENTREGA
      FROM EQUIPAMENTOS e
      INNER JOIN EQUIP_FATURAMENTOS ef ON ef.ID_EQUIPAMENTO = e.ID_EQUIPAMENTO
      INNER JOIN FATURAMENTO f         ON f.ID_FATURAMENTO  = ef.ID_FATURAMENTO
      LEFT  JOIN ORDENS_VENDA ov       ON ov.ID_ORDENS_VENDA = f.ID_ORDENS_VENDA
      INNER JOIN CLIENTES cl           ON cl.ID_CLIENTE = f.ID_CLIENTE
      INNER JOIN PESSOAS p             ON p.ID_PESSOA = cl.ID_PESSOA
      LEFT  JOIN TIPO_EQUIPAMENTO te   ON te.ID_TIPO_EQUIPAMENTO = e.ID_TIPO_EQUIPAMENTO
      WHERE ${where.join(' AND ')}
      ORDER BY p.NOME, te.DESCRICAO, e.PATRIMONIO
    `;

    const rows = await executeQuery(query, params);
    res.json((rows || []).map(r => ({
      client_id: r.ID_CLIENTE,
      client_name: (r.CLIENTE_APELIDO || r.CLIENTE_NOME || '').trim(),
      client_full_name: (r.CLIENTE_NOME || '').trim(),
      patrimony: r.PATRIMONIO?.trim() || null,
      model: r.MODELO?.trim() || null,
      type: r.TIPO?.trim() || 'Equipamento',
      order_number: r.N_PEDIDO?.toString() || null,
      delivery_date: r.DATA_PREV_ENTREGA || null,
      id_empresa: r.ID_EMPRESA || null,
    })));
  } catch (error) {
    console.error('Erro ao listar alocações:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});


// ==========================================
// PREÇO DE UM PRODUTO PARA UM CLIENTE
// Busca PRECO específico do cliente; fallback para tabela geral (sem cliente/grupo).
// GET /api/products/:productId/price?clientId=123
// ==========================================
app.get('/api/products/:productId/price', authenticate, async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const clientId = req.query.clientId ? parseInt(req.query.clientId) : null;
    if (!productId) return res.status(400).json({ error: 'productId inválido' });

    let row = null;

    if (clientId) {
      const specific = await executeQuery(
        `SELECT FIRST 1 VALOR FROM PRECO
         WHERE ID_PRODUTO = ? AND ID_CLIENTE = ?
           AND (DELETED IS NULL OR DELETED = 0)
         ORDER BY DATE_UPDATE DESC`,
        [productId, clientId]
      );
      if (specific && specific.length) row = { valor: specific[0].VALOR, fonte: 'cliente' };
    }

    if (!row) {
      const fallback = await executeQuery(
        `SELECT FIRST 1 VALOR FROM PRECO
         WHERE ID_PRODUTO = ?
           AND ID_CLIENTE IS NULL
           AND ID_GRUPO_CLIENTE IS NULL
           AND (DELETED IS NULL OR DELETED = 0)
         ORDER BY DATE_UPDATE DESC`,
        [productId]
      );
      if (fallback && fallback.length) row = { valor: fallback[0].VALOR, fonte: 'tabela' };
    }

    if (!row) return res.json({ valor: null, fonte: null });
    res.json({ valor: Number(row.valor) || 0, fonte: row.fonte });
  } catch (error) {
    console.error('Erro ao buscar preço do produto:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});


const PORT = process.env.API_PORT || 3051;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API ERP rodando na porta ${PORT}`);
});
