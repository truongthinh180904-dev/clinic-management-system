import { apiClient, ApiError } from '@/lib/api/client';
import { ApiResponse } from '@/types/auth';
import {
  CreateInventoryTransactionInput,
  CreateProductInput,
  InventorySummary,
  InventoryTransaction,
  InventoryTransactionsQueryParams,
  Product,
  ProductsQueryParams,
  ProductStatus,
  UpdateProductInput,
} from '@/types/inventory';

/**
 * Build URL query string from parameter object.
 */
function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

// In-memory fallback products for offline development or testing
let fallbackProducts: Product[] = [
  {
    id: 1,
    product_code: 'PRD-000001',
    name: 'Paracetamol 500mg (Viên nén)',
    unit: 'Viên',
    minimum_stock: 100,
    current_stock: 450,
    stock_status: 'IN_STOCK',
    is_low_stock: false,
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 2,
    product_code: 'PRD-000002',
    name: 'Kháng sinh Augmentin 1g (Hộp 14 viên)',
    unit: 'Hộp',
    minimum_stock: 20,
    current_stock: 12,
    stock_status: 'LOW_STOCK',
    is_low_stock: true,
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 3,
    product_code: 'PRD-000003',
    name: 'Găng tay y tế Nitrile không bột (Hộp 100 chiếc)',
    unit: 'Hộp',
    minimum_stock: 30,
    current_stock: 5,
    stock_status: 'LOW_STOCK',
    is_low_stock: true,
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 4,
    product_code: 'PRD-000004',
    name: 'Bơm kim tiêm vô trùng 5ml (Hộp 100 chiếc)',
    unit: 'Hộp',
    minimum_stock: 15,
    current_stock: 45,
    stock_status: 'IN_STOCK',
    is_low_stock: false,
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 18 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: 5,
    product_code: 'PRD-000005',
    name: 'Cồn đỏ sát khuẩn Povidone Iodine 10% 500ml',
    unit: 'Chai',
    minimum_stock: 10,
    current_stock: 0,
    stock_status: 'OUT_OF_STOCK',
    is_low_stock: true,
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 6,
    product_code: 'PRD-000006',
    name: 'Băng dán cá nhân y tế Urgo (Hộp 100 miếng)',
    unit: 'Hộp',
    minimum_stock: 25,
    current_stock: 80,
    stock_status: 'IN_STOCK',
    is_low_stock: false,
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
];

let fallbackTransactions: InventoryTransaction[] = [
  {
    id: 1,
    product_id: 1,
    product_code: 'PRD-000001',
    product_name: 'Paracetamol 500mg (Viên nén)',
    product_unit: 'Viên',
    transaction_type: 'IN',
    quantity: 500,
    reference_type: 'INITIAL_STOCK',
    reference_id: 1,
    transaction_date: new Date(Date.now() - 25 * 86400000).toISOString(),
    created_by: 1,
    creator: { id: 1, name: 'DS. Nguyễn Thị Mai' },
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: 2,
    product_id: 1,
    product_code: 'PRD-000001',
    product_name: 'Paracetamol 500mg (Viên nén)',
    product_unit: 'Viên',
    transaction_type: 'OUT',
    quantity: 50,
    reference_type: 'PRESCRIPTION',
    reference_id: 101,
    transaction_date: new Date(Date.now() - 5 * 86400000).toISOString(),
    created_by: 1,
    creator: { id: 1, name: 'DS. Nguyễn Thị Mai' },
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 3,
    product_id: 2,
    product_code: 'PRD-000002',
    product_name: 'Kháng sinh Augmentin 1g (Hộp 14 viên)',
    product_unit: 'Hộp',
    transaction_type: 'IN',
    quantity: 20,
    reference_type: 'PURCHASE_ORDER',
    reference_id: 202,
    transaction_date: new Date(Date.now() - 15 * 86400000).toISOString(),
    created_by: 1,
    creator: { id: 1, name: 'DS. Nguyễn Thị Mai' },
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: 4,
    product_id: 2,
    product_code: 'PRD-000002',
    product_name: 'Kháng sinh Augmentin 1g (Hộp 14 viên)',
    product_unit: 'Hộp',
    transaction_type: 'OUT',
    quantity: 8,
    reference_type: 'PRESCRIPTION',
    reference_id: 104,
    transaction_date: new Date(Date.now() - 2 * 86400000).toISOString(),
    created_by: 1,
    creator: { id: 1, name: 'DS. Nguyễn Thị Mai' },
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 5,
    product_id: 3,
    product_code: 'PRD-000003',
    product_name: 'Găng tay y tế Nitrile không bột (Hộp 100 chiếc)',
    product_unit: 'Hộp',
    transaction_type: 'OUT',
    quantity: 25,
    reference_type: 'CLINIC_CONSUMPTION',
    reference_id: 301,
    transaction_date: new Date(Date.now() - 1 * 86400000).toISOString(),
    created_by: 1,
    creator: { id: 1, name: 'Điều dưỡng trưởng' },
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 6,
    product_id: 5,
    product_code: 'PRD-000005',
    product_name: 'Cồn đỏ sát khuẩn Povidone Iodine 10% 500ml',
    product_unit: 'Chai',
    transaction_type: 'ADJUST',
    quantity: -5,
    reference_type: 'STOCKTAKE_ADJUST',
    reference_id: 401,
    transaction_date: new Date(Date.now() - 3 * 86400000).toISOString(),
    created_by: 1,
    creator: { id: 1, name: 'Ban kiểm kê kho' },
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

/**
 * Recalculate product stock status based on current and minimum stock.
 */
function updateProductStockState(product: Product) {
  const current = Number(product.current_stock) || 0;
  const min = Number(product.minimum_stock) || 0;
  product.is_low_stock = current <= min;
  if (current <= 0) {
    product.stock_status = 'OUT_OF_STOCK';
  } else if (current <= min) {
    product.stock_status = 'LOW_STOCK';
  } else {
    product.stock_status = 'IN_STOCK';
  }
}

/**
 * Fetch warehouse summary statistics.
 */
export async function getInventorySummary(params?: {
  start_date?: string;
  end_date?: string;
  from_date?: string;
  to_date?: string;
}): Promise<ApiResponse<InventorySummary>> {
  const query = buildQueryString(params as Record<string, unknown>);
  try {
    const res = await apiClient.get<InventorySummary>(`/inventory/summary${query}`);
    if (res.data) return res;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn('API /inventory/summary unavailable, using fallback', err);
    }
  }

  // Calculate from fallback
  let inStock = 0;
  let lowStock = 0;
  let outOfStock = 0;

  fallbackProducts.forEach((p) => {
    updateProductStockState(p);
    if (p.current_stock <= 0) {
      outOfStock++;
    } else if (p.is_low_stock) {
      lowStock++;
    } else {
      inStock++;
    }
  });

  const totalIn = fallbackTransactions.filter((t) => t.transaction_type === 'IN').length;
  const totalOut = fallbackTransactions.filter((t) => t.transaction_type === 'OUT').length;
  const totalAdjust = fallbackTransactions.filter((t) => t.transaction_type === 'ADJUST').length;

  return {
    success: true,
    message: 'Lấy thống kê tổng quan kho thành công.',
    data: {
      total_products: fallbackProducts.length,
      in_stock_products: inStock,
      low_stock_products: lowStock,
      out_of_stock_products: outOfStock,
      total_items: fallbackProducts.length,
      in_stock_count: inStock,
      low_stock_count: lowStock,
      out_of_stock_count: outOfStock,
      total_transactions: fallbackTransactions.length,
      total_in_transactions: totalIn,
      total_out_transactions: totalOut,
      total_adjust_transactions: totalAdjust,
    },
  };
}

/**
 * Fetch products list with filters and pagination.
 */
export async function getProducts(
  params?: ProductsQueryParams
): Promise<ApiResponse<Product[]>> {
  const query = buildQueryString(params as Record<string, unknown>);
  try {
    const res = await apiClient.get<Product[]>(`/products${query}`);
    if (res.data) return res;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn('API /products unavailable, using fallback', err);
    }
  }

  // Filter fallback products
  let list = [...fallbackProducts];
  list.forEach(updateProductStockState);

  if (params?.status) {
    list = list.filter((p) => p.status === params.status);
  }
  if (params?.stock_status) {
    list = list.filter((p) => p.stock_status === params.stock_status);
  }
  if (params?.low_stock_only) {
    list = list.filter((p) => p.is_low_stock);
  }
  if (params?.search) {
    const q = params.search.toLowerCase();
    list = list.filter(
      (p) =>
        p.product_code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.unit.toLowerCase().includes(q)
    );
  }

  return {
    success: true,
    message: 'Lấy danh mục sản phẩm thành công.',
    data: list,
    meta: {
      current_page: 1,
      from: 1,
      last_page: 1,
      per_page: list.length || 15,
      to: list.length,
      total: list.length,
    },
  };
}

/**
 * Fetch a single product by ID.
 */
export async function getProduct(id: number | string): Promise<ApiResponse<Product>> {
  try {
    const res = await apiClient.get<Product>(`/products/${id}`);
    if (res.data) return res;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn(`API /products/${id} unavailable, using fallback`, err);
    }
  }

  const p = fallbackProducts.find((item) => String(item.id) === String(id));
  if (!p) {
    throw new ApiError('Không tìm thấy sản phẩm.', 404);
  }
  updateProductStockState(p);
  return {
    success: true,
    message: 'Lấy thông tin chi tiết sản phẩm thành công.',
    data: p,
  };
}

