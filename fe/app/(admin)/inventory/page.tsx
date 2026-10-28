'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Edit,
  ArrowUpDown,
  History,
  PackagePlus,
  PackageMinus,
  SlidersHorizontal,
  Layers,
  ArrowRight,
  TrendingDown,
  Info,
  Calendar,
  Check,
  X,
  ShieldAlert,
} from 'lucide-react';

import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatDateTime, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Product,
  ProductStatus,
  StockStatus,
  InventoryTransaction,
  InventoryTransactionType,
  InventorySummary,
  CreateProductInput,
  UpdateProductInput,
  CreateInventoryTransactionInput,
} from '@/types/inventory';
import {
  getInventorySummary,
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  updateProductStatus,
  getInventoryTransactions,
  createInventoryTransaction,
} from '@/lib/api/inventory';

export default function InventoryPage() {
  const { hasPermission } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<'products' | 'transactions'>('products');

  // Summary & Stats
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);
  const [productSearch, setProductSearch] = useState<string>('');
  const [productStockFilter, setProductStockFilter] = useState<string>('ALL');
  const [productStatusFilter, setProductStatusFilter] = useState<string>('ALL');

  // Transactions state
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState<boolean>(true);
  const [txSearch, setTxSearch] = useState<string>('');
  const [txTypeFilter, setTxTypeFilter] = useState<string>('ALL');
  const [txProductFilter, setTxProductFilter] = useState<string>('ALL');

  // Notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isTxModalOpen, setIsTxModalOpen] = useState<boolean>(false);
  const [txSelectedProduct, setTxSelectedProduct] = useState<Product | null>(null);

  // Product Form State
  const [formProductCode, setFormProductCode] = useState<string>('');
  const [formProductName, setFormProductName] = useState<string>('');
  const [formProductUnit, setFormProductUnit] = useState<string>('Viên');
  const [formProductMinStock, setFormProductMinStock] = useState<number | ''>(10);
  const [formProductInitialStock, setFormProductInitialStock] = useState<number | ''>(0);
  const [formProductStatus, setFormProductStatus] = useState<ProductStatus>('ACTIVE');
  const [productSubmitting, setProductSubmitting] = useState<boolean>(false);
  const [productFormError, setProductFormError] = useState<string | null>(null);

  // Transaction Form State
  const [formTxProductId, setFormTxProductId] = useState<number | ''>('');
  const [formTxType, setFormTxType] = useState<InventoryTransactionType>('IN');
  const [formTxQuantity, setFormTxQuantity] = useState<number | ''>('');
  const [formTxRefType, setFormTxRefType] = useState<string>('PURCHASE_ORDER');
  const [formTxDate, setFormTxDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [formTxNotes, setFormTxNotes] = useState<string>('');
  const [txSubmitting, setTxSubmitting] = useState<boolean>(false);
  const [txFormError, setTxFormError] = useState<string | null>(null);

  // Load summary
  const fetchSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const res = await getInventorySummary();
      if (res && res.data) {
        setSummary(res.data);
      }
    } catch (err) {
      console.error('Failed to load inventory summary', err);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  // Load products
  const fetchProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      setErrorMsg(null);
      const params: Record<string, unknown> = {
        per_page: 100,
        sort_by: 'current_stock',
        order: 'asc',
      };
      if (productSearch.trim()) {
        params.search = productSearch.trim();
      }
      if (productStockFilter !== 'ALL') {
        params.stock_status = productStockFilter;
      }
      if (productStatusFilter !== 'ALL') {
        params.status = productStatusFilter;
      }

      const res = await getProducts(params);
      if (res && res.data) {
        setProducts(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách sản phẩm.';
      setErrorMsg(msg);
    } finally {
      setLoadingProducts(false);
    }
  }, [productSearch, productStockFilter, productStatusFilter]);

  // Load transactions
  const fetchTransactions = useCallback(async () => {
    try {
      setLoadingTransactions(true);
      const params: Record<string, unknown> = {
        per_page: 50,
        sort_by: 'transaction_date',
        order: 'desc',
      };
      if (txSearch.trim()) {
        params.search = txSearch.trim();
      }
      if (txTypeFilter !== 'ALL') {
        params.transaction_type = txTypeFilter;
      }
      if (txProductFilter !== 'ALL') {
        params.product_id = Number(txProductFilter);
      }

      const res = await getInventoryTransactions(params);
      if (res && res.data) {
        setTransactions(res.data);
      }
    } catch (err) {
      console.error('Failed to load transactions', err);
    } finally {
      setLoadingTransactions(false);
    }
  }, [txSearch, txTypeFilter, txProductFilter]);

  // Initial load
  useEffect(() => {
    fetchSummary();
    fetchProducts();
    fetchTransactions();
  }, [fetchSummary, fetchProducts, fetchTransactions]);

  // Open Add Product Modal
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setFormProductCode('');
    setFormProductName('');
    setFormProductUnit('Viên');
    setFormProductMinStock(10);
    setFormProductInitialStock(0);
    setFormProductStatus('ACTIVE');
    setProductFormError(null);
    setIsProductModalOpen(true);
  };

  // Open Edit Product Modal
  const handleOpenEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormProductCode(product.product_code);
    setFormProductName(product.name);
    setFormProductUnit(product.unit);
    setFormProductMinStock(product.minimum_stock);
    setFormProductStatus(product.status);
    setProductFormError(null);
    setIsProductModalOpen(true);
  };

  // Open Transaction Modal
  const handleOpenTransaction = (product?: Product, defaultType: InventoryTransactionType = 'IN') => {
    const targetProduct = product || (products.length > 0 ? products[0] : null);
    setTxSelectedProduct(targetProduct);
    setFormTxProductId(targetProduct ? targetProduct.id : '');
    setFormTxType(defaultType);
    setFormTxQuantity('');
    setFormTxRefType(defaultType === 'IN' ? 'PURCHASE_ORDER' : defaultType === 'OUT' ? 'CLINIC_CONSUMPTION' : 'STOCKTAKE_ADJUST');
    setFormTxDate(new Date().toISOString().slice(0, 16));
    setFormTxNotes('');
    setTxFormError(null);
    setIsTxModalOpen(true);
  };

  // Handle Product Submit (Create / Update)
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProductName.trim()) {
      setProductFormError('Vui lòng nhập tên thuốc hoặc vật tư.');
      return;
    }
    if (!formProductUnit.trim()) {
      setProductFormError('Vui lòng nhập đơn vị tính.');
      return;
    }
    const minStock = Number(formProductMinStock);
    if (isNaN(minStock) || minStock < 0) {
      setProductFormError('Định mức tồn tối thiểu phải là số không âm.');
      return;
    }

    try {
      setProductSubmitting(true);
      setProductFormError(null);

      if (editingProduct) {
        const payload: UpdateProductInput = {
          product_code: formProductCode.trim() || undefined,
          name: formProductName.trim(),
          unit: formProductUnit.trim(),
          minimum_stock: minStock,
          status: formProductStatus,
        };
        await updateProduct(editingProduct.id, payload);
        setSuccessMsg(`Cập nhật sản phẩm "${formProductName}" thành công.`);
      } else {
        const initStock = Number(formProductInitialStock) || 0;
        const payload: CreateProductInput = {
          product_code: formProductCode.trim() || undefined,
          name: formProductName.trim(),
          unit: formProductUnit.trim(),
          minimum_stock: minStock,
          initial_stock: initStock,
          status: formProductStatus,
        };
        await createProduct(payload);
        setSuccessMsg(`Thêm sản phẩm "${formProductName}" thành công.`);
      }

      setIsProductModalOpen(false);
      fetchProducts();
      fetchSummary();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi lưu sản phẩm.';
      setProductFormError(msg);
    } finally {
      setProductSubmitting(false);
    }
  };

  // Quick toggle status
  const handleToggleProductStatus = async (product: Product) => {
    const nextStatus: ProductStatus = product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateProductStatus(product.id, nextStatus);
      setSuccessMsg(`Đã đổi trạng thái "${product.name}" sang ${nextStatus === 'ACTIVE' ? 'Kích hoạt' : 'Tạm dừng'}.`);
      fetchProducts();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể cập nhật trạng thái.';
      setErrorMsg(msg);
    }
  };

  // Handle selected product changed in Transaction modal
  const handleTxProductChange = (productId: number) => {
    setFormTxProductId(productId);
    const found = products.find((p) => p.id === productId) || null;
    setTxSelectedProduct(found);
  };

  // Compute Real-time stock calculation preview
  const currentStockForTx = txSelectedProduct ? Number(txSelectedProduct.current_stock) || 0 : 0;
  const inputQuantity = Number(formTxQuantity) || 0;

  const stockCalculation = useMemo(() => {
    if (!txSelectedProduct) {
      return { projectedStock: 0, isValid: true, errorMessage: null };
    }

    if (formTxType === 'IN') {
      const projected = Math.round((currentStockForTx + inputQuantity) * 1000) / 1000;
      return {
        projectedStock: projected,
        isValid: inputQuantity > 0,
        errorMessage: inputQuantity <= 0 && formTxQuantity !== '' ? 'Số lượng nhập phải lớn hơn 0.' : null,
      };
    } else if (formTxType === 'OUT') {
      const projected = Math.round((currentStockForTx - inputQuantity) * 1000) / 1000;
      if (inputQuantity > currentStockForTx) {
        return {
          projectedStock: projected,
          isValid: false,
          errorMessage: `Số lượng xuất (${inputQuantity} ${txSelectedProduct.unit}) vượt quá tồn kho hiện tại (${currentStockForTx} ${txSelectedProduct.unit}). Hệ thống chặn xuất kho âm!`,
        };
      }
      return {
        projectedStock: projected,
        isValid: inputQuantity > 0,
        errorMessage: inputQuantity <= 0 && formTxQuantity !== '' ? 'Số lượng xuất phải lớn hơn 0.' : null,
      };
    } else {
      // ADJUST
      const projected = Math.round((currentStockForTx + inputQuantity) * 1000) / 1000;
      if (projected < 0) {
        return {
          projectedStock: projected,
          isValid: false,
          errorMessage: `Tồn kho sau điều chỉnh không được nhỏ hơn 0 (Hiện tại: ${currentStockForTx}, Chênh lệch: ${inputQuantity}).`,
        };
      }
      return {
        projectedStock: projected,
        isValid: inputQuantity !== 0,
        errorMessage: inputQuantity === 0 && formTxQuantity !== '' ? 'Số lượng điều chỉnh không được bằng 0.' : null,
      };
    }
  }, [txSelectedProduct, currentStockForTx, formTxType, inputQuantity, formTxQuantity]);

  // Handle Transaction Submit
  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTxProductId) {
      setTxFormError('Vui lòng chọn sản phẩm.');
      return;
    }
    if (!stockCalculation.isValid) {
      setTxFormError(stockCalculation.errorMessage || 'Số lượng giao dịch không hợp lệ.');
      return;
    }

    try {
      setTxSubmitting(true);
      setTxFormError(null);

      const payload: CreateInventoryTransactionInput = {
        product_id: Number(formTxProductId),
        transaction_type: formTxType,
        quantity: inputQuantity,
        reference_type: formTxRefType,
        transaction_date: formTxDate ? new Date(formTxDate).toISOString() : new Date().toISOString(),
      };

      await createInventoryTransaction(payload);

      setSuccessMsg(
        `Thực hiện ${
          formTxType === 'IN' ? 'Nhập kho' : formTxType === 'OUT' ? 'Xuất kho' : 'Điều chỉnh kho'
        } thành công cho "${txSelectedProduct?.name}". Tồn mới: ${stockCalculation.projectedStock} ${txSelectedProduct?.unit}.`
      );

      setIsTxModalOpen(false);
      fetchProducts();
      fetchTransactions();
      fetchSummary();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi thực hiện giao dịch kho.';
      setTxFormError(msg);
    } finally {
      setTxSubmitting(false);
    }
  };

  // High alert products (LOW_STOCK or OUT_OF_STOCK)
  const lowStockAlertItems = useMemo(() => {
    return products.filter((p) => p.status === 'ACTIVE' && (p.is_low_stock || p.current_stock <= 0));
  }, [products]);

  // Render stock badge
  const renderStockBadge = (product: Product) => {
    const current = Number(product.current_stock) || 0;
    const min = Number(product.minimum_stock) || 0;

    if (current <= 0) {
      return (
        <Badge variant="destructive" className="gap-1 font-semibold">
          <XCircle className="h-3 w-3" />
          Hết hàng ({current})
        </Badge>
      );
    }
    if (current <= min) {
      return (
        <Badge variant="warning" className="gap-1 font-semibold">
          <AlertTriangle className="h-3 w-3" />
          Sắp hết ({current}/{min})
        </Badge>
      );
    }
    return (
      <Badge variant="success" className="gap-1 font-medium">
        <CheckCircle2 className="h-3 w-3" />
        Đủ tồn ({current})
      </Badge>
    );
  };

  // Render transaction type badge
  const renderTxTypeBadge = (type: InventoryTransactionType) => {
    switch (type) {
      case 'IN':
        return (
          <Badge variant="success" className="gap-1 font-semibold">
            <PackagePlus className="h-3.5 w-3.5" />
            Nhập kho
          </Badge>
        );
      case 'OUT':
        return (
          <Badge variant="destructive" className="gap-1 font-semibold">
            <PackageMinus className="h-3.5 w-3.5" />
            Xuất kho
          </Badge>
        );
      case 'ADJUST':
        return (
          <Badge variant="default" className="gap-1 font-semibold">
            <ArrowUpDown className="h-3.5 w-3.5" />
            Kiểm kê / Điều chỉnh
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Quản lý Kho Thuốc & Vật tư Y tế"
        description="Theo dõi danh mục dược phẩm tiêu hao, quản lý giao dịch nhập/xuất/kiểm kê chống âm kho và cảnh báo tồn kho tự động."
        breadcrumbs={[
          { label: 'Tổng quan', href: '/admin' },
          { label: 'Tài chính & Kho dược', href: '/inventory' },
          { label: 'Kho & Cảnh báo tồn' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchSummary();
                fetchProducts();
                fetchTransactions();
              }}
              disabled={loadingProducts || loadingTransactions}
              className="gap-1.5"
            >
              <RefreshCw
                className={cn('h-4 w-4', (loadingProducts || loadingTransactions) && 'animate-spin')}
              />
              Làm mới
            </Button>
            <Button
              onClick={() => handleOpenTransaction(undefined, 'IN')}
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <PackagePlus className="h-4 w-4" />
              Tạo phiếu Nhập/Xuất kho
            </Button>
            <Button
              onClick={handleOpenAddProduct}
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Thêm Vật tư mới
            </Button>
          </div>
        }
      />

      {/* Success Alert Banner */}
      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center justify-between dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSuccessMsg(null)}
            className="h-7 px-2 text-emerald-700 hover:bg-emerald-100"
          >
            Đóng
          </Button>
        </div>
      )}

      {/* General Error Alert */}
      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-center justify-between dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setErrorMsg(null)}
            className="h-7 px-2 text-rose-700 hover:bg-rose-100"
          >
            Đóng
          </Button>
        </div>
      )}

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tổng danh mục vật tư"
          value={summary?.total_products ?? products.length}
          icon={Boxes}
          variant="primary"
          description="Các mặt hàng thuốc và vật tư y tế"
        />
        <StatCard
          title="Đủ định mức tồn"
          value={summary?.in_stock_products ?? products.filter((p) => !p.is_low_stock && p.current_stock > 0).length}
          icon={CheckCircle2}
          variant="success"
          description="Sẵn sàng cấp phát khám chữa bệnh"
        />
        <StatCard
          title="Cảnh báo sắp hết"
          value={summary?.low_stock_products ?? products.filter((p) => p.is_low_stock && p.current_stock > 0).length}
          icon={AlertTriangle}
          variant="warning"
          description="Tồn chạm hoặc dưới mức tối thiểu"
        />
        <StatCard
          title="Đã hết hàng tồn"
          value={summary?.out_of_stock_products ?? products.filter((p) => p.current_stock <= 0).length}
          icon={XCircle}
          variant="destructive"
          description="Cần lập phiếu nhập bổ sung ngay"
        />
      </div>

      {/* PROMINENT STOCK ALERT BANNER */}
      {lowStockAlertItems.length > 0 && (
        <Card className="border-amber-300 bg-gradient-to-r from-amber-50/90 via-amber-50 to-orange-50/70 dark:border-amber-800 dark:from-amber-950/40 dark:via-amber-950/20 dark:to-orange-950/30 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 shrink-0">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    Cảnh báo Tồn kho Thấp ({lowStockAlertItems.length} mặt hàng cần nhập bổ sung)
                  </h3>
                  <p className="text-xs sm:text-sm text-amber-800/80 dark:text-amber-300/80 mt-1">
                    Các mặt hàng dưới đây đã chạm hoặc tụt dưới định mức tồn an toàn tối thiểu (`minimum_stock`). Vui lòng liên hệ nhà cung cấp để nhập hàng, tránh gián đoạn dịch vụ khám chữa bệnh.
                  </p>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {lowStockAlertItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-800/50 text-xs shadow-xs"
                      >
                        <div className="space-y-0.5 truncate mr-2">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                            <span className="font-mono text-amber-700 dark:text-amber-400 font-bold">
                              Tồn: {item.current_stock} {item.unit}
                            </span>
                            <span>• Min: {item.minimum_stock}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenTransaction(item, 'IN')}
                          className="h-7 text-xs px-2 shrink-0 border-amber-300 hover:bg-amber-100 hover:text-amber-900 text-amber-800 dark:border-amber-700 dark:hover:bg-amber-950"
                        >
                          <PackagePlus className="h-3 w-3 mr-1 text-emerald-600" />
                          Nhập
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setProductStockFilter('LOW_STOCK');
                    setActiveTab('products');
                  }}
                  className="text-xs h-8 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
                >
                  Xem danh sách lọc
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs Container */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'products' | 'transactions')}
        className="space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-1">
            <TabsTrigger value="products" className="gap-1.5 text-xs sm:text-sm">
              <Boxes className="h-4 w-4" />
              Danh mục Tồn kho Vật tư ({products.length})
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1.5 text-xs sm:text-sm">
              <History className="h-4 w-4" />
              Sổ cái Giao dịch Nhập / Xuất / Kiểm kê ({transactions.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: DANH MỤC SẢN PHẨM & TỒN KHO */}
        <TabsContent value="products" className="space-y-4 m-0">
          {/* Filters Bar */}
          <Card className="shadow-xs border-slate-200 dark:border-slate-800">
            <CardContent className="p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Stock Status Badges Filter */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'ALL', label: 'Tất cả trạng thái' },
                    { id: 'IN_STOCK', label: 'Đủ tồn kho' },
                    { id: 'LOW_STOCK', label: 'Cảnh báo sắp hết' },
                    { id: 'OUT_OF_STOCK', label: 'Đã hết hàng' },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setProductStockFilter(filter.id)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                        productStockFilter === filter.id
                          ? 'bg-blue-600 text-white font-semibold shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Hiệu lực:</span>
                  <select
                    value={productStatusFilter}
                    onChange={(e) => setProductStatusFilter(e.target.value)}
                    className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="ALL">Tất cả</option>
                    <option value="ACTIVE">Đang áp dụng (ACTIVE)</option>
                    <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
                  </select>
                </div>
              </div>

              {/* Quick Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Tìm theo mã thuốc/vật tư, tên sản phẩm hoặc đơn vị tính..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9 h-9.5 text-xs sm:text-sm bg-slate-50/60 dark:bg-slate-900/60"
                />
              </div>
            </CardContent>
          </Card>

          {/* Products Table */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[1050px]">
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                    <TableHead className="w-28 font-semibold whitespace-nowrap min-w-[100px]">Mã VT</TableHead>
                    <TableHead className="font-semibold min-w-[200px] whitespace-nowrap">Tên Dược phẩm / Vật tư</TableHead>
                    <TableHead className="w-24 text-center font-semibold whitespace-nowrap min-w-[80px]">Đơn vị</TableHead>
                    <TableHead className="w-28 text-right font-semibold whitespace-nowrap min-w-[110px]">Tồn hiện tại</TableHead>
                    <TableHead className="w-28 text-right font-semibold whitespace-nowrap min-w-[110px]">Định mức Min</TableHead>
                    <TableHead className="w-40 font-semibold text-center whitespace-nowrap min-w-[150px]">Tỷ lệ an toàn</TableHead>
                    <TableHead className="w-36 text-center font-semibold whitespace-nowrap min-w-[130px]">Trạng thái tồn</TableHead>
                    <TableHead className="w-28 text-center font-semibold whitespace-nowrap min-w-[100px]">Hiệu lực</TableHead>
                    <TableHead className="w-44 text-right font-semibold whitespace-nowrap min-w-[160px]">Thao tác kho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingProducts && products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-44 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                          <p className="text-sm">Đang tải danh mục tồn kho...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-44 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <Boxes className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                          <p className="text-sm font-medium">Không tìm thấy sản phẩm nào phù hợp.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleOpenAddProduct}
                            className="mt-1 text-xs"
                          >
                            Thêm sản phẩm mới ngay
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((item) => {
                      const current = Number(item.current_stock) || 0;
                      const min = Number(item.minimum_stock) || 0;
                      const ratio = min > 0 ? Math.min(100, Math.round((current / min) * 100)) : 100;

                      return (
                        <TableRow
                          key={item.id}
                          className={cn(
                            'hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors',
                            item.current_stock <= 0 && 'bg-rose-50/30 dark:bg-rose-950/10'
                          )}
                        >
                          <TableCell className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                            {item.product_code}
                          </TableCell>

                          <TableCell>
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-slate-400 whitespace-nowrap">
                              Tạo: {formatDate(item.created_at)}
                            </div>
                          </TableCell>

                          <TableCell className="text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-medium">
                              {item.unit}
                            </span>
                          </TableCell>

                          <TableCell className="text-right font-mono font-bold text-sm whitespace-nowrap">
                            <span
                              className={cn(
                                current <= 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : current <= min
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-slate-800 dark:text-slate-200'
                              )}
                            >
                              {current}
                            </span>
                          </TableCell>

                          <TableCell className="text-right font-mono text-xs text-slate-500 whitespace-nowrap">
                            {min}
                          </TableCell>

                          <TableCell className="whitespace-nowrap">
                            <div className="space-y-1 w-32 mx-auto">
                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span>{current}/{min}</span>
                                <span>{ratio}%</span>
                              </div>
                              <Progress
                                value={ratio}
                                indicatorClassName={
                                  current <= 0
                                    ? 'bg-rose-500'
                                    : current <= min
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }
                                className="h-1.5"
                              />
                            </div>
                          </TableCell>

                          <TableCell className="text-center whitespace-nowrap">
                            {renderStockBadge(item)}
                          </TableCell>

                          <TableCell className="text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleToggleProductStatus(item)}
                              title="Click để đổi trạng thái"
                              className="focus:outline-none"
                            >
                              {item.status === 'ACTIVE' ? (
                                <Badge variant="success" className="text-[11px] cursor-pointer">
                                  Áp dụng
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[11px] cursor-pointer">
                                  Tạm dừng
                                </Badge>
                              )}
                            </button>
                          </TableCell>

                          <TableCell className="text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenTransaction(item, 'IN')}
                                className="h-7 text-xs px-2 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
                                title="Nhập hoặc xuất kho"
                              >
                                <ArrowUpDown className="h-3 w-3 mr-1" />
                                Giao dịch
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenEditProduct(item)}
                                className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
                                title="Chỉnh sửa thông tin"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 2: SỔ CÁI GIAO DỊCH NHẬP / XUẤT / KIỂM KÊ */}
        <TabsContent value="transactions" className="space-y-4 m-0">
          {/* Filters Bar */}
          <Card className="shadow-xs border-slate-200 dark:border-slate-800">
            <CardContent className="p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Transaction Type Filter Tabs */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'ALL', label: 'Tất cả loại giao dịch' },
                    { id: 'IN', label: 'Nhập kho (IN)' },
                    { id: 'OUT', label: 'Xuất kho (OUT)' },
                    { id: 'ADJUST', label: 'Kiểm kê (ADJUST)' },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setTxTypeFilter(filter.id)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                        txTypeFilter === filter.id
                          ? 'bg-blue-600 text-white font-semibold shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                {/* Filter by Specific Product */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Mặt hàng:</span>
                  <select
                    value={txProductFilter}
                    onChange={(e) => setTxProductFilter(e.target.value)}
                    className="h-8 max-w-xs rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 truncate"
                  >
                    <option value="ALL">Toàn bộ mặt hàng</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.product_code} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Tìm giao dịch theo mã, tên thuốc/vật tư hoặc mã chứng từ..."
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  className="pl-9 h-9.5 text-xs sm:text-sm bg-slate-50/60 dark:bg-slate-900/60"
                />
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[1050px]">
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                    <TableHead className="w-36 font-semibold whitespace-nowrap min-w-[140px]">Thời gian</TableHead>
                    <TableHead className="w-32 font-semibold text-center whitespace-nowrap min-w-[130px]">Loại giao dịch</TableHead>
                    <TableHead className="w-28 font-semibold whitespace-nowrap min-w-[100px]">Mã VT</TableHead>
                    <TableHead className="font-semibold min-w-[200px] whitespace-nowrap">Tên Thuốc / Vật tư y tế</TableHead>
                    <TableHead className="w-28 text-right font-semibold whitespace-nowrap min-w-[110px]">Số lượng</TableHead>
                    <TableHead className="w-24 text-center font-semibold whitespace-nowrap min-w-[80px]">Đơn vị</TableHead>
                    <TableHead className="w-36 font-semibold whitespace-nowrap min-w-[120px]">Loại chứng từ</TableHead>
                    <TableHead className="w-36 font-semibold whitespace-nowrap min-w-[130px]">Người lập phiếu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingTransactions && transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-44 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                          <p className="text-sm">Đang tải lịch sử giao dịch kho...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-44 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <History className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                          <p className="text-sm font-medium">Chưa có giao dịch kho nào.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenTransaction(undefined, 'IN')}
                            className="mt-1 text-xs"
                          >
                            Tạo phiếu Nhập/Xuất kho ngay
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((tx) => {
                      const qty = Number(tx.quantity);
                      const isPositive = tx.transaction_type === 'IN' || (tx.transaction_type === 'ADJUST' && qty > 0);

                      return (
                        <TableRow
                          key={tx.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
                        >
                          <TableCell className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono">
                            {formatDateTime(tx.transaction_date || tx.created_at)}
                          </TableCell>

                          <TableCell className="text-center whitespace-nowrap">
                            {renderTxTypeBadge(tx.transaction_type)}
                          </TableCell>

                          <TableCell className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                            {tx.product_code || tx.product?.product_code || '---'}
                          </TableCell>

                          <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                            {tx.product_name || tx.product?.name || 'Mặt hàng'}
                          </TableCell>

                          <TableCell className="text-right font-mono font-bold text-sm whitespace-nowrap">
                            <span
                              className={cn(
                                tx.transaction_type === 'IN' && 'text-emerald-600 dark:text-emerald-400',
                                tx.transaction_type === 'OUT' && 'text-rose-600 dark:text-rose-400',
                                tx.transaction_type === 'ADJUST' && 'text-blue-600 dark:text-blue-400'
                              )}
                            >
                              {tx.transaction_type === 'IN'
                                ? `+${qty}`
                                : tx.transaction_type === 'OUT'
                                ? `-${qty}`
                                : qty > 0
                                ? `+${qty}`
                                : `${qty}`}
                            </span>
                          </TableCell>

                          <TableCell className="text-center text-xs text-slate-500 whitespace-nowrap">
                            {tx.product_unit || tx.product?.unit || 'Đơn vị'}
                          </TableCell>

                          <TableCell className="text-xs whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-mono">
                              {tx.reference_type || 'MANUAL'}
                            </span>
                          </TableCell>

                          <TableCell className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {tx.creator?.name || tx.creator?.username || 'Hệ thống'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* MODAL 1: THÊM / SỬA SẢN PHẨM VẬT TƯ */}
      {/* ========================================================================= */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Chỉnh sửa Sản phẩm / Vật tư' : 'Thêm Sản phẩm / Vật tư mới'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? 'Cập nhật thông tin định mức và trạng thái thuốc/vật tư trong danh mục.'
                : 'Khai báo thông tin thuốc, vật tư y tế và định mức tồn kho tối thiểu an toàn.'}
            </DialogDescription>
          </DialogHeader>

          {productFormError && (
            <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/60 dark:text-rose-200 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{productFormError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitProduct} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="product_name" className="text-xs font-semibold">
                Tên Thuốc / Vật tư y tế <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="product_name"
                required
                placeholder="VD: Paracetamol 500mg, Găng tay y tế Nitrile..."
                value={formProductName}
                onChange={(e) => setFormProductName(e.target.value)}
                className="text-xs sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="product_code" className="text-xs font-semibold">
                  Mã sản phẩm (Tự sinh nếu trống)
                </Label>
                <Input
                  id="product_code"
                  placeholder="VD: PRD-000001"
                  value={formProductCode}
                  onChange={(e) => setFormProductCode(e.target.value.toUpperCase())}
                  className="font-mono text-xs sm:text-sm uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="product_unit" className="text-xs font-semibold">
                  Đơn vị tính <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="product_unit"
                  required
                  placeholder="Viên, Hộp, Chai, Ống..."
                  value={formProductUnit}
                  onChange={(e) => setFormProductUnit(e.target.value)}
                  className="text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="minimum_stock" className="text-xs font-semibold">
                  Định mức tồn tối thiểu (Min)
                </Label>
                <Input
                  id="minimum_stock"
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={formProductMinStock}
                  onChange={(e) => setFormProductMinStock(e.target.value === '' ? '' : Number(e.target.value))}
                  className="text-xs sm:text-sm"
                />
                <p className="text-[11px] text-slate-400">
                  Hệ thống cảnh báo khi tồn &le; mức này.
                </p>
              </div>

              {!editingProduct ? (
                <div className="space-y-1.5">
                  <Label htmlFor="initial_stock" className="text-xs font-semibold">
                    Tồn kho ban đầu (Nhập đầu kỳ)
                  </Label>
                  <Input
                    id="initial_stock"
                    type="number"
                    min="0"
                    step="any"
                    value={formProductInitialStock}
                    onChange={(e) => setFormProductInitialStock(e.target.value === '' ? '' : Number(e.target.value))}
                    className="text-xs sm:text-sm"
                  />
                  <p className="text-[11px] text-slate-400">
                    Tự sinh 1 giao dịch Nhập kho đầu kỳ.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="product_status" className="text-xs font-semibold">
                    Trạng thái áp dụng
                  </Label>
                  <select
                    id="product_status"
                    value={formProductStatus}
                    onChange={(e) => setFormProductStatus(e.target.value as ProductStatus)}
                    className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="ACTIVE">ACTIVE (Đang sử dụng)</option>
                    <option value="INACTIVE">INACTIVE (Tạm ngưng)</option>
                  </select>
                </div>
              )}
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsProductModalOpen(false)}
                disabled={productSubmitting}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={productSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {productSubmitting && <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {editingProduct ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: TẠO PHIẾU NHẬP / XUẤT / ĐIỀU CHỈNH KHO (CHỐNG ÂM KHO) */}
      {/* ========================================================================= */}
      <Dialog open={isTxModalOpen} onOpenChange={setIsTxModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5 text-blue-600" />
              Tạo Phiếu Biến Động Kho Y Tế
            </DialogTitle>
            <DialogDescription>
              Thực hiện Nhập kho, Xuất kho sử dụng hoặc Điều chỉnh kiểm kê định kỳ với cơ chế bảo vệ chống âm kho.
            </DialogDescription>
          </DialogHeader>

          {txFormError && (
            <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/60 dark:text-rose-200 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{txFormError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitTransaction} className="space-y-4">
            {/* 1. Chọn Sản phẩm */}
            <div className="space-y-1.5">
              <Label htmlFor="tx_product_id" className="text-xs font-semibold">
                Mặt hàng Thuốc / Vật tư <span className="text-rose-500">*</span>
              </Label>
              <select
                id="tx_product_id"
                required
                value={formTxProductId}
                onChange={(e) => handleTxProductChange(Number(e.target.value))}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="">-- Chọn sản phẩm vật tư --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.product_code}] {p.name} (Tồn hiện tại: {p.current_stock} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* Thông tin tồn kho hiện tại của sản phẩm được chọn */}
            {txSelectedProduct && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Mặt hàng đang chọn:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {txSelectedProduct.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Tồn kho hiện tại:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {txSelectedProduct.current_stock} {txSelectedProduct.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Định mức an toàn (Min):</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {txSelectedProduct.minimum_stock} {txSelectedProduct.unit}
                  </span>
                </div>
              </div>
            )}

            {/* 2. Loại giao dịch */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Loại giao dịch <span className="text-rose-500">*</span>
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormTxType('IN');
                    setFormTxRefType('PURCHASE_ORDER');
                  }}
                  className={cn(
                    'flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all',
                    formTxType === 'IN'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold dark:bg-emerald-950 dark:text-emerald-200 shadow-xs ring-1 ring-emerald-500'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:text-slate-300'
                  )}
                >
                  <PackagePlus className="h-4 w-4 mb-1 text-emerald-600" />
                  Nhập kho (+)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormTxType('OUT');
                    setFormTxRefType('CLINIC_CONSUMPTION');
                  }}
                  className={cn(
                    'flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all',
                    formTxType === 'OUT'
                      ? 'border-rose-500 bg-rose-50 text-rose-800 font-bold dark:bg-rose-950 dark:text-rose-200 shadow-xs ring-1 ring-rose-500'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:text-slate-300'
                  )}
                >
                  <PackageMinus className="h-4 w-4 mb-1 text-rose-600" />
                  Xuất kho (-)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormTxType('ADJUST');
                    setFormTxRefType('STOCKTAKE_ADJUST');
                  }}
                  className={cn(
                    'flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all',
                    formTxType === 'ADJUST'
                      ? 'border-blue-500 bg-blue-50 text-blue-800 font-bold dark:bg-blue-950 dark:text-blue-200 shadow-xs ring-1 ring-blue-500'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:text-slate-300'
                  )}
                >
                  <ArrowUpDown className="h-4 w-4 mb-1 text-blue-600" />
                  Kiểm kê (+/-)
                </button>
              </div>
            </div>

            {/* 3. Số lượng & Chứng từ */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tx_quantity" className="text-xs font-semibold">
                  {formTxType === 'ADJUST' ? 'Độ lệch (+ hoặc -)' : 'Số lượng'} <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="tx_quantity"
                  type="number"
                  step="any"
                  required
                  placeholder={formTxType === 'ADJUST' ? 'VD: -5 hoặc 10' : 'VD: 50'}
                  value={formTxQuantity}
                  onChange={(e) => setFormTxQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  className="text-xs sm:text-sm font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tx_ref_type" className="text-xs font-semibold">
                  Lý do / Loại chứng từ
                </Label>
                <select
                  id="tx_ref_type"
                  value={formTxRefType}
                  onChange={(e) => setFormTxRefType(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {formTxType === 'IN' && (
                    <>
                      <option value="PURCHASE_ORDER">Nhập mua nhà cung cấp</option>
                      <option value="SUPPLIER_RETURN">Nhà cung cấp bù hàng</option>
                      <option value="INITIAL_STOCK">Tồn kho đầu kỳ</option>
                      <option value="OTHER_IN">Nhập khác</option>
                    </>
                  )}
                  {formTxType === 'OUT' && (
                    <>
                      <option value="CLINIC_CONSUMPTION">Xuất tiêu hao phòng khám</option>
                      <option value="PRESCRIPTION">Xuất theo đơn thuốc</option>
                      <option value="DAMAGE_LOSS">Hư hỏng / Hết hạn sử dụng</option>
                      <option value="RETURN_SUPPLIER">Trả lại nhà cung cấp</option>
                      <option value="OTHER_OUT">Xuất khác</option>
                    </>
                  )}
                  {formTxType === 'ADJUST' && (
                    <>
                      <option value="STOCKTAKE_ADJUST">Điều chỉnh kiểm kê định kỳ</option>
                      <option value="INVENTORY_RECONCILE">Đối soát chênh lệch sổ cái</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* REAL-TIME STOCK PREVIEW & VALIDATION CALLOUT */}
            {txSelectedProduct && formTxQuantity !== '' && (
              <div
                className={cn(
                  'p-3.5 rounded-lg border text-xs space-y-2 transition-all',
                  !stockCalculation.isValid
                    ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
                    : stockCalculation.projectedStock <= txSelectedProduct.minimum_stock
                    ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                )}
              >
                <div className="flex items-center justify-between font-medium">
                  <span>Dự kiến tồn kho sau giao dịch:</span>
                  <span className="font-mono font-bold text-sm">
                    {stockCalculation.projectedStock} {txSelectedProduct.unit}
                  </span>
                </div>

                {!stockCalculation.isValid ? (
                  <div className="flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-400">
                    <XCircle className="h-4 w-4 shrink-0" />
                    <span>{stockCalculation.errorMessage}</span>
                  </div>
                ) : stockCalculation.projectedStock <= 0 ? (
                  <div className="flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Mặt hàng sẽ HẾT TỒN KHO sau khi giao dịch này hoàn thành!</span>
                  </div>
                ) : stockCalculation.projectedStock <= txSelectedProduct.minimum_stock ? (
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>Tồn kho mới sẽ tụt xuống dưới định mức tối thiểu ({txSelectedProduct.minimum_stock} {txSelectedProduct.unit}). Hệ thống sẽ tự động phát cảnh báo.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Mức tồn kho an toàn sau giao dịch.</span>
                  </div>
                )}
              </div>
            )}

            {/* 4. Ngày giao dịch & Ghi chú */}
            <div className="space-y-1.5">
              <Label htmlFor="tx_date" className="text-xs font-semibold">
                Thời gian giao dịch
              </Label>
              <Input
                id="tx_date"
                type="datetime-local"
                value={formTxDate}
                onChange={(e) => setFormTxDate(e.target.value)}
                className="text-xs sm:text-sm"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsTxModalOpen(false)}
                disabled={txSubmitting}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={txSubmitting || !stockCalculation.isValid || formTxQuantity === ''}
                className={cn(
                  'text-white',
                  formTxType === 'IN'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : formTxType === 'OUT'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                )}
              >
                {txSubmitting && <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Xác nhận {formTxType === 'IN' ? 'Nhập kho' : formTxType === 'OUT' ? 'Xuất kho' : 'Điều chỉnh'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
