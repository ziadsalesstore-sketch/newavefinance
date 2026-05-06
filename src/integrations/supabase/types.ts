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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cash_adjustments: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          note: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      general_received_payments: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      marketing_campaign_items: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          unit_cost: number
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          unit_cost?: number
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          unit_cost?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaign_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          created_at: string
          date: string
          extra_cost: number
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          extra_cost?: number
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          extra_cost?: number
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      opening_balance_items: {
        Row: {
          created_at: string
          id: string
          opening_balance_id: string
          product_id: string
          quantity: number
          unit_cost: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opening_balance_id: string
          product_id: string
          quantity?: number
          unit_cost?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opening_balance_id?: string
          product_id?: string
          quantity?: number
          unit_cost?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opening_balance_items_opening_balance_id_fkey"
            columns: ["opening_balance_id"]
            isOneToOne: false
            referencedRelation: "opening_balances"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_balances: {
        Row: {
          cash_amount: number
          created_at: string
          date: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cash_amount?: number
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cash_amount?: number
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_withdrawals: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          sku: string | null
          starting_qty: number
          starting_unit_cost: number
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          sku?: string | null
          starting_qty?: number
          starting_unit_cost?: number
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          sku?: string | null
          starting_qty?: number
          starting_unit_cost?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      revenue_payments: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          note: string | null
          revenue_payout_id: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          revenue_payout_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          revenue_payout_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_payments_revenue_payout_id_fkey"
            columns: ["revenue_payout_id"]
            isOneToOne: false
            referencedRelation: "revenue_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_payout_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          revenue_payout_id: string
          units_sold: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          revenue_payout_id: string
          units_sold: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          revenue_payout_id?: string
          units_sold?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_payout_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_payout_items_revenue_payout_id_fkey"
            columns: ["revenue_payout_id"]
            isOneToOne: false
            referencedRelation: "revenue_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_payouts: {
        Row: {
          created_at: string
          date: string
          earned_amount: number
          id: string
          notes: string | null
          received_amount: number
          status: string
          units_sold: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          earned_amount?: number
          id?: string
          notes?: string | null
          received_amount?: number
          status?: string
          units_sold?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          earned_amount?: number
          id?: string
          notes?: string | null
          received_amount?: number
          status?: string
          units_sold?: number | null
          user_id?: string
        }
        Relationships: []
      }
      sales_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          sales_record_id: string
          units_sold: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          sales_record_id: string
          units_sold: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          sales_record_id?: string
          units_sold?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_items_sales_record_id_fkey"
            columns: ["sales_record_id"]
            isOneToOne: false
            referencedRelation: "sales_records"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_records: {
        Row: {
          created_at: string
          end_date: string
          id: string
          notes: string | null
          period_type: string
          start_date: string
          units_sold: number
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          period_type?: string
          start_date: string
          units_sold?: number
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          period_type?: string
          start_date?: string
          units_sold?: number
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          sales_tracking_mode: string
          starting_cash: number
          updated_at: string
          user_id: string
        }
        Insert: {
          sales_tracking_mode?: string
          starting_cash?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          sales_tracking_mode?: string
          starting_cash?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_purchase_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          stock_purchase_id: string
          total_cost: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          stock_purchase_id: string
          total_cost: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          stock_purchase_id?: string
          total_cost?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_purchase_items_stock_purchase_id_fkey"
            columns: ["stock_purchase_id"]
            isOneToOne: false
            referencedRelation: "stock_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_purchases: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          product_name: string | null
          quantity: number | null
          total_cost: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          product_name?: string | null
          quantity?: number | null
          total_cost?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          product_name?: string | null
          quantity?: number | null
          total_cost?: number | null
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          source_id: string | null
          source_table: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          source_id?: string | null
          source_table?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          source_id?: string | null
          source_table?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
