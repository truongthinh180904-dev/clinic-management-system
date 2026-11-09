import { request } from './client';

export interface AiChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  model?: string;
  error?: boolean;
}

export interface AiStatusResponse {
  configured: boolean;
  model: string;
  provider: string;
  version: string;
}

export interface QuickInsightsData {
  report_timestamp: string;
  current_date: string;
  current_time: string;
  financial: {
    today: {
      collected_revenue: number;
      invoices_count: number;
      approved_expenses: number;
      net_today: number;
    };
    this_month: {
      invoiced_revenue: number;
      collected_revenue: number;
      invoices_count: number;
      unpaid_debt_this_month: number;
      approved_expenses: number;
      estimated_net_profit: number;
      payment_methods: {
        cash: number;
        bank_transfer: number;
      };
    };
    outstanding_debt: {
      total_amount: number;
      debtors_count: number;
    };
  };
  clinical: {
    total_patients: number;
    new_patients_this_month: number;
    today_visits: {
      total: number;
      waiting: number;
      in_progress: number;
      completed: number;
      cancelled: number;
    };
    today_appointments: {
      total: number;
      confirmed: number;
      pending: number;
      completed: number;
    };
  };
  inventory: {
    total_products: number;
    out_of_stock_count: number;
    low_stock_count: number;
    items_needing_restock: Array<{
      code: string;
      name: string;
      unit: string;
      current_stock: number;
      minimum_stock: number;
      status: string;
    }>;
  };
  staff_and_kpi: {
    total_active_employees: number;
    departments: Record<string, number>;
    doctor_kpis: Array<{
      doctor_name: string;
      department: string;
      target_revenue: number;
      actual_revenue: number;
      revenue_rate_pct: number;
      target_visits: number;
      actual_visits: number;
      visits_rate_pct: number;
      assessment: string;
    }>;
  };
}

export interface AiChatResponse {
  success: boolean;
  reply: string;
  model: string;
  error?: string;
}

/**
 * Fetch AI Assistant status and active model.
 */
export async function getAiAssistantStatus(): Promise<AiStatusResponse> {
  try {
    const res = await request<AiStatusResponse>('/ai/reports/status', {
      method: 'GET',
    });
    // Check res.data or direct fields
    const direct = res as unknown as { configured?: boolean; model?: string; provider?: string; version?: string };
    if (res.data && typeof res.data.configured === 'boolean') {
      return res.data;
    }
    if (direct && typeof direct.configured === 'boolean') {
      return {
        configured: direct.configured,
        model: direct.model || 'gemini-2.5-flash',
        provider: direct.provider || 'Google Gemini AI',
        version: direct.version || '2.5 Flash',
      };
    }
    return {
      configured: false,
      model: 'gemini-2.5-flash',
      provider: 'Google Gemini AI',
      version: '2.5 Flash',
    };
  } catch {
    return {
      configured: false,
      model: 'gemini-2.5-flash',
      provider: 'Google Gemini AI',
      version: '2.5 Flash',
    };
  }
}

/**
 * Fetch live clinic snapshot for quick visual cards.
 */
export async function getAiQuickInsights(): Promise<QuickInsightsData | null> {
  try {
    const res = await request<QuickInsightsData>('/ai/reports/quick-insights', {
      method: 'GET',
    });
    return res.data || null;
  } catch {
    return null;
  }
}

/**
 * Send chat query to Gemini AI Assistant with conversation history.
 */
export async function sendAiChatMessage(
  message: string,
  history: Array<{ role: string; content: string }> = []
): Promise<AiChatResponse> {
  try {
    const res = await request<AiChatResponse>('/ai/reports/chat', {
      method: 'POST',
      body: {
        message,
        history,
      },
    });

    // Check res.data first
    if (res.data && typeof res.data.reply === 'string' && res.data.reply) {
      return res.data;
    }

    // Check if reply is directly on response
    const direct = res as unknown as { reply?: string; model?: string; success?: boolean; error?: string };
    if (direct && typeof direct.reply === 'string' && direct.reply) {
      return {
        success: direct.success !== false,
        reply: direct.reply,
        model: direct.model || 'gemini-2.5-flash',
        error: direct.error,
      };
    }

    return {
      success: false,
      reply: res.message || 'Không thể nhận phản hồi từ máy chủ.',
      model: 'gemini-2.5-flash',
      error: 'UNKNOWN_ERROR',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Lỗi kết nối tới máy chủ backend.';
    return {
      success: false,
      reply: `### ⚠️ Không thể kết nối với máy chủ Backend\n\nChi tiết: ${errorMsg}`,
      model: 'gemini-2.5-flash',
      error: 'NETWORK_ERROR',
    };
  }
}