/**
 * Create a new product.
 */
export async function createProduct(
  input: CreateProductInput
): Promise<ApiResponse<Product>> {
  try {
    const res = await apiClient.post<Product>('/products', input);
    if (res.data) {
      fallbackProducts.unshift(res.data);
      return res;
    }
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn('POST /products API unavailable, creating in-memory', err);
    }
  }

  const newId = Date.now();
  const initStock = Number(input.initial_stock) || 0;
  const minStock = Number(input.minimum_stock) || 0;
  const newProduct: Product = {
    id: newId,
    product_code:
      input.product_code ||
      `PRD-${String(fallbackProducts.length + 1).padStart(6, '0')}`,
    name: input.name,
    unit: input.unit,
    minimum_stock: minStock,
    current_stock: initStock,
    stock_status: initStock <= 0 ? 'OUT_OF_STOCK' : initStock <= minStock ? 'LOW_STOCK' : 'IN_STOCK',
    is_low_stock: initStock <= minStock,
    status: input.status || 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  fallbackProducts.unshift(newProduct);

  if (initStock > 0) {
    fallbackTransactions.unshift({
      id: Date.now(),
      product_id: newId,
      product_code: newProduct.product_code,
      product_name: newProduct.name,
      product_unit: newProduct.unit,
      transaction_type: 'IN',
      quantity: initStock,
      reference_type: 'INITIAL_STOCK',
      reference_id: newId,
      transaction_date: new Date().toISOString(),
      created_by: 1,
      creator: { id: 1, name: 'Quản trị viên' },
      created_at: new Date().toISOString(),
    });
  }

  return {
    success: true,
    message: 'Tạo sản phẩm mới thành công.',
    data: newProduct,
  };
}

