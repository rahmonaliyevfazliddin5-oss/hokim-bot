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
      activity_logs: {
        Row: {
          action: string
          actor: string | null
          complaint_id: string | null
          created_at: string
          details: string | null
          id: string
        }
        Insert: {
          action: string
          actor?: string | null
          complaint_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor?: string | null
          complaint_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_alerts: {
        Row: {
          count: number
          created_at: string
          details: string | null
          id: string
          ip: string | null
          kind: string
          mahalla: string | null
          seen_at: string | null
          window_minutes: number
        }
        Insert: {
          count?: number
          created_at?: string
          details?: string | null
          id?: string
          ip?: string | null
          kind: string
          mahalla?: string | null
          seen_at?: string | null
          window_minutes?: number
        }
        Update: {
          count?: number
          created_at?: string
          details?: string | null
          id?: string
          ip?: string | null
          kind?: string
          mahalla?: string | null
          seen_at?: string | null
          window_minutes?: number
        }
        Relationships: []
      }
      complaints: {
        Row: {
          admin_notes: string | null
          ai_confidence: number | null
          ai_response: string | null
          categories: string[]
          category: string
          category_details: Json
          citizen_name: string
          citizen_phone: string
          created_at: string
          district: string | null
          id: string
          image_url: string | null
          image_urls: string[]
          latitude: number | null
          location: string | null
          longitude: number | null
          mahalla: string | null
          map_link: string | null
          region: string | null
          status: string
          text: string
          tracking_code: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          ai_confidence?: number | null
          ai_response?: string | null
          categories?: string[]
          category?: string
          category_details?: Json
          citizen_name: string
          citizen_phone: string
          created_at?: string
          district?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[]
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          mahalla?: string | null
          map_link?: string | null
          region?: string | null
          status?: string
          text: string
          tracking_code: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          ai_confidence?: number | null
          ai_response?: string | null
          categories?: string[]
          category?: string
          category_details?: Json
          citizen_name?: string
          citizen_phone?: string
          created_at?: string
          district?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[]
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          mahalla?: string | null
          map_link?: string | null
          region?: string | null
          status?: string
          text?: string
          tracking_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      mahalla_credentials: {
        Row: {
          mahalla: string
          password_hash: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          mahalla: string
          password_hash: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          mahalla?: string
          password_hash?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      mahalla_login_attempts: {
        Row: {
          attempted_at: string
          id: string
          ip: string | null
          mahalla: string | null
          success: boolean
        }
        Insert: {
          attempted_at?: string
          id?: string
          ip?: string | null
          mahalla?: string | null
          success: boolean
        }
        Update: {
          attempted_at?: string
          id?: string
          ip?: string | null
          mahalla?: string | null
          success?: boolean
        }
        Relationships: []
      }
      mahalla_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip: string | null
          mahalla: string
          refresh_hash: string
          revoked_at: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          ip?: string | null
          mahalla: string
          refresh_hash: string
          revoked_at?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip?: string | null
          mahalla?: string
          refresh_hash?: string
          revoked_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      mahalla_slug: { Args: { _name: string }; Returns: string }
      set_mahalla_password: {
        Args: { _actor?: string; _mahalla: string; _password: string }
        Returns: undefined
      }
      verify_mahalla_password: {
        Args: { _mahalla: string; _password: string }
        Returns: boolean
      }
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
