'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Send,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Bot,
  User,
  Zap,
  TrendingUp,
  Stethoscope,
  Boxes,
  Users,
  ChevronRight,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { formatCurrency, cn } from '@/lib/utils';
import {
  getAiAssistantStatus,
  getAiQuickInsights,
  sendAiChatMessage,
  AiChatMessage,
  AiStatusResponse,
  QuickInsightsData,
} from '@/lib/api/ai-assistant';

const QUICK_PROMPTS = [
  {
    icon: TrendingUp,
    label: 'Doanh thu & Dòng tiền',
    prompt: 'Tóm tắt tổng quan tình hình doanh thu, các khoản thu chi và lợi nhuận ước tính tháng này.',
  },
  {
    icon: Stethoscope,
    label: 'Ca khám & Lịch hẹn',
    prompt: 'Hôm nay phòng khám tiếp nhận bao nhiêu ca khám và lịch hẹn? Tình trạng phòng chờ thế nào?',
  },
  {
    icon: Boxes,
    label: 'Cảnh báo Tồn kho thuốc',
    prompt: 'Những loại thuốc và vật tư y tế nào đang hết hàng hoặc dưới định mức an toàn cần nhập bổ sung?',
  },
  {
    icon: Users,
    label: 'Hiệu suất Bác sĩ & KPI',
    prompt: 'Báo cáo tiến độ hoàn thành chỉ tiêu KPI doanh thu và số ca khám của các bác sĩ trong đợt này.',
  },
  {
    icon: AlertTriangle,
    label: 'Sổ nợ & Công nợ quá hạn',
    prompt: 'Tổng hợp tình hình công nợ chưa thu của bệnh nhân và số lượng hồ sơ còn nợ viện phí.',
  },
];