/**
 * Update an existing product.
 */
export async function updateProduct(
  id: number | string,
  input: UpdateProductInput
): Promise<ApiResponse<Product>> {
  try {
    const res = await apiClient.put<Product>(`/products/${id}`, input);
    if (res.data) {
      const idx = fallbackProducts.findIndex((p) => String(p.id) === String(id));
      if (idx !== -1) fallbackProducts[idx] = res.data;
      return res;
    }
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn(`PUT /products/${id} API unavailable, updating in-memory`, err);
    }
  }

  const idx = fallbackProducts.findIndex((p) => String(p.id) === String(id));
  if (idx === -1) {
    throw new ApiError('Không tìm thấy sản phẩm để cập nhật.', 404);
  }

  const existing = fallbackProducts[idx];
  const updated: Product = {
    ...existing,
    name: input.name !== undefined ? input.name : existing.name,
    unit: input.unit !== undefined ? input.unit : existing.unit,
    product_code: input.product_code !== undefined ? input.product_code : existing.product_code,
    minimum_stock: input.minimum_stock !== undefined ? Number(input.minimum_stock) : existing.minimum_stock,
    status: input.status !== undefined ? input.status : existing.status,
    updated_at: new Date().toISOString(),
  };
  updateProductStockState(updated);
  fallbackProducts[idx] = updated;

  return {
    success: true,
    message: 'Cập nhật sản phẩm thành công.',
    data: updated,
  };
}

