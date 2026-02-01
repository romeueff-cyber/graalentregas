# Roadmap de Melhorias - Graal Entregas

## 🎯 Ideias Salvas

---

### 🔍 **Busca e Filtros Avançados**
- [ ] Busca global unificada (clientes, equipamentos, pedidos em um só lugar)
- [ ] Filtros salvos/favoritos para consultas frequentes
- [ ] Histórico de buscas recentes

### 📸 **Gestão de Mídia**
- [ ] Galeria de fotos por cliente/equipamento
- [ ] Comparativo visual antes/depois da higienização
- [ ] Captura de fotos com marca d'água automática (data/hora/localização)

### 📅 **Agenda e Calendário**
- [ ] Visualização em calendário das entregas e higienizações
- [ ] Agendamento drag-and-drop
- [ ] Sincronização com Google Calendar

### 🔔 **Central de Notificações**
- [ ] Painel de notificações in-app com histórico
- [ ] Configurações personalizadas por usuário (o que quer receber)
- [ ] Resumo diário automático por email

### 📱 **QR Code Avançado**
- [ ] QR Code único por equipamento para rastreamento
- [ ] Cliente escaneia para ver status em tempo real
- [ ] Check-in/check-out automático por QR

### 💬 **Feedback do Cliente**
- [ ] Avaliação de satisfação pós-serviço
- [ ] Comentários e sugestões dos clientes
- [ ] NPS (Net Promoter Score) automático

### 🌙 **Modo Escuro**
- [ ] Tema dark para uso noturno
- [ ] Alternância automática por horário

---

### 📊 **Analytics & Relatórios** (do roadmap anterior)
- [ ] Dashboards de gestão para performance de entregas
- [ ] Ciclos de higienização
- [ ] Exportação de relatórios PDF/Excel

### ⚙️ **Operações**
- [ ] Otimização de rotas para motoristas
- [ ] Captura de assinatura digital
- [ ] Controle de inventário/estoque de equipamentos

### 🤖 **Automação**
- [ ] Assistente IA para motoristas (procedimentos)
- [ ] Consultas em linguagem natural para gestores
- [ ] Notificações automáticas WhatsApp/Push para alertas de manutenção

### 🔐 **Segurança**
- [ ] Logs de auditoria de atividades
- [ ] Controles de acesso baseados em permissões

### 🛡️ **Estabilidade**
- [ ] Restauração de login offline com cache de sessão localforage
- [ ] Tratamento de ERP offline com fallback gracioso

---

## ✅ Implementado

- [x] Correção da data de recolha no balão do mapa (timezone)
- [x] Auto-transição de status ENTREGUE → LIBERADO_PARA_RECOLHA ao carregar equipamentos
