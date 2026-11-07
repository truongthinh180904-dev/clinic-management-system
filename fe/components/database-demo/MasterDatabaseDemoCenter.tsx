'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Database,
  Layers,
  Zap,
  Code2,
  RotateCcw,
  Search,
  Filter,
  Play,
  Copy,
  Check,
  Table,
  CheckCircle2,
  AlertTriangle,
  History,
  FileCode,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  getDatabaseDemoObjects,
  executeDatabaseDemo,
  getDatabaseDemoHistory,
  getDatabaseDemoStats,
  SqlObject,
  AuditLogItem,
  ExecutionResult,
  DemoStats,
} from '@/lib/api/database-demo';

interface MasterDatabaseDemoCenterProps {
  isOpen: boolean;
  onClose: () => void;
  initialModule?: string;
}

export function MasterDatabaseDemoCenter({
  isOpen,
  onClose,
  initialModule,
}: MasterDatabaseDemoCenterProps) {
  const [activeTab, setActiveTab] = useState<'catalog' | 'executor' | 'history'>('catalog');
  const [objects, setObjects] = useState<SqlObject[]>([]);
  const [historyLogs, setHistoryLogs] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState<DemoStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Filters for Catalog
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedModule, setSelectedModule] = useState<string>(initialModule || 'ALL');

  // Selected Object for Detail view / Execution
  const [selectedObject, setSelectedObject] = useState<SqlObject | null>(null);
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);

  // Load all objects and stats
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [objs, statsData] = await Promise.all([
        getDatabaseDemoObjects(),
        getDatabaseDemoStats(),
      ]);
      setObjects(objs);
      setStats(statsData);
      if (objs.length > 0 && !selectedObject) {
        setSelectedObject(objs[0]);
      }
    } catch (err) {
      console.error('Failed to load demo center data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedObject]);

  // Load history logs
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const logs = await getDatabaseDemoHistory(50);
      setHistoryLogs(logs);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
      loadHistory();
    }
  }, [isOpen, loadData, loadHistory]);

  // Filtered objects in catalog
  const filteredObjects = useMemo(() => {
    return objects.filter((obj) => {
      const matchesSearch =
        searchQuery === '' ||
        obj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        obj.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        obj.purpose.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = selectedType === 'ALL' || obj.type === selectedType;
      const matchesModule = selectedModule === 'ALL' || obj.module === selectedModule;

      return matchesSearch && matchesType && matchesModule;
    });
  }, [objects, searchQuery, selectedType, selectedModule]);

  const handleCopySql = (name: string, sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 2000);
  };

  const handleExecute = async (obj: SqlObject) => {
    setIsExecuting(true);
    try {
      const res = await executeDatabaseDemo(obj.name);
      setExecutionResult(res);
      // Refresh audit logs
      loadHistory();
    } catch (err) {
      console.error('Execution failed:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
        {/* Sticky Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white flex items-center justify-between shrink-0 border-b border-indigo-700/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
              <Database className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold tracking-tight">
                  TRUNG TÂM QUẢN LÝ THÔNG TIN & DEMO DATABASE
                </h2>
                <Badge className="bg-amber-400 text-indigo-950 font-bold text-[10px] px-2">
                  ĐỒ ÁN QLPK (UIT)
                </Badge>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                Trực quan hóa 15 đối tượng SQL thực tế: Stored Procedure (5) · Trigger (5) · Function (3) · Cursor (2)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-lg"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'catalog' | 'executor' | 'history')}
            className="w-full sm:w-auto"
          >
            <TabsList className="bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 h-9">
              <TabsTrigger value="catalog" className="text-xs px-3 py-1 flex items-center gap-1.5">
                <Table className="h-3.5 w-3.5 text-blue-600" />
                <span>1. Bảng 15 Câu lệnh SQL</span>
                <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">15</Badge>
              </TabsTrigger>
              <TabsTrigger value="executor" className="text-xs px-3 py-1 flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5 text-emerald-600 fill-emerald-600" />
                <span>2. Thực thi DEMO Trực quan</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs px-3 py-1 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-purple-600" />
                <span>3. Lịch sử Thay đổi Dữ liệu</span>
                <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">{historyLogs.length}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Quick Metrics Bar */}
          {stats && (
            <div className="flex items-center gap-2 text-xs text-slate-500 overflow-x-auto no-scrollbar">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Cơ cấu:</span>
              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                5 Procedures
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                5 Triggers
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                3 Functions
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                2 Cursors
              </Badge>
            </div>
          )}
        </div>

        {/* Modal Main Body Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: BẢNG TỔNG HỢP 15 CÂU LỆNH SQL */}
          {activeTab === 'catalog' && (
            <div className="space-y-4">
              {/* Search & Filter Toolbar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Tìm theo tên thủ tục, trigger, function..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Type Filter Buttons */}
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-slate-500 text-[11px] mr-1">Loại:</span>
                    {['ALL', 'PROCEDURE', 'TRIGGER', 'FUNCTION', 'CURSOR'].map((t) => (
                      <Button
                        key={t}
                        variant={selectedType === t ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedType(t)}
                        className="h-7 text-[11px] px-2 py-0"
                      >
                        {t === 'ALL' ? 'Tất cả' : t}
                      </Button>
                    ))}
                  </div>

                  {/* Module Filter */}
                  <div className="flex items-center gap-1 text-xs ml-2">
                    <span className="text-slate-500 text-[11px] mr-1">Module:</span>
                    <select
                      value={selectedModule}
                      onChange={(e) => setSelectedModule(e.target.value)}
                      className="h-7 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-slate-700 dark:text-slate-300 focus:outline-none"
                    >
                      <option value="ALL">Tất cả phân hệ</option>
                      <option value="appointments">Lịch hẹn</option>
                      <option value="patients">Bệnh nhân</option>
                      <option value="invoices">Hóa đơn</option>
                      <option value="inventory">Kho dược</option>
                      <option value="reports">Báo cáo</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Master Table of 15 Commands */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-3 py-2.5 font-bold w-12 text-center">STT</th>
                      <th className="px-3 py-2.5 font-bold">Tên đối tượng SQL</th>
                      <th className="px-3 py-2.5 font-bold">Loại đối tượng</th>
                      <th className="px-3 py-2.5 font-bold">Chức năng nghiệp vụ</th>
                      <th className="px-3 py-2.5 font-bold">Bảng tác động</th>
                      <th className="px-3 py-2.5 font-bold text-center">Trạng thái</th>
                      <th className="px-3 py-2.5 font-bold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredObjects.map((obj, idx) => {
                      const isProcedure = obj.type === 'PROCEDURE';
                      const isTrigger = obj.type === 'TRIGGER';
                      const isFunction = obj.type === 'FUNCTION';
                      const isCursor = obj.type === 'CURSOR';

                      return (
                        <tr
                          key={obj.id}
                          className="hover:bg-indigo-50/50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                          onClick={() => {
                            setSelectedObject(obj);
                            setActiveTab('executor');
                          }}
                        >
                          <td className="px-3 py-2 text-center text-slate-500 font-medium">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2">
                            <code className="font-mono font-bold text-indigo-900 dark:text-indigo-200 text-xs">
                              {obj.name}
                            </code>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                              {obj.title}
                            </p>
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              className={cn(
                                'text-[10px] font-semibold',
                                isProcedure && 'bg-blue-100 text-blue-800 border-blue-200',
                                isTrigger && 'bg-purple-100 text-purple-800 border-purple-200',
                                isFunction && 'bg-emerald-100 text-emerald-800 border-emerald-200',
                                isCursor && 'bg-amber-100 text-amber-800 border-amber-200'
                              )}
                            >
                              {obj.type}
                            </Badge>
                            {obj.trigger_event && (
                              <p className="text-[10px] text-purple-600 mt-0.5">
                                {obj.trigger_event}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                            {obj.purpose}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {obj.target_tables.map((t) => (
                                <Badge key={t} variant="secondary" className="font-mono text-[9px] px-1 py-0">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-300">
                              <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                              Đã triển khai
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs px-2.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedObject(obj);
                                setActiveTab('executor');
                              }}
                            >
                              <Play className="h-3 w-3 mr-1 fill-current" />
                              DEMO
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: KHU VỰC THỰC THI DEMO TRỰC QUAN */}
          {activeTab === 'executor' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Object Selector List (4 Cols) */}
              <div className="lg:col-span-4 space-y-2 border-r border-slate-200 dark:border-slate-800 pr-0 lg:pr-4 max-h-[68vh] overflow-y-auto">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 px-1 mb-2 flex items-center justify-between">
                  <span>Chọn câu lệnh SQL để DEMO:</span>
                  <span className="text-[10px] text-slate-400 font-normal">15 câu lệnh</span>
                </p>

                {objects.map((obj) => {
                  const isSelected = selectedObject?.name === obj.name;
                  return (
                    <button
                      key={obj.name}
                      type="button"
                      onClick={() => {
                        setSelectedObject(obj);
                        setExecutionResult(null);
                      }}
                      className={cn(
                        'w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-start gap-2.5',
                        isSelected
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-950 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <div className="mt-0.5">
                        {obj.type === 'PROCEDURE' && <Layers className="h-4 w-4 text-blue-600" />}
                        {obj.type === 'TRIGGER' && <Zap className="h-4 w-4 text-purple-600" />}
                        {obj.type === 'FUNCTION' && <Code2 className="h-4 w-4 text-emerald-600" />}
                        {obj.type === 'CURSOR' && <RotateCcw className="h-4 w-4 text-amber-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate text-[11px] font-mono">{obj.name}</p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{obj.title}</p>
                      </div>
                      {isSelected && <ChevronRight className="h-4 w-4 text-indigo-600 shrink-0 self-center" />}
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Execution Workspace (8 Cols) */}
              <div className="lg:col-span-8 space-y-4">
                {selectedObject ? (
                  <>
                    {/* Object Detail Card */}
                    <Card className="border border-slate-200 dark:border-slate-800 shadow-xs">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className="text-[10px] font-semibold bg-indigo-100 text-indigo-800 border-indigo-200">
                              {selectedObject.type}
                            </Badge>
                            <code className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                              {selectedObject.name}
                            </code>
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                            {selectedObject.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            disabled={isExecuting}
                            onClick={() => handleExecute(selectedObject)}
                            className="h-8 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isExecuting ? (
                              <>
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                <span>Đang thực thi MySQL...</span>
                              </>
                            ) : (
                              <>
                                <Play className="h-3.5 w-3.5 fill-current" />
                                <span>Thực thi DEMO thực tế</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      <CardContent className="p-4 space-y-4">
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          <strong>Mục đích:</strong> {selectedObject.purpose}
                        </p>

                        {/* SQL Source Code Accordion */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                              <FileCode className="h-3.5 w-3.5 text-blue-500" />
                              Mã nguồn SQL thực tế trong MySQL:
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopySql(selectedObject.name, selectedObject.sql_definition)}
                              className="h-6 text-[11px] px-2 text-slate-500 hover:text-indigo-600"
                            >
                              {copiedName === selectedObject.name ? (
                                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                  <Check className="h-3 w-3" /> Đã chép SQL
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Copy className="h-3 w-3" /> Sao chép toàn bộ SQL
                                </span>
                              )}
                            </Button>
                          </div>
                          <pre className="text-[11px] font-mono bg-slate-950 text-slate-100 p-3.5 rounded-lg max-h-56 overflow-y-auto border border-slate-800 leading-relaxed">
                            {selectedObject.sql_definition}
                          </pre>
                        </div>

                        {/* Execution Result Area */}
                        {executionResult && (
                          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-300">
                            <div
                              className={cn(
                                'p-3 rounded-lg border text-xs flex items-start gap-2',
                                executionResult.success
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-900 dark:text-emerald-300'
                                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-900 dark:text-rose-300'
                              )}
                            >
                              {executionResult.success ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1">
                                <p className="font-bold">{executionResult.message}</p>
                                <p className="text-[11px] opacity-80 mt-0.5">
                                  Đã đo đạc thời gian thực thi: <strong>{executionResult.duration_ms} ms</strong> · Đã ghi nhận lịch sử vào bảng <code>db_demo_audit_logs</code>
                                </p>
                              </div>
                            </div>

                            {/* Before & After Diff Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
                                <p className="font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                                  <span>Dữ liệu TRƯỚC khi thực thi:</span>
                                  <Badge variant="outline" className="text-[10px]">BEFORE</Badge>
                                </p>
                                <pre className="text-[11px] font-mono bg-white dark:bg-slate-950 p-2.5 rounded border border-slate-200 dark:border-slate-800 max-h-40 overflow-x-auto text-slate-800 dark:text-slate-200">
                                  {JSON.stringify(executionResult.before_data, null, 2)}
                                </pre>
                              </div>

                              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-900">
                                <p className="font-bold text-indigo-900 dark:text-indigo-200 mb-1 flex items-center justify-between">
                                  <span>Dữ liệu SAU khi thực thi:</span>
                                  <Badge variant="default" className="text-[10px] bg-emerald-600">AFTER</Badge>
                                </p>
                                <pre className="text-[11px] font-mono bg-white dark:bg-slate-950 p-2.5 rounded border border-indigo-200 dark:border-indigo-900 max-h-40 overflow-x-auto text-slate-800 dark:text-slate-200">
                                  {JSON.stringify(executionResult.after_data, null, 2)}
                                </pre>
                              </div>
                            </div>

                            {/* Table of Result Rows if procedure/cursor returns dataset */}
                            {executionResult.result_rows && executionResult.result_rows.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                  <Table className="h-3.5 w-3.5 text-blue-600" />
                                  <span>Bảng dữ liệu do Procedure / Cursor trả về ({executionResult.result_rows.length} bản ghi):</span>
                                </p>
                                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 max-h-60">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0">
                                      <tr>
                                        {Object.keys(executionResult.result_rows[0] as object).map((k) => (
                                          <th key={k} className="px-3 py-1.5 font-bold whitespace-nowrap">
                                            {k}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {executionResult.result_rows.map((rowItem, rIdx) => (
                                        <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                          {Object.values(rowItem as object).map((v, cIdx) => (
                                            <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap text-slate-700 dark:text-slate-300">
                                              {typeof v === 'number' ? v.toLocaleString('vi-VN') : String(v ?? '')}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <p className="text-center py-20 text-xs text-slate-400">
                    Vui lòng chọn một câu lệnh ở cột bên trái để xem chi tiết và chạy thử nghiệm.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: BẢNG THEO DÕI THAY ĐỔI DỮ LIỆU (AUDIT TRAIL) */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <History className="h-4 w-4 text-purple-600" />
                    <span>Nhật ký Lịch sử Thay đổi Dữ liệu (Bảng db_demo_audit_logs)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Lưu trữ minh bạch mọi sự kiện kích hoạt Stored Procedure, Trigger tự động, Function và Cursor
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadHistory}
                  disabled={loadingHistory}
                  className="h-8 text-xs flex items-center space-x-1"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', loadingHistory && 'animate-spin')} />
                  <span>Làm mới nhật ký</span>
                </Button>
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-10 space-x-2 text-xs text-slate-500">
                  <RefreshCw className="h-4 w-4 animate-spin text-purple-600" />
                  <span>Đang tải nhật ký kiểm toán...</span>
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400 border border-dashed rounded-xl p-8">
                  Chưa có lịch sử thay đổi dữ liệu nào được ghi nhận. Hãy sang Tab "Thực thi DEMO" để chạy thử nghiệm!
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-3 py-2.5 font-bold">Thời gian</th>
                        <th className="px-3 py-2.5 font-bold">Câu lệnh SQL</th>
                        <th className="px-3 py-2.5 font-bold">Bảng tác động</th>
                        <th className="px-3 py-2.5 font-bold">Loại thay đổi</th>
                        <th className="px-3 py-2.5 font-bold">Kết quả thực thi</th>
                        <th className="px-3 py-2.5 font-bold text-center">Thời gian</th>
                        <th className="px-3 py-2.5 font-bold text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {historyLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                            {log.executed_at}
                          </td>
                          <td className="px-3 py-2">
                            <code className="font-mono font-bold text-indigo-900 dark:text-indigo-200 text-xs">
                              {log.sql_object_name}
                            </code>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary" className="font-mono text-[10px]">
                              {log.target_table}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px]',
                                log.action_type === 'TRIGGER_AUTO' && 'text-purple-700 border-purple-200 bg-purple-50',
                                log.action_type === 'PROCEDURE_EXEC' && 'text-blue-700 border-blue-200 bg-blue-50',
                                log.action_type === 'FUNCTION_CALL' && 'text-emerald-700 border-emerald-200 bg-emerald-50',
                                log.action_type === 'CURSOR_LOOP' && 'text-amber-700 border-amber-200 bg-amber-50'
                              )}
                            >
                              {log.action_type}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-sm truncate text-[11px]">
                            {log.execution_message}
                          </td>
                          <td className="px-3 py-2 text-center text-slate-500 font-mono text-[11px]">
                            {log.duration_ms} ms
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge
                              className={cn(
                                'text-[10px]',
                                log.status === 'SUCCESS' && 'bg-emerald-100 text-emerald-800 border-emerald-200',
                                log.status === 'VERIFIED' && 'bg-blue-100 text-blue-800 border-blue-200',
                                log.status === 'FAILED' && 'bg-rose-100 text-rose-800 border-rose-200'
                              )}
                            >
                              {log.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Hệ thống Quản lý Phòng khám Chuyên nghiệp · Phân hệ Quản lý Thông tin Database</span>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Đóng cửa sổ
          </Button>
        </div>
      </div>
    </div>
  );
}
