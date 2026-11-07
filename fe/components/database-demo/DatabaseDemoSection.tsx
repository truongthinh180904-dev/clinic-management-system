'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  ChevronDown,
  ChevronUp,
  Play,
  Copy,
  Check,
  Code2,
  Table,
  Layers,
  FileCode,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  getDatabaseDemoObjects,
  executeDatabaseDemo,
  SqlObject,
  ExecutionResult,
} from '@/lib/api/database-demo';
import { MasterDatabaseDemoCenter } from './MasterDatabaseDemoCenter';

interface DatabaseDemoSectionProps {
  module: 'appointments' | 'patients' | 'invoices' | 'inventory' | 'reports';
  title?: string;
  description?: string;
}

const TYPE_CONFIG = {
  PROCEDURE: {
    label: 'Stored Procedure',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200',
    icon: Layers,
  },
  TRIGGER: {
    label: 'Trigger Tự động',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200',
    icon: Zap,
  },
  FUNCTION: {
    label: 'Function Tính toán',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200',
    icon: Code2,
  },
  CURSOR: {
    label: 'Cursor Duyệt tuần tự',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200',
    icon: RotateCcw,
  },
};

export function DatabaseDemoSection({
  module,
  title = 'QUẢN LÝ THÔNG TIN – DATABASE DEMO',
  description,
}: DatabaseDemoSectionProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [objects, setObjects] = useState<SqlObject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [executingName, setExecutingName] = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<Record<string, ExecutionResult>>({});
  const [showMasterCenter, setShowMasterCenter] = useState<boolean>(false);

  const loadObjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDatabaseDemoObjects(module);
      setObjects(data);
    } catch (err) {
      console.error('Failed to load demo objects:', err);
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => {
    loadObjects();
  }, [loadObjects]);

  const handleCopySql = (name: string, sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 2000);
  };

  const handleExecute = async (obj: SqlObject) => {
    setExecutingName(obj.name);
    try {
      const res = await executeDatabaseDemo(obj.name);
      setExecutionResults((prev) => ({
        ...prev,
        [obj.name]: res,
      }));
    } catch (err) {
      console.error('Execution error:', err);
    } finally {
      setExecutingName(null);
    }
  };

  return (
    <>
      <div className="mt-8 border-t-2 border-dashed border-indigo-200 dark:border-indigo-900/50 pt-6">
        <Card className="border-indigo-200 dark:border-indigo-900/60 shadow-md bg-gradient-to-b from-indigo-50/40 via-white to-white dark:from-indigo-950/20 dark:via-slate-900 dark:to-slate-900 overflow-hidden">
          {/* Header Bar */}
          <div className="px-5 py-4 border-b border-indigo-100 dark:border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50/60 dark:bg-indigo-950/40">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-blue-600 rounded-xl text-white shadow-xs">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold tracking-tight text-indigo-950 dark:text-indigo-100 flex items-center gap-1.5">
                    <span>{title}</span>
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  </h3>
                  <Badge variant="outline" className="text-[10px] bg-white dark:bg-slate-900 text-indigo-700 border-indigo-300">
                    Đồ án QLTT
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {description || `Trực quan hóa các Stored Procedure, Trigger, Function và Cursor tác động trên phân hệ ${module.toUpperCase()}`}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowMasterCenter(true)}
                className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Trung tâm Demo CSDL (15 Câu lệnh)</span>
                <ExternalLink className="h-3 w-3 ml-0.5 opacity-80" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600"
                title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Collapsible Content */}
          {isExpanded && (
            <CardContent className="p-5 space-y-5">
              {loading ? (
                <div className="flex items-center justify-center py-10 space-x-2 text-slate-500 text-xs">
                  <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
                  <span>Đang tải các đối tượng Quản lý thông tin SQL...</span>
                </div>
              ) : objects.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400">
                  Chưa có đối tượng SQL DEMO được gán cho phân hệ này.
                </p>
              ) : (
                <div className="space-y-4">
                  {objects.map((obj, idx) => {
                    const cfg = TYPE_CONFIG[obj.type] || TYPE_CONFIG.PROCEDURE;
                    const TypeIcon = cfg.icon;
                    const res = executionResults[obj.name];
                    const isRunning = executingName === obj.name;

                    return (
                      <Card
                        key={obj.id || idx}
                        className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs hover:border-indigo-300 transition-all bg-white dark:bg-slate-900"
                      >
                        {/* Object Item Header */}
                        <div className="p-4 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={cn('text-[11px] font-semibold border flex items-center gap-1', cfg.color)}>
                                <TypeIcon className="h-3 w-3" />
                                <span>{cfg.label}</span>
                              </Badge>
                              <code className="text-xs font-mono font-bold text-indigo-900 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                {obj.name}
                              </code>
                              {obj.trigger_event && (
                                <Badge variant="outline" className="text-[10px] text-purple-700 bg-purple-50 border-purple-200">
                                  ⚡ {obj.trigger_event}
                                </Badge>
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              {obj.title}
                            </h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
                              {obj.purpose}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="default"
                              size="sm"
                              disabled={isRunning}
                              onClick={() => handleExecute(obj)}
                              className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isRunning ? (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  <span>Đang chạy...</span>
                                </>
                              ) : (
                                <>
                                  <Play className="h-3.5 w-3.5 fill-current" />
                                  <span>Chạy DEMO thực tế</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Object Tabs: SQL vs Execution Result */}
                        <div className="p-4">
                          <Tabs defaultValue="sql" className="w-full">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
                              <TabsList className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg h-7">
                                <TabsTrigger value="sql" className="text-xs px-2.5 py-1 flex items-center gap-1.5 h-6">
                                  <FileCode className="h-3.5 w-3.5" />
                                  <span>Mã nguồn SQL thực tế</span>
                                </TabsTrigger>
                                <TabsTrigger value="tables" className="text-xs px-2.5 py-1 flex items-center gap-1.5 h-6">
                                  <Table className="h-3.5 w-3.5" />
                                  <span>Bảng & Cột tác động</span>
                                </TabsTrigger>
                                {res && (
                                  <TabsTrigger value="result" className="text-xs px-2.5 py-1 flex items-center gap-1.5 h-6 text-emerald-700 dark:text-emerald-400 font-semibold">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>Kết quả Trước / Sau ({res.duration_ms}ms)</span>
                                  </TabsTrigger>
                                )}
                              </TabsList>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopySql(obj.name, obj.sql_definition)}
                                  className="h-7 px-2 text-xs text-slate-500 hover:text-indigo-600"
                                >
                                  {copiedName === obj.name ? (
                                    <>
                                      <Check className="h-3.5 w-3.5 text-emerald-600 mr-1" />
                                      <span className="text-emerald-600 font-medium">Đã chép SQL</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3.5 w-3.5 mr-1" />
                                      <span>Sao chép SQL</span>
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>

                            {/* Tab 1: SQL Code */}
                            <TabsContent value="sql" className="mt-0">
                              <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 p-3.5 text-slate-100 text-[11px] font-mono leading-relaxed max-h-72 overflow-y-auto">
                                <pre className="whitespace-pre-wrap">{obj.sql_definition}</pre>
                              </div>
                              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                                <span>Câu lệnh gọi mẫu: <code className="text-indigo-600 dark:text-indigo-300 font-mono">{obj.sql_invocation}</code></span>
                                <Badge variant="outline" className="text-[10px] text-slate-500">MySQL 8.0+ InnoDB</Badge>
                              </div>
                            </TabsContent>

                            {/* Tab 2: Schema Impact */}
                            <TabsContent value="tables" className="mt-0 space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800">
                                  <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                                    <Table className="h-3.5 w-3.5 text-blue-500" />
                                    Các bảng dữ liệu liên quan:
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {obj.target_tables.map((t) => (
                                      <Badge key={t} variant="secondary" className="font-mono text-[10px]">
                                        {t}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800">
                                  <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                                    <Layers className="h-3.5 w-3.5 text-purple-500" />
                                    Các cột dữ liệu chịu tác động:
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {obj.target_columns.map((c) => (
                                      <Badge key={c} variant="outline" className="font-mono text-[10px] bg-white dark:bg-slate-900">
                                        {c}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {obj.parameters && obj.parameters.length > 0 && (
                                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b">
                                      <tr>
                                        <th className="px-3 py-1.5 font-semibold">Tham số</th>
                                        <th className="px-3 py-1.5 font-semibold">Kiểu dữ liệu</th>
                                        <th className="px-3 py-1.5 font-semibold">Hướng</th>
                                        <th className="px-3 py-1.5 font-semibold">Mô tả nghiệp vụ</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {obj.parameters.map((p, pIdx) => (
                                        <tr key={pIdx}>
                                          <td className="px-3 py-1.5 font-mono text-indigo-600 font-semibold">{p.name}</td>
                                          <td className="px-3 py-1.5 font-mono text-slate-500">{p.type}</td>
                                          <td className="px-3 py-1.5">
                                            <Badge variant={p.direction === 'IN' ? 'secondary' : 'default'} className="text-[10px]">
                                              {p.direction}
                                            </Badge>
                                          </td>
                                          <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{p.description}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </TabsContent>

                            {/* Tab 3: Execution Result & Before/After Diff */}
                            {res && (
                              <TabsContent value="result" className="mt-0 space-y-3">
                                <div
                                  className={cn(
                                    'p-3 rounded-lg border text-xs flex items-start gap-2',
                                    res.success
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
                                  )}
                                >
                                  {res.success ? (
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                                  ) : (
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                                  )}
                                  <div>
                                    <p className="font-semibold">{res.message}</p>
                                    <p className="text-[11px] opacity-80 mt-0.5">
                                      Thời gian thực thi MySQL: {res.duration_ms} ms · Đã ghi nhận lịch sử vào bảng db_demo_audit_logs
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                  {/* Before Data */}
                                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800">
                                    <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                                      <span>Dữ liệu TRƯỚC khi thực thi (Before):</span>
                                      <Badge variant="outline" className="text-[10px] text-slate-500">Trạng thái cũ</Badge>
                                    </p>
                                    <pre className="text-[11px] font-mono bg-white dark:bg-slate-950 p-2.5 rounded border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 overflow-x-auto max-h-48">
                                      {JSON.stringify(res.before_data, null, 2)}
                                    </pre>
                                  </div>

                                  {/* After Data */}
                                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-900">
                                    <p className="font-semibold text-indigo-900 dark:text-indigo-200 mb-1 flex items-center justify-between">
                                      <span>Dữ liệu SAU khi thực thi (After):</span>
                                      <Badge variant="default" className="text-[10px] bg-emerald-600">Đã cập nhật</Badge>
                                    </p>
                                    <pre className="text-[11px] font-mono bg-white dark:bg-slate-950 p-2.5 rounded border border-indigo-200 dark:border-indigo-900 text-slate-800 dark:text-slate-200 overflow-x-auto max-h-48">
                                      {JSON.stringify(res.after_data, null, 2)}
                                    </pre>
                                  </div>
                                </div>

                                {/* Table of Rows if procedure/cursor returns records */}
                                {res.result_rows && res.result_rows.length > 0 && (
                                  <div className="mt-3">
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                      Bảng dữ liệu kết quả truy vấn thực tế ({res.result_rows.length} dòng):
                                    </p>
                                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 max-h-60">
                                      <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0">
                                          <tr>
                                            {Object.keys(res.result_rows[0] as object).map((colKey) => (
                                              <th key={colKey} className="px-3 py-2 font-semibold whitespace-nowrap">
                                                {colKey}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                          {res.result_rows.map((rowItem, rIdx) => (
                                            <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                              {Object.values(rowItem as object).map((val, cIdx) => (
                                                <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap text-slate-700 dark:text-slate-300">
                                                  {typeof val === 'number'
                                                    ? val.toLocaleString('vi-VN')
                                                    : String(val ?? '')}
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </TabsContent>
                            )}
                          </Tabs>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      {/* Master Modal Controller */}
      {showMasterCenter && (
        <MasterDatabaseDemoCenter
          isOpen={showMasterCenter}
          onClose={() => setShowMasterCenter(false)}
          initialModule={module}
        />
      )}
    </>
  );
}
