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
          order_number: string
          pdf_url: string | null
          pix_emv: string | null
          pix_qr_code_url: string | null
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
          order_number: string
          pdf_url?: string | null
          pix_emv?: string | null
          pix_qr_code_url?: string | null
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
          order_number?: string
          pdf_url?: string | null
          pix_emv?: string | null
          pix_qr_code_url?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
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
          foto_local_path: string | null
          foto_url: string | null
          id: string
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
          foto_local_path?: string | null
          foto_url?: string | null
          id?: string
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
          foto_local_path?: string | null
          foto_url?: string | null
          id?: string
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
      settings: {
        Row: {
          dias_exibir_recolhido: number
          id: string
          updated_at: string | null
        }
        Insert: {
          dias_exibir_recolhido?: number
          id?: string
          updated_at?: string | null
        }
        Update: {
          dias_exibir_recolhido?: number
          id?: string
          updated_at?: string | null
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
          foto_local_path: string | null
          foto_url: string | null
          id: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "entregador"
      collection_period:
        | "DIA_TODO"
        | "MANHA"
        | "TARDE"
        | "NOITE"
        | "CLIENTE_IRA_AVISAR"
      equipment_status: "ENTREGUE" | "LIBERADO_PARA_RECOLHA" | "RECOLHIDO"
      hygiene_equipment_type: "chopeira" | "geladeira" | "balcao"
      hygiene_service_type: "limpeza" | "troca"
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
      app_role: ["admin", "entregador"],
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
      sync_status: ["synced", "pending"],
    },
  },
} as const