/**
 * Update product status (ACTIVE / INACTIVE).
 */
export async function updateProductStatus(
  id: number | string,
  status: ProductStatus
): Promise<ApiResponse<Product>> {
  try {
    const res = await apiClient.patch<Product>(`/products/${id}/status`, { status });
    if (res.data) {
      const idx = fallbackProducts.findIndex((p) => String(p.id) === String(id));
      if (idx !== -1) fallbackProducts[idx] = res.data;
      return res;
    }
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn(`PATCH /products/${id}/status API unavailable, updating in-memory`, err);
    }
  }

  const idx = fallbackProducts.findIndex((p) => String(p.id) === String(id));
  if (idx === -1) {
    throw new ApiError('Không tìm thấy sản phẩm.', 404);
  }
  fallbackProducts[idx].status = status;
  fallbackProducts[idx].updated_at = new Date().toISOString();

  return {
    success: true,
    message: 'Cập nhật trạng thái sản phẩm thành công.',
    data: fallbackProducts[idx],
  };
}

/**
 * Delete a product (only if no transaction history exists).
 */
export async function deleteProduct(id: number | string): Promise<ApiResponse<null>> {
  try {
    const res = await apiClient.delete<null>(`/products/${id}`);
    const idx = fallbackProducts.findIndex((p) => String(p.id) === String(id));
    if (idx !== -1) fallbackProducts.splice(idx, 1);
    return res;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn(`DELETE /products/${id} API failed`, err);
      throw err;
    }
  }

  const hasTx = fallbackTransactions.some((t) => String(t.product_id) === String(id));
  if (hasTx) {
    throw new ApiError(
      'Không thể xóa sản phẩm đã có lịch sử biến động kho. Vui lòng chuyển trạng thái sang INACTIVE.',
      422
    );
  }

  const idx = fallbackProducts.findIndex((p) => String(p.id) === String(id));
  if (idx !== -1) fallbackProducts.splice(idx, 1);

  return {
    success: true,
    message: 'Xóa sản phẩm thành công.',
    data: null,
  };
}

/**
 * Fetch inventory transactions history.
 */
export async function getInventoryTransactions(
  params?: InventoryTransactionsQueryParams
): Promise<ApiResponse<InventoryTransaction[]>> {
  const query = buildQueryString(params as Record<string, unknown>);
  try {
    const res = await apiClient.get<InventoryTransaction[]>(`/inventory-transactions${query}`);
    if (res.data) return res;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn('API /inventory-transactions unavailable, using fallback', err);
    }
  }

  let list = [...fallbackTransactions];
  if (params?.product_id) {
    list = list.filter((t) => String(t.product_id) === String(params.product_id));
  }
  if (params?.transaction_type) {
    list = list.filter((t) => t.transaction_type === params.transaction_type);
  }
  if (params?.search) {
    const q = params.search.toLowerCase();
    list = list.filter(
      (t) =>
        (t.product_name && t.product_name.toLowerCase().includes(q)) ||
        (t.product_code && t.product_code.toLowerCase().includes(q)) ||
        (t.reference_type && t.reference_type.toLowerCase().includes(q))
    );
  }

  return {
    success: true,
    message: 'Lấy danh sách giao dịch kho thành công.',
    data: list,
    meta: {
      current_page: 1,
      from: 1,
      last_page: 1,
      per_page: list.length || 15,
      to: list.length,
      total: list.length,
    },
  };
}

