export type ProductStatus = 'ACTIVE' | 'INACTIVE';

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export type InventoryTransactionType = 'IN' | 'OUT' | 'ADJUST';

export interface Product {
  id: number;
  product_code: string;
  name: string;
  unit: string;
  minimum_stock: number;
  current_stock: number;
  stock_status: StockStatus;
  is_low_stock: boolean;
  status: ProductStatus;
  created_at: string | null;
  updated_at: string | null;
}

export interface InventoryTransaction {
  id: number;
  product_id: number;
  product_code?: string | null;
  product_name?: string | null;
  product_unit?: string | null;
  transaction_type: InventoryTransactionType;
  quantity: number;
  reference_type?: string | null;
  reference_id?: number | null;
  transaction_date: string | null;
  created_by?: number | null;
  created_at: string | null;
  product?: Product | null;
  creator?: {
    id: number;
    username?: string;
    email?: string;
    name?: string;
  } | null;
}

export interface InventorySummary {
  total_products: number;
  in_stock_products: number;
  low_stock_products: number;
  out_of_stock_products: number;
  total_items?: number;
  in_stock_count?: number;
  low_stock_count?: number;
  out_of_stock_count?: number;
  total_transactions?: number;
  total_in_transactions?: number;
  total_out_transactions?: number;
  total_adjust_transactions?: number;
  total_in_quantity?: number;
  total_out_quantity?: number;
  total_adjust_quantity?: number;
}

export interface CreateProductInput {
  product_code?: string;
  name: string;
  unit: string;
  minimum_stock?: number;
  status?: ProductStatus;
  initial_stock?: number;
}

export interface UpdateProductInput {
  product_code?: string;
  name?: string;
  unit?: string;
  minimum_stock?: number;
  status?: ProductStatus;
}

export interface CreateInventoryTransactionInput {
  product_id: number;
  transaction_type: InventoryTransactionType;
  quantity: number;
  reference_type?: string | null;
  reference_id?: number | null;
  transaction_date?: string;
}

export interface ProductsQueryParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  stock_status?: string;
  low_stock_only?: boolean | string | number;
  sort_by?: string;
  order?: 'asc' | 'desc';
}

export interface InventoryTransactionsQueryParams {
  page?: number;
  per_page?: number;
  search?: string;
  product_id?: number;
  transaction_type?: InventoryTransactionType | string;
  start_date?: string;
  end_date?: string;
  sort_by?: string;
  order?: 'asc' | 'desc';
}
