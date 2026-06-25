export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      boletos: {
        Row: {
          barcode: string | null
          cora_invoice_id: string
          created_at: string
          created_by_user_id: string | null
          customer_document: string
          customer_email: string | null
          customer_name: string
          digitable_line: string | null
          due_date: string
          id: string
          id_empresa: number
          order_number: string
          pdf_url: string | null
          pix_emv: string | null
          pix_qr_code_url: string | null
          reconciled: boolean
          reconciled_at: string | null
          reconciled_by_user_id: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          cora_invoice_id: string
          created_at?: string
          created_by_user_id?: string | null
          customer_document: string
          customer_email?: string | null
          customer_name: string
          digitable_line?: string | null
          due_date: string
          id?: string
          id_empresa?: number
          order_number: string
          pdf_url?: string | null
          pix_emv?: string | null
          pix_qr_code_url?: string | null
          reconciled?: boolean
          reconciled_at?: string | null
          reconciled_by_user_id?: string | null
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          cora_invoice_id?: string
          created_at?: string
          created_by_user_id?: string | null
          customer_document?: string
          customer_email?: string | null
          customer_name?: string
          digitable_line?: string | null
          due_date?: string
          id?: string
          id_empresa?: number
          order_number?: string
          pdf_url?: string | null
          pix_emv?: string | null
          pix_qr_code_url?: string | null
          reconciled?: boolean
          reconciled_at?: string | null
          reconciled_by_user_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      client_notes: {
        Row: {
          client_name: string
          created_at: string
          created_by: string | null
          follow_up_date: string | null
          id: string
          note: string
          resolved: boolean
          updated_at: string
        }
        Insert: {
          client_name: string
          created_at?: string
          created_by?: string | null
          follow_up_date?: string | null
          id?: string
          note: string
          resolved?: boolean
          updated_at?: string
        }
        Update: {
          client_name?: string
          created_at?: string
          created_by?: string | null
          follow_up_date?: string | null
          id?: string
          note?: string
          resolved?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      clientes_vendedor: {
        Row: {
          cpf_cnpj: string
          created_at: string
          email: string | null
          endereco: string
          id: string
          id_cliente_erp: string | null
          id_empresa: number
          latitude: number | null
          longitude: number | null
          nome: string
          nome_fantasia: string | null
          observacoes: string | null
          origem: Database["public"]["Enums"]["cliente_vendedor_origem"]
          telefone: string | null
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          cpf_cnpj: string
          created_at?: string
          email?: string | null
          endereco: string
          id?: string
          id_cliente_erp?: string | null
          id_empresa?: number
          latitude?: number | null
          longitude?: number | null
          nome: string
          nome_fantasia?: string | null
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["cliente_vendedor_origem"]
          telefone?: string | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          cpf_cnpj?: string
          created_at?: string
          email?: string | null
          endereco?: string
          id?: string
          id_cliente_erp?: string | null
          id_empresa?: number
          latitude?: number | null
          longitude?: number | null
          nome?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["cliente_vendedor_origem"]
          telefone?: string | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          captured_at: string
          created_at: string
          id: string
          latitude: number
          longitude: number
          synced_at: string | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          captured_at: string
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          synced_at?: string | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          captured_at?: string
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          synced_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      empresa_settings: {
        Row: {
          created_at: string
          empresa_id: number
          updated_at: string
          whatsapp_recipient: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: number
          updated_at?: string
          whatsapp_recipient?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: number
          updated_at?: string
          whatsapp_recipient?: string | null
        }
        Relationships: []
      }
      equipment_history: {
        Row: {
          action_type: string
          client_id: string | null
          client_name: string
          created_at: string
          driver_latitude: number | null
          driver_longitude: number | null
          id: string
          notes: string | null
          order_number: string | null
          patrimony: string
          user_id: string
          user_name: string
        }
        Insert: {
          action_type: string
          client_id?: string | null
          client_name: string
          created_at?: string
          driver_latitude?: number | null
          driver_longitude?: number | null
          id?: string
          notes?: string | null
          order_number?: string | null
          patrimony: string
          user_id: string
          user_name: string
        }
        Update: {
          action_type?: string
          client_id?: string | null
          client_name?: string
          created_at?: string
          driver_latitude?: number | null
          driver_longitude?: number | null
          id?: string
          notes?: string | null
          order_number?: string | null
          patrimony?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      equipments: {
        Row: {
          cliente_ira_avisar: boolean
          confirmation_token: string | null
          created_at: string | null
          created_by_user_id: string
          data_entrega: string | null
          data_prevista_recolha: string
          data_real_recolha: string | null
          driver_latitude: number | null
          driver_longitude: number | null
          foto_local_path: string | null
          foto_url: string | null
          id: string
          id_empresa: number
          latitude: number
          longitude: number
          nome_cliente: string
          observacoes: string | null
          pedido_dia: string
          periodo_recolha: Database["public"]["Enums"]["collection_period"]
          status: Database["public"]["Enums"]["equipment_status"]
          sync_status: Database["public"]["Enums"]["sync_status"]
          telefone_cliente: string | null
          token_created_at: string | null
          token_used_at: string | null
          updated_at: string | null
        }
        Insert: {
          cliente_ira_avisar?: boolean
          confirmation_token?: string | null
          created_at?: string | null
          created_by_user_id: string
          data_entrega?: string | null
          data_prevista_recolha: string
          data_real_recolha?: string | null
          driver_latitude?: number | null
          driver_longitude?: number | null
          foto_local_path?: string | null
          foto_url?: string | null
          id?: string
          id_empresa?: number
          latitude: number
          longitude: number
          nome_cliente: string
          observacoes?: string | null
          pedido_dia: string
          periodo_recolha: Database["public"]["Enums"]["collection_period"]
          status?: Database["public"]["Enums"]["equipment_status"]
          sync_status?: Database["public"]["Enums"]["sync_status"]
          telefone_cliente?: string | null
          token_created_at?: string | null
          token_used_at?: string | null
          updated_at?: string | null
        }
        Update: {
          cliente_ira_avisar?: boolean
          confirmation_token?: string | null
          created_at?: string | null
          created_by_user_id?: string
          data_entrega?: string | null
          data_prevista_recolha?: string
          data_real_recolha?: string | null
          driver_latitude?: number | null
          driver_longitude?: number | null
          foto_local_path?: string | null
          foto_url?: string | null
          id?: string
          id_empresa?: number
          latitude?: number
          longitude?: number
          nome_cliente?: string
          observacoes?: string | null
          pedido_dia?: string
          periodo_recolha?: Database["public"]["Enums"]["collection_period"]
          status?: Database["public"]["Enums"]["equipment_status"]
          sync_status?: Database["public"]["Enums"]["sync_status"]
          telefone_cliente?: string | null
          token_created_at?: string | null
          token_used_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      hygiene_clients: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          endereco: string
          id: string
          intervalo_limpeza_dias: number
          latitude: number
          longitude: number
          nome_cliente: string
          observacoes: string | null
          telefone_cliente: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          endereco: string
          id?: string
          intervalo_limpeza_dias?: number
          latitude: number
          longitude: number
          nome_cliente: string
          observacoes?: string | null
          telefone_cliente?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          endereco?: string
          id?: string
          intervalo_limpeza_dias?: number
          latitude?: number
          longitude?: number
          nome_cliente?: string
          observacoes?: string | null
          telefone_cliente?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      hygiene_equipment: {
        Row: {
          ativo: boolean
          client_id: string
          created_at: string | null
          id: string
          modelo_chopeira: string | null
          numero_serie: string
          proxima_limpeza: string | null
          tipo_equipamento: Database["public"]["Enums"]["hygiene_equipment_type"]
          ultima_limpeza: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          client_id: string
          created_at?: string | null
          id?: string
          modelo_chopeira?: string | null
          numero_serie: string
          proxima_limpeza?: string | null
          tipo_equipamento: Database["public"]["Enums"]["hygiene_equipment_type"]
          ultima_limpeza?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          client_id?: string
          created_at?: string | null
          id?: string
          modelo_chopeira?: string | null
          numero_serie?: string
          proxima_limpeza?: string | null
          tipo_equipamento?: Database["public"]["Enums"]["hygiene_equipment_type"]
          ultima_limpeza?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hygiene_equipment_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "hygiene_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      hygiene_services: {
        Row: {
          created_at: string | null
          data_servico: string
          equipment_id: string
          executado_por_user_id: string
          foto_url: string | null
          id: string
          motivo_troca: string | null
          novo_numero_serie: string | null
          observacoes: string | null
          tipo_servico: Database["public"]["Enums"]["hygiene_service_type"]
        }
        Insert: {
          created_at?: string | null
          data_servico?: string
          equipment_id: string
          executado_por_user_id: string
          foto_url?: string | null
          id?: string
          motivo_troca?: string | null
          novo_numero_serie?: string | null
          observacoes?: string | null
          tipo_servico: Database["public"]["Enums"]["hygiene_service_type"]
        }
        Update: {
          created_at?: string | null
          data_servico?: string
          equipment_id?: string
          executado_por_user_id?: string
          foto_url?: string | null
          id?: string
          motivo_troca?: string | null
          novo_numero_serie?: string | null
          observacoes?: string | null
          tipo_servico?: Database["public"]["Enums"]["hygiene_service_type"]
        }
        Relationships: [
          {
            foreignKeyName: "hygiene_services_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "hygiene_equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      label_templates: {
        Row: {
          columns: number
          created_at: string
          created_by_user_id: string
          elements: Json
          gap_horizontal_mm: number
          gap_vertical_mm: number
          height_mm: number
          id: string
          name: string
          type: string
          updated_at: string
          width_mm: number
        }
        Insert: {
          columns?: number
          created_at?: string
          created_by_user_id: string
          elements?: Json
          gap_horizontal_mm?: number
          gap_vertical_mm?: number
          height_mm?: number
          id?: string
          name: string
          type: string
          updated_at?: string
          width_mm?: number
        }
        Update: {
          columns?: number
          created_at?: string
          created_by_user_id?: string
          elements?: Json
          gap_horizontal_mm?: number
          gap_vertical_mm?: number
          height_mm?: number
          id?: string
          name?: string
          type?: string
          updated_at?: string
          width_mm?: number
        }
        Relationships: []
      }
      optimized_routes: {
        Row: {
          color: string
          created_at: string
          created_by_user_id: string
          driver_index: number
          driver_label: string
          end_time: string
          id: string
          period: string
          route_date: string
          start_time: string
          status: string
          total_distance: number
          total_duration: number
          total_volume_liters: number
        }
        Insert: {
          color: string
          created_at?: string
          created_by_user_id: string
          driver_index: number
          driver_label: string
          end_time: string
          id?: string
          period: string
          route_date: string
          start_time: string
          status?: string
          total_distance?: number
          total_duration?: number
          total_volume_liters?: number
        }
        Update: {
          color?: string
          created_at?: string
          created_by_user_id?: string
          driver_index?: number
          driver_label?: string
          end_time?: string
          id?: string
          period?: string
          route_date?: string
          start_time?: string
          status?: string
          total_distance?: number
          total_duration?: number
          total_volume_liters?: number
        }
        Relationships: []
      }
      pedidos_venda: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          cliente_vendedor_id: string | null
          created_at: string
          data_entrega: string
          endereco_entrega: string
          horario_entrega: string | null
          id: string
          id_cliente_erp: string | null
          id_empresa: number
          latitude: number | null
          longitude: number | null
          motivo_recusa: string | null
          nome_cliente: string
          observacoes: string | null
          status: Database["public"]["Enums"]["pedido_venda_status"]
          updated_at: string
          vendedor_id: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cliente_vendedor_id?: string | null
          created_at?: string
          data_entrega: string
          endereco_entrega: string
          horario_entrega?: string | null
          id?: string
          id_cliente_erp?: string | null
          id_empresa?: number
          latitude?: number | null
          longitude?: number | null
          motivo_recusa?: string | null
          nome_cliente: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["pedido_venda_status"]
          updated_at?: string
          vendedor_id: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cliente_vendedor_id?: string | null
          created_at?: string
          data_entrega?: string
          endereco_entrega?: string
          horario_entrega?: string | null
          id?: string
          id_cliente_erp?: string | null
          id_empresa?: number
          latitude?: number | null
          longitude?: number | null
          motivo_recusa?: string | null
          nome_cliente?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["pedido_venda_status"]
          updated_at?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_venda_cliente_vendedor_id_fkey"
            columns: ["cliente_vendedor_id"]
            isOneToOne: false
            referencedRelation: "clientes_vendedor"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_venda_itens: {
        Row: {
          created_at: string
          desconto: number | null
          id: string
          id_produto_erp: string | null
          id_tipo_equipamento_erp: string | null
          observacao: string | null
          pedido_id: string
          preco_unitario: number | null
          produto: string
          quantidade: number
          tipo: string
        }
        Insert: {
          created_at?: string
          desconto?: number | null
          id?: string
          id_produto_erp?: string | null
          id_tipo_equipamento_erp?: string | null
          observacao?: string | null
          pedido_id: string
          preco_unitario?: number | null
          produto: string
          quantidade?: number
          tipo?: string
        }
        Update: {
          created_at?: string
          desconto?: number | null
          id?: string
          id_produto_erp?: string | null
          id_tipo_equipamento_erp?: string | null
          observacao?: string | null
          pedido_id?: string
          preco_unitario?: number | null
          produto?: string
          quantidade?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_venda_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_venda"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          name: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      route_stops: {
        Row: {
          address: string
          arrival_time: string
          client_name: string
          departure_time: string
          distance_from_previous: number
          duration_from_previous: number
          estimated_service_time: number
          expected_delivery: string | null
          id: string
          latitude: number
          longitude: number
          order_number: string
          route_id: string
          status: string
          stop_order: number
          volume_liters: number
        }
        Insert: {
          address: string
          arrival_time: string
          client_name: string
          departure_time: string
          distance_from_previous?: number
          duration_from_previous?: number
          estimated_service_time?: number
          expected_delivery?: string | null
          id?: string
          latitude: number
          longitude: number
          order_number: string
          route_id: string
          status?: string
          stop_order: number
          volume_liters?: number
        }
        Update: {
          address?: string
          arrival_time?: string
          client_name?: string
          departure_time?: string
          distance_from_previous?: number
          duration_from_previous?: number
          estimated_service_time?: number
          expected_delivery?: string | null
          id?: string
          latitude?: number
          longitude?: number
          order_number?: string
          route_id?: string
          status?: string
          stop_order?: number
          volume_liters?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "optimized_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          boleto_desconto_ativo: boolean
          boleto_desconto_tipo: string
          boleto_desconto_valor: number
          boleto_juros_ativo: boolean
          boleto_juros_taxa: number
          boleto_multa_ativo: boolean
          boleto_multa_tipo: string
          boleto_multa_valor: number
          boleto_producao: boolean
          centro_latitude: number | null
          centro_longitude: number | null
          custo_fixo_parada: number
          custo_por_hora: number
          custo_por_km: number
          dias_exibir_recolhido: number
          filtro_geografico_ativo: boolean | null
          id: string
          raio_km: number | null
          updated_at: string | null
        }
        Insert: {
          boleto_desconto_ativo?: boolean
          boleto_desconto_tipo?: string
          boleto_desconto_valor?: number
          boleto_juros_ativo?: boolean
          boleto_juros_taxa?: number
          boleto_multa_ativo?: boolean
          boleto_multa_tipo?: string
          boleto_multa_valor?: number
          boleto_producao?: boolean
          centro_latitude?: number | null
          centro_longitude?: number | null
          custo_fixo_parada?: number
          custo_por_hora?: number
          custo_por_km?: number
          dias_exibir_recolhido?: number
          filtro_geografico_ativo?: boolean | null
          id?: string
          raio_km?: number | null
          updated_at?: string | null
        }
        Update: {
          boleto_desconto_ativo?: boolean
          boleto_desconto_tipo?: string
          boleto_desconto_valor?: number
          boleto_juros_ativo?: boolean
          boleto_juros_taxa?: number
          boleto_multa_ativo?: boolean
          boleto_multa_tipo?: string
          boleto_multa_valor?: number
          boleto_producao?: boolean
          centro_latitude?: number | null
          centro_longitude?: number | null
          custo_fixo_parada?: number
          custo_por_hora?: number
          custo_por_km?: number
          dias_exibir_recolhido?: number
          filtro_geografico_ativo?: boolean | null
          id?: string
          raio_km?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_companies: {
        Row: {
          created_at: string
          empresa_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendedor_clientes_erp: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          id_cliente_erp: string
          nome_cliente: string
          vendedor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          id_cliente_erp: string
          nome_cliente: string
          vendedor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          id_cliente_erp?: string
          nome_cliente?: string
          vendedor_id?: string
        }
        Relationships: []
      }
      visit_attempts: {
        Row: {
          accuracy: number | null
          captured_at: string
          client_name: string
          created_at: string
          id: string
          latitude: number
          longitude: number
          notes: string | null
          order_number: string | null
          reason: string
          synced_at: string | null
          user_id: string
          user_name: string
          visit_type: string
        }
        Insert: {
          accuracy?: number | null
          captured_at: string
          client_name: string
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          notes?: string | null
          order_number?: string | null
          reason: string
          synced_at?: string | null
          user_id: string
          user_name: string
          visit_type?: string
        }
        Update: {
          accuracy?: number | null
          captured_at?: string
          client_name?: string
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          notes?: string | null
          order_number?: string | null
          reason?: string
          synced_at?: string | null
          user_id?: string
          user_name?: string
          visit_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_collection: {
        Args: { _equipment_id: string }
        Returns: {
          cliente_ira_avisar: boolean
          confirmation_token: string | null
          created_at: string | null
          created_by_user_id: string
          data_entrega: string | null
          data_prevista_recolha: string
          data_real_recolha: string | null
          driver_latitude: number | null
          driver_longitude: number | null
          foto_local_path: string | null
          foto_url: string | null
          id: string
          id_empresa: number
          latitude: number
          longitude: number
          nome_cliente: string
          observacoes: string | null
          pedido_dia: string
          periodo_recolha: Database["public"]["Enums"]["collection_period"]
          status: Database["public"]["Enums"]["equipment_status"]
          sync_status: Database["public"]["Enums"]["sync_status"]
          telefone_cliente: string | null
          token_created_at: string | null
          token_used_at: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "equipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_delivered_order_numbers: {
        Args: never
        Returns: {
          pedido_dia: string
        }[]
      }
      get_user_empresas: { Args: { _user_id: string }; Returns: number[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_financeiro: { Args: { _user_id: string }; Returns: boolean }
      user_has_empresa: {
        Args: { _empresa_id: number; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "entregador" | "vendedor" | "financeiro"
      cliente_vendedor_origem: "erp" | "app" | "app_sincronizado"
      collection_period:
        | "DIA_TODO"
        | "MANHA"
        | "TARDE"
        | "NOITE"
        | "CLIENTE_IRA_AVISAR"
      equipment_status: "ENTREGUE" | "LIBERADO_PARA_RECOLHA" | "RECOLHIDO"
      hygiene_equipment_type: "chopeira" | "geladeira" | "balcao"
      hygiene_service_type: "limpeza" | "troca"
      pedido_venda_status:
        | "pendente_aprovacao"
        | "aprovado"
        | "recusado"
        | "cancelado"
        | "entregue"
      sync_status: "synced" | "pending"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "entregador", "vendedor", "financeiro"],
      cliente_vendedor_origem: ["erp", "app", "app_sincronizado"],
      collection_period: [
        "DIA_TODO",
        "MANHA",
        "TARDE",
        "NOITE",
        "CLIENTE_IRA_AVISAR",
      ],
      equipment_status: ["ENTREGUE", "LIBERADO_PARA_RECOLHA", "RECOLHIDO"],
      hygiene_equipment_type: ["chopeira", "geladeira", "balcao"],
      hygiene_service_type: ["limpeza", "troca"],
      pedido_venda_status: [
        "pendente_aprovacao",
        "aprovado",
        "recusado",
        "cancelado",
        "entregue",
      ],
      sync_status: ["synced", "pending"],
    },
  },
} as const