// Simple, robust Markdown parser component for React 19 without external dependencies
function FormattedMessage({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableKey = 0;

  const flushTable = () => {
    if (inTable && tableRows.length > 0) {
      const header = tableRows[0];
      const rows = tableRows.slice(1);
      elements.push(
        <div key={`table-${tableKey++}`} className="my-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                {header.map((col, idx) => (
                  <th key={idx} className="px-3 py-2 font-semibold">
                    {col.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  const renderInline = (str: string): React.ReactNode => {
    // Bold **text**
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={pIdx} className="font-semibold text-slate-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Table row detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      // Skip separator row like |---|---|
      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        inTable = true;
        return;
      }
      inTable = true;
      tableRows.push(cells);
      return;
    } else if (inTable) {
      flushTable();
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={index} className="text-sm font-bold text-slate-900 dark:text-white mt-3 mb-1.5 flex items-center gap-1.5">
          <ChevronRight className="h-4 w-4 text-blue-600 inline shrink-0" />
          <span>{trimmed.replace(/^###\s+/, '')}</span>
        </h4>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={index} className="text-base font-bold text-slate-900 dark:text-white mt-4 mb-2">
          {trimmed.replace(/^##\s+/, '')}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={index} className="text-lg font-bold text-slate-900 dark:text-white mt-4 mb-2">
          {trimmed.replace(/^#\s+/, '')}
        </h2>
      );
      return;
    }

    // Alert blocks (> [!NOTE] or > [!TIP] or > [!WARNING])
    if (trimmed.startsWith('> [!TIP]') || trimmed.startsWith('> [!NOTE]')) {
      elements.push(
        <div key={index} className="my-2 p-3 bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-500 rounded-r-lg text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{trimmed.replace(/^>\s*\[!(TIP|NOTE)\]\s*/, '')}</span>
        </div>
      );
      return;
    }
    if (trimmed.startsWith('> [!WARNING]') || trimmed.startsWith('> [!ALERT]')) {
      elements.push(
        <div key={index} className="my-2 p-3 bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 rounded-r-lg text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{trimmed.replace(/^>\s*\[!(WARNING|ALERT)\]\s*/, '')}</span>
        </div>
      );
      return;
    }
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={index} className="my-2 pl-3 border-l-2 border-slate-300 dark:border-slate-600 italic text-xs text-slate-600 dark:text-slate-400">
          {renderInline(trimmed.replace(/^>\s*/, ''))}
        </blockquote>
      );
      return;
    }

    // Bullet list items
    if (/^[-*]\s+/.test(trimmed)) {
      elements.push(
        <div key={index} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 my-1 ml-2">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
          <span className="leading-relaxed">{renderInline(trimmed.replace(/^[-*]\s+/, ''))}</span>
        </div>
      );
      return;
    }

    // Numbered lists
    if (/^\d+\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (match) {
        elements.push(
          <div key={index} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 my-1 ml-2">
            <span className="font-semibold text-blue-600 dark:text-blue-400 shrink-0 min-w-[1.2rem]">
              {match[1]}.
            </span>
            <span className="leading-relaxed">{renderInline(match[2])}</span>
          </div>
        );
        return;
      }
    }

    // Empty lines
    if (trimmed === '') {
      elements.push(<div key={index} className="h-2" />);
      return;
    }

    // Normal paragraph
    elements.push(
      <p key={index} className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed my-1">
        {renderInline(trimmed)}
      </p>
    );
  });

  // Flush any open table
  flushTable();

  return <div className="space-y-0.5">{elements}</div>;
}

export function AiReportAssistant() {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<AiStatusResponse | null>(null);
  const [insights, setInsights] = useState<QuickInsightsData | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load status and live insights on mount
  const loadInitialData = useCallback(async () => {
    try {
      const [statusRes, insightsRes] = await Promise.all([
        getAiAssistantStatus(),
        getAiQuickInsights(),
      ]);
      setStatus(statusRes);
      setInsights(insightsRes);

      // Set initial welcome greeting if no messages yet
      setMessages((prev) => {
        if (prev.length > 0) return prev;
        return [
          {
            id: 'welcome-msg',
            role: 'model',
            content:
              '### 🩺 Chào mừng Sếp đến với Trung tâm Báo cáo Điều hành AI!\n\n' +
              'Tôi là Trợ lý AI kết nối trực tiếp với Cơ sở dữ liệu phòng khám QLPK, sử dụng mô hình tối ưu **Google Gemini 2.5 Flash**.\n\n' +
              'Tôi có thể giải đáp ngay tức thì và chính xác 100% mọi số liệu về:\n' +
              '- **Doanh thu, dòng tiền thu chi, công nợ** hôm nay hoặc tháng này.\n' +
              '- **Tình hình tiếp đón, ca khám bệnh và lịch hẹn** tại phòng khám.\n' +
              '- **Kho dược & Cảnh báo thuốc sắp hết hàng** cần nhập khẩn cấp.\n' +
              '- **Hiệu suất & Tiến độ KPI** của từng bác sĩ chuyên khoa.\n\n' +
              '> [!TIP]\n' +
              '> Sếp có thể bấm nhanh vào các câu hỏi gợi ý bên dưới hoặc gõ trực tiếp câu hỏi bằng ngôn ngữ tự nhiên!',
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            model: statusRes.model,
          },
        ];
      });
    } catch (err) {
      console.error('Error initializing AI Assistant:', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Handle send message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isSending) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: AiChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    // Update conversation
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputMessage('');
    setIsSending(true);

    try {
      // Format history for backend
      const historyPayload = newMessages
        .filter((m) => m.id !== 'welcome-msg' && m.id !== userMsgId)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await sendAiChatMessage(text, historyPayload);

      const aiMsg: AiChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'model',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        model: res.model || status?.model || 'gemini-2.5-flash',
        error: !res.success,
      };

      setMessages((curr) => [...curr, aiMsg]);
    } catch {
      setMessages((curr) => [
        ...curr,
        {
          id: `ai-err-${Date.now()}`,
          role: 'model',
          content:
            '### ⚠️ Không thể kết nối với dịch vụ AI\n\n' +
            'Đã xảy ra sự cố trong quá trình giao tiếp với máy chủ. Sếp vui lòng kiểm tra kết nối tới máy chủ `http://127.0.0.1:8000` và cấu hình trong file `be/.env`.',
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          error: true,
        },
      ]);
    } finally {
      setIsSending(false);
      // Auto focus input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyText = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'model',
        content:
          '### 🧹 Đã làm mới phiên hội thoại!\n\n' +
          'Toàn bộ lịch sử trao đổi trước đó đã được xóa sạch. Sếp có thể bắt đầu đặt câu hỏi mới.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="space-y-4">
      {/* Top Visual Snapshot Bar */}
      {insights && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3 bg-gradient-to-br from-blue-50/70 to-blue-100/40 dark:from-blue-950/30 dark:to-slate-900 border-blue-200 dark:border-blue-900/60 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-blue-700 dark:text-blue-300">
                  Thực thu hôm nay
                </p>
                <p className="text-base font-bold text-blue-900 dark:text-blue-100 mt-0.5">
                  {formatCurrency(insights.financial.today.collected_revenue)}
                </p>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[10px] text-blue-600/80 dark:text-blue-400 mt-1">
              {insights.financial.today.invoices_count} hóa đơn phát sinh
            </p>
          </Card>

          <Card className="p-3 bg-gradient-to-br from-emerald-50/70 to-emerald-100/40 dark:from-emerald-950/30 dark:to-slate-900 border-emerald-200 dark:border-emerald-900/60 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  Lượt khám hôm nay
                </p>
                <p className="text-base font-bold text-emerald-900 dark:text-emerald-100 mt-0.5">
                  {insights.clinical.today_visits.total} ca
                </p>
              </div>
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600">
                <Stethoscope className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400 mt-1">
              {insights.clinical.today_visits.waiting} chờ khám · {insights.clinical.today_visits.completed} đã hoàn tất
            </p>
          </Card>

          <Card className="p-3 bg-gradient-to-br from-amber-50/70 to-amber-100/40 dark:from-amber-950/30 dark:to-slate-900 border-amber-200 dark:border-amber-900/60 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  Cảnh báo Kho dược
                </p>
                <p className="text-base font-bold text-amber-900 dark:text-amber-100 mt-0.5">
                  {insights.inventory.low_stock_count + insights.inventory.out_of_stock_count} mục
                </p>
              </div>
              <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600">
                <Boxes className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[10px] text-amber-600/80 dark:text-amber-400 mt-1">
              {insights.inventory.out_of_stock_count} hết hàng · {insights.inventory.low_stock_count} dưới định mức
            </p>
          </Card>

          <Card className="p-3 bg-gradient-to-br from-purple-50/70 to-purple-100/40 dark:from-purple-950/30 dark:to-slate-900 border-purple-200 dark:border-purple-900/60 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-purple-700 dark:text-purple-300">
                  Nhân sự & Bác sĩ
                </p>
                <p className="text-base font-bold text-purple-900 dark:text-purple-100 mt-0.5">
                  {insights.staff_and_kpi.total_active_employees} nhân viên
                </p>
              </div>
              <div className="p-2 bg-purple-500/10 rounded-lg text-purple-600">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[10px] text-purple-600/80 dark:text-purple-400 mt-1">
              Đang hoạt động trong ca trực
            </p>
          </Card>
        </div>
      )}

      {/* Main Chat Assistant Card */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-md flex flex-col h-[700px] overflow-hidden">
        {/* Chat Header */}
        <CardHeader className="py-3.5 px-4 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                  Trợ lý Điều hành AI (Executive AI Assistant)
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-4.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200"
                >
                  <Zap className="h-2.5 w-2.5 mr-0.5 text-blue-500 fill-blue-500" />
                  {status?.model || 'gemini-2.5-flash'}
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                {status?.configured ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    ● Đã kết nối CSDL và Gemini API thành công
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    ● Chưa nạp GEMINI_API_KEY trong be/.env
                  </span>
                )}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={loadInitialData}
              title="Cập nhật số liệu CSDL mới nhất"
              className="h-8 px-2.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Cập nhật số liệu</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              title="Xóa lịch sử chat"
              className="h-8 px-2 text-xs text-slate-500 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>

        {/* Chat Message Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 dark:bg-slate-950/30">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={cn('flex items-start gap-2.5 max-w-[88%]', isUser ? 'ml-auto flex-row-reverse' : 'mr-auto')}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-white shadow-xs',
                    isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white'
                  )}
                >
                  {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                {/* Bubble Content */}
                <div
                  className={cn(
                    'rounded-2xl px-4 py-3 shadow-xs text-xs relative group',
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-xs'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-xs'
                  )}
                >
                  {/* Sender meta */}
                  <div
                    className={cn(
                      'flex items-center justify-between gap-3 text-[10px] mb-1 pb-1 border-b',
                      isUser
                        ? 'border-blue-500/40 text-blue-100'
                        : 'border-slate-100 dark:border-slate-800 text-slate-400'
                    )}
                  >
                    <span className="font-semibold">
                      {isUser ? 'Sếp' : 'Trợ lý AI'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span>{msg.timestamp}</span>
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(msg.id, msg.content)}
                          title="Sao chép câu trả lời"
                          className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-600 p-0.5 rounded"
                        >
                          {copiedId === msg.id ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Message body */}
                  {isUser ? (
                    <p className="whitespace-pre-wrap leading-relaxed text-xs">{msg.content}</p>
                  ) : (
                    <FormattedMessage text={msg.content} />
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isSending && (
            <div className="flex items-start gap-2.5 max-w-[80%] mr-auto">
              <div className="h-7 w-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs">
                <div className="flex items-center space-x-2 text-xs text-slate-500">
                  <div className="flex space-x-1">
                    <span className="h-2 w-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 bg-blue-600 rounded-full animate-bounce" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 ml-1">
                    Trợ lý AI đang truy xuất CSDL và phân tích...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Carousel */}
        <div className="px-4 py-2 bg-slate-50/90 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[11px] font-semibold text-slate-500 shrink-0 mr-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-blue-500" />
              Hỏi nhanh:
            </span>
            {QUICK_PROMPTS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isSending}
                  onClick={() => handleSendMessage(item.prompt)}
                  className="shrink-0 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/40 hover:text-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Icon className="h-3 w-3 text-blue-600 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input Textarea Bar */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                rows={1}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập câu hỏi cho Trợ lý AI (ví dụ: Doanh thu tháng này, số lượng thuốc sắp hết...)..."
                disabled={isSending}
                className="w-full resize-none text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-400"
              />
            </div>
            <Button
              type="submit"
              disabled={isSending || !inputMessage.trim()}
              className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0 flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-semibold">Gửi</span>
            </Button>
          </form>
          <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-slate-400">
            <span>Nhấn Enter để gửi, Shift + Enter để xuống dòng</span>
            <span>Mô hình: {status?.model || 'gemini-2.5-flash'} · Số liệu thực tế CSDL</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