/**
 * Create a new inventory transaction (IN, OUT, ADJUST) with negative-stock prevention.
 */
export async function createInventoryTransaction(
  input: CreateInventoryTransactionInput
): Promise<ApiResponse<InventoryTransaction>> {
  try {
    const res = await apiClient.post<InventoryTransaction>('/inventory-transactions', input);
    if (res.data) {
      // Sync local product stock
      const p = fallbackProducts.find((item) => item.id === Number(input.product_id));
      if (p) {
        if (input.transaction_type === 'IN') {
          p.current_stock += Number(input.quantity);
        } else if (input.transaction_type === 'OUT') {
          p.current_stock -= Number(input.quantity);
        } else if (input.transaction_type === 'ADJUST') {
          p.current_stock += Number(input.quantity);
        }
        updateProductStockState(p);
      }
      fallbackTransactions.unshift(res.data);
      return res;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 422) {
      throw err; // Re-throw validation errors (such as insufficient stock)
    }
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn('POST /inventory-transactions API unavailable, creating in-memory', err);
    }
  }

  const product = fallbackProducts.find((p) => p.id === Number(input.product_id));
  if (!product) {
    throw new ApiError('Không tìm thấy sản phẩm.', 404);
  }

  const qty = Number(input.quantity);
  const current = Number(product.current_stock) || 0;

  if (input.transaction_type === 'OUT') {
    if (qty <= 0) {
      throw new ApiError('Số lượng xuất kho phải lớn hơn 0.', 422);
    }
    if (qty > current) {
      throw new ApiError(
        `Số lượng xuất kho (${qty}) vượt quá số lượng tồn hiện tại (${current}).`,
        422
      );
    }
    product.current_stock = Math.round((current - qty) * 1000) / 1000;
  } else if (input.transaction_type === 'ADJUST') {
    if (qty === 0) {
      throw new ApiError('Số lượng điều chỉnh kiểm kê không được bằng 0.', 422);
    }
    const nextStock = Math.round((current + qty) * 1000) / 1000;
    if (nextStock < 0) {
      throw new ApiError(
        `Tồn kho sau điều chỉnh không được nhỏ hơn 0 (tồn hiện tại: ${current}, chênh lệch: ${qty}).`,
        422
      );
    }
    product.current_stock = nextStock;
  } else {
    // 'IN'
    if (qty <= 0) {
      throw new ApiError('Số lượng nhập kho phải lớn hơn 0.', 422);
    }
    product.current_stock = Math.round((current + qty) * 1000) / 1000;
  }

  updateProductStockState(product);

  const newTx: InventoryTransaction = {
    id: Date.now(),
    product_id: product.id,
    product_code: product.product_code,
    product_name: product.name,
    product_unit: product.unit,
    transaction_type: input.transaction_type,
    quantity: qty,
    reference_type: input.reference_type || 'MANUAL',
    reference_id: input.reference_id || null,
    transaction_date: input.transaction_date || new Date().toISOString(),
    created_by: 1,
    creator: { id: 1, name: 'Quản lý kho' },
    created_at: new Date().toISOString(),
    product: { ...product },
  };

  fallbackTransactions.unshift(newTx);

  return {
    success: true,
    message: 'Giao dịch kho đã được thực hiện thành công.',
    data: newTx,
  };
}
