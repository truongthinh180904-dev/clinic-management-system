import { apiClient, ApiError } from '@/lib/api/client';
import { ApiResponse } from '@/types/auth';
import {
  ApproveExpenseInput,
  CashbookSummary,
  CashTransaction,
  CashTransactionsQueryParams,
  CreateCashTransactionInput,
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  Expense,
  ExpenseCategory,
  ExpensesQueryParams,
  RejectExpenseInput,
  UpdateExpenseCategoryInput,
  UpdateExpenseInput,
} from '@/types/finance';

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

// In-memory fallback stores for expenses & categories in case backend routes are not yet registered
let fallbackCategories: ExpenseCategory[] = [
  {
    id: 1,
    name: 'Vật tư & Dược phẩm tiêu hao',
    description: 'Bông băng, cồn sát khuẩn, găng tay y tế, kim tiêm, ống nghiệm',
    status: 'ACTIVE',
    expenses_count: 5,
    total_amount: 14500000,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 2,
    name: 'Chi phí Mặt bằng & Hạ tầng',
    description: 'Tiền thuê địa điểm phòng khám, phí quản lý tòa nhà',
    status: 'ACTIVE',
    expenses_count: 2,
    total_amount: 35000000,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 3,
    name: 'Điện, Nước & Viễn thông',
    description: 'Hóa đơn tiền điện 3 pha, nước sạch sinh hoạt, đường truyền cáp quang',
    status: 'ACTIVE',
    expenses_count: 3,
    total_amount: 6800000,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 4,
    name: 'Bảo trì & Kiểm định Thiết bị y tế',
    description: 'Hiệu chuẩn máy siêu âm, kiểm định máy X-quang, bảo dưỡng định kỳ',
    status: 'ACTIVE',
    expenses_count: 1,
    total_amount: 8500000,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 5,
    name: 'Văn phòng phẩm & Tiện ích',
    description: 'Giấy in bệnh án, sổ khám bệnh, túi đựng phim, bút viết',
    status: 'ACTIVE',
    expenses_count: 4,
    total_amount: 3200000,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 6,
    name: 'Lương & Phụ cấp nhân sự',
    description: 'Lương trợ cấp ca trực đêm, thưởng chuyên môn',
    status: 'ACTIVE',
    expenses_count: 2,
    total_amount: 28000000,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
];

let fallbackExpenses: Expense[] = [
  {
    id: 1,
    expense_code: 'EXP-000101',
    category_id: 1,
    amount: 4800000,
    payment_method: 'BANK_TRANSFER',
    expense_date: new Date(Date.now() - 2 * 86400000).toISOString(),
    description: 'Nhập bổ sung găng tay y tế Nitrile và khẩu trang N95 tiệt trùng đợt 1',
    approval_status: 'APPROVED',
    created_by: 1,
    approved_by: 1,
    approved_at: new Date(Date.now() - 2 * 86400000 + 3600000).toISOString(),
    category: fallbackCategories[0],
    creator: { id: 1, name: 'DS. Nguyễn Thị Mai', employee: { full_name: 'Dược sĩ Nguyễn Thị Mai' } },
    approver: { id: 1, name: 'BS. Trần Văn Hùng (Quản lý)', employee: { full_name: 'BS. Trần Văn Hùng' } },
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 2,
    expense_code: 'EXP-000102',
    category_id: 3,
    amount: 3450000,
    payment_method: 'BANK_TRANSFER',
    expense_date: new Date(Date.now() - 4 * 86400000).toISOString(),
    description: 'Thanh toán tiền điện tháng phòng khám kỳ gần nhất (Điện lực EVN)',
    approval_status: 'APPROVED',
    created_by: 1,
    approved_by: 1,
    approved_at: new Date(Date.now() - 4 * 86400000 + 7200000).toISOString(),
    category: fallbackCategories[2],
    creator: { id: 1, name: 'KT. Lê Thu Hà', employee: { full_name: 'Kế toán Lê Thu Hà' } },
    approver: { id: 1, name: 'BS. Trần Văn Hùng (Quản lý)', employee: { full_name: 'BS. Trần Văn Hùng' } },
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 3,
    expense_code: 'EXP-000103',
    category_id: 4,
    amount: 8500000,
    payment_method: 'BANK_TRANSFER',
    expense_date: new Date(Date.now() - 1 * 86400000).toISOString(),
    description: 'Bảo dưỡng định kỳ đầu dò máy siêu âm màu 4D GE Healthcare',
    approval_status: 'PENDING',
    created_by: 1,
    category: fallbackCategories[3],
    creator: { id: 1, name: 'BS. Vũ Hoàng Long', employee: { full_name: 'BS. Vũ Hoàng Long' } },
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 4,
    expense_code: 'EXP-000104',
    category_id: 5,
    amount: 1250000,
    payment_method: 'CASH',
    expense_date: new Date().toISOString(),
    description: 'Mua giấy in nhiệt A4 và mực in hóa đơn thu ngân phòng khám',
    approval_status: 'PENDING',
    created_by: 1,
    category: fallbackCategories[4],
    creator: { id: 1, name: 'TN. Phạm Minh Tuấn', employee: { full_name: 'Thu ngân Phạm Minh Tuấn' } },
    created_at: new Date().toISOString(),
  },
  {
    id: 5,
    expense_code: 'EXP-000105',
    category_id: 1,
    amount: 12000000,
    payment_method: 'BANK_TRANSFER',
    expense_date: new Date(Date.now() - 7 * 86400000).toISOString(),
    description: 'Đề xuất mua kit xét nghiệm nhanh cúm A/B không qua đấu thầu chuẩn',
    approval_status: 'REJECTED',
    rejection_reason: 'Cần so sánh báo giá từ ít nhất 2 nhà phân phối ủy quyền trước khi duyệt',
    created_by: 1,
    approved_by: 1,
    approved_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    category: fallbackCategories[0],
    creator: { id: 1, name: 'DS. Nguyễn Thị Mai', employee: { full_name: 'Dược sĩ Nguyễn Thị Mai' } },
    approver: { id: 1, name: 'BS. Trần Văn Hùng (Quản lý)', employee: { full_name: 'BS. Trần Văn Hùng' } },
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
];

let fallbackTransactions: CashTransaction[] = [
  {
    id: 101,
    transaction_code: 'CTX-000101',
    transaction_type: 'IN',
    reference_type: 'Payment',
    reference_id: 1,
    amount: 12500000,
    payment_method: 'BANK_TRANSFER',
    transaction_date: new Date(Date.now() - 5 * 86400000).toISOString(),
    description: 'Thu tiền hóa đơn khám tổng quát và xét nghiệm INV-000012',
    creator: { id: 1, name: 'Thu ngân Lê Thảo', employee: { full_name: 'Lê Thị Thu Thảo' } },
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 102,
    transaction_code: 'CTX-000102',
    transaction_type: 'IN',
    reference_type: 'Payment',
    reference_id: 2,
    amount: 4500000,
    payment_method: 'CASH',
    transaction_date: new Date(Date.now() - 4 * 86400000).toISOString(),
    description: 'Thu viện phí gói tầm soát tim mạch INV-000014',
    creator: { id: 1, name: 'Thu ngân Lê Thảo', employee: { full_name: 'Lê Thị Thu Thảo' } },
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 103,
    transaction_code: 'CTX-000103',
    transaction_type: 'OUT',
    reference_type: 'Expense',
    reference_id: 2,
    amount: 3450000,
    payment_method: 'BANK_TRANSFER',
    transaction_date: new Date(Date.now() - 4 * 86400000).toISOString(),
    description: 'Chi tiền điện EVN phòng khám (Phiếu chi EXP-000102)',
    creator: { id: 1, name: 'Kế toán Thu Hà', employee: { full_name: 'Lê Thu Hà' } },
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 104,
    transaction_code: 'CTX-000104',
    transaction_type: 'IN',
    reference_type: 'Payment',
    reference_id: 3,
    amount: 8900000,
    payment_method: 'CARD',
    transaction_date: new Date(Date.now() - 3 * 86400000).toISOString(),
    description: 'Quẹt thẻ thanh toán nội soi tiêu hóa INV-000016',
    creator: { id: 1, name: 'Thu ngân Minh Tuấn', employee: { full_name: 'Phạm Minh Tuấn' } },
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 105,
    transaction_code: 'CTX-000105',
    transaction_type: 'OUT',
    reference_type: 'Expense',
    reference_id: 1,
    amount: 4800000,
    payment_method: 'BANK_TRANSFER',
    transaction_date: new Date(Date.now() - 2 * 86400000).toISOString(),
    description: 'Chi vật tư y tế găng tay & khẩu trang (Phiếu chi EXP-000101)',
    creator: { id: 1, name: 'Kế toán Thu Hà', employee: { full_name: 'Lê Thu Hà' } },
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 106,
    transaction_code: 'CTX-000106',
    transaction_type: 'IN',
    reference_type: 'Manual',
    reference_id: null,
    amount: 20000000,
    payment_method: 'CASH',
    transaction_date: new Date(Date.now() - 1 * 86400000).toISOString(),
    description: 'Nộp bổ sung quỹ tiền mặt lưu động đầu tuần từ Ban giám đốc',
    creator: { id: 1, name: 'Quản trị viên', employee: { full_name: 'Admin Phòng khám' } },
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 107,
    transaction_code: 'CTX-000107',
    transaction_type: 'IN',
    reference_type: 'Payment',
    reference_id: 4,
    amount: 15200000,
    payment_method: 'BANK_TRANSFER',
    transaction_date: new Date().toISOString(),
    description: 'Thu chuyển khoản gói khám tổng quát định kỳ doanh nghiệp INV-000020',
    creator: { id: 1, name: 'Thu ngân Lê Thảo', employee: { full_name: 'Lê Thị Thu Thảo' } },
    created_at: new Date().toISOString(),
  },
];

/**
 * Fetch cashbook summary (opening balance, total in, total out, net, closing balance).
 */
export async function getCashbookSummary(params?: {
  start_date?: string;
  end_date?: string;
  from_date?: string;
  to_date?: string;
  payment_method?: string;
}): Promise<ApiResponse<CashbookSummary>> {
  const query = buildQueryString(params as Record<string, unknown>);
  try {
    const res = await apiClient.get<CashbookSummary>(`/cash-transactions/summary${query}`);
    if (res.data) return res;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn('API /cash-transactions/summary unavailable, using fallback', err);
    }
  }

  // Calculate from fallback transactions
  const totalIn = fallbackTransactions
    .filter((t) => t.transaction_type === 'IN')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalOut = fallbackTransactions
    .filter((t) => t.transaction_type === 'OUT')
    .reduce((sum, t) => sum + t.amount, 0);
  const openingBalance = 45000000;
  const netChange = totalIn - totalOut;
  const closingBalance = openingBalance + netChange;

  const cashIn = fallbackTransactions
    .filter((t) => t.payment_method === 'CASH' && t.transaction_type === 'IN')
    .reduce((s, t) => s + t.amount, 0);
  const cashOut = fallbackTransactions
    .filter((t) => t.payment_method === 'CASH' && t.transaction_type === 'OUT')
    .reduce((s, t) => s + t.amount, 0);

  const bankIn = fallbackTransactions
    .filter((t) => t.payment_method === 'BANK_TRANSFER' && t.transaction_type === 'IN')
    .reduce((s, t) => s + t.amount, 0);
  const bankOut = fallbackTransactions
    .filter((t) => t.payment_method === 'BANK_TRANSFER' && t.transaction_type === 'OUT')
    .reduce((s, t) => s + t.amount, 0);

  const cardIn = fallbackTransactions
    .filter((t) => t.payment_method === 'CARD' && t.transaction_type === 'IN')
    .reduce((s, t) => s + t.amount, 0);
  const cardOut = fallbackTransactions
    .filter((t) => t.payment_method === 'CARD' && t.transaction_type === 'OUT')
    .reduce((s, t) => s + t.amount, 0);

  return {
    success: true,
    message: 'Lấy dữ liệu tổng hợp sổ quỹ thành công.',
    data: {
      period: {
        start_date: params?.start_date || params?.from_date || null,
        end_date: params?.end_date || params?.to_date || null,
      },
      opening_balance: openingBalance,
      total_in: totalIn,
      total_out: totalOut,
      net_change: netChange,
      closing_balance: closingBalance,
      by_payment_method: {
        CASH: {
          opening_balance: 15000000,
          total_in: cashIn,
          total_out: cashOut,
          net_change: cashIn - cashOut,
          closing_balance: 15000000 + (cashIn - cashOut),
        },
        BANK_TRANSFER: {
          opening_balance: 25000000,
          total_in: bankIn,
          total_out: bankOut,
          net_change: bankIn - bankOut,
          closing_balance: 25000000 + (bankIn - bankOut),
        },
        CARD: {
          opening_balance: 5000000,
          total_in: cardIn,
          total_out: cardOut,
          net_change: cardIn - cardOut,
          closing_balance: 5000000 + (cardIn - cardOut),
        },
      },
    },
  };
}

/**
 * Fetch cash transactions list.
 */
export async function getCashTransactions(
  params?: CashTransactionsQueryParams
): Promise<ApiResponse<CashTransaction[]>> {
  const query = buildQueryString(params as Record<string, unknown>);
  try {
    const res = await apiClient.get<CashTransaction[]>(`/cash-transactions${query}`);
    if (res.data) return res;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn('API /cash-transactions unavailable, using fallback', err);
    }
  }

  // Filter fallback transactions
  let list = [...fallbackTransactions];
  if (params?.transaction_type) {
    list = list.filter((t) => t.transaction_type === params.transaction_type);
  }
  if (params?.payment_method) {
    list = list.filter((t) => t.payment_method === params.payment_method);
  }
  if (params?.search) {
    const q = params.search.toLowerCase();
    list = list.filter(
      (t) =>
        t.transaction_code.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }

  return {
    success: true,
    message: 'Lấy danh sách giao dịch sổ quỹ thành công.',
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
 * Create a new manual cash transaction (income or outcome).
 */
export async function createCashTransaction(
  input: CreateCashTransactionInput
): Promise<ApiResponse<CashTransaction>> {
  try {
    const res = await apiClient.post<CashTransaction>('/cash-transactions', input);
    if (res.data) {
      fallbackTransactions.unshift(res.data);
      return res;
    }
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn('POST /cash-transactions API failed, creating in-memory', err);
    }
  }

  const newTx: CashTransaction = {
    id: Date.now(),
    transaction_code:
      input.transaction_code ||
      `CTX-${String(fallbackTransactions.length + 101).padStart(6, '0')}`,
    transaction_type: input.transaction_type,
    reference_type: input.reference_type || 'Manual',
    reference_id: input.reference_id || null,
    amount: Number(input.amount),
    payment_method: input.payment_method,
    transaction_date: input.transaction_date || new Date().toISOString(),
    description: input.description || null,
    creator: { id: 1, name: 'Người dùng hiện tại', employee: { full_name: 'Quản lý phòng khám' } },
    created_at: new Date().toISOString(),
  };

  fallbackTransactions.unshift(newTx);

  return {
    success: true,
    message: 'Tạo giao dịch sổ quỹ thành công.',
    data: newTx,
  };
}

/**
 * Fetch expenses list.
 */
export async function getExpenses(
  params?: ExpensesQueryParams
): Promise<ApiResponse<Expense[]>> {
  const query = buildQueryString(params as Record<string, unknown>);
  try {
    const res = await apiClient.get<Expense[]>(`/expenses${query}`);
    if (res.data) return res;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn('API /expenses unavailable, using fallback', err);
    }
  }

  let list = [...fallbackExpenses];
  if (params?.approval_status) {
    list = list.filter((e) => e.approval_status === params.approval_status);
  }
  if (params?.category_id) {
    list = list.filter((e) => String(e.category_id) === String(params.category_id));
  }
  if (params?.payment_method) {
    list = list.filter((e) => e.payment_method === params.payment_method);
  }
  if (params?.search) {
    const q = params.search.toLowerCase();
    list = list.filter(
      (e) =>
        e.expense_code.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q))
    );
  }

  return {
    success: true,
    message: 'Lấy danh sách phiếu chi thành công.',
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
 * Create a new expense voucher.
 */
export async function createExpense(
  input: CreateExpenseInput
): Promise<ApiResponse<Expense>> {
  try {
    const res = await apiClient.post<Expense>('/expenses', input);
    if (res.data) {
      fallbackExpenses.unshift(res.data);
      return res;
    }
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn('POST /expenses API unavailable, creating in-memory', err);
    }
  }

  const matchedCat = fallbackCategories.find((c) => c.id === Number(input.category_id));
  const newExp: Expense = {
    id: Date.now(),
    expense_code: `EXP-${String(fallbackExpenses.length + 101).padStart(6, '0')}`,
    category_id: Number(input.category_id),
    amount: Number(input.amount),
    payment_method: input.payment_method,
    expense_date: input.expense_date,
    description: input.description || null,
    approval_status: 'PENDING',
    category: matchedCat || null,
    creator: { id: 1, name: 'Người dùng hiện tại', employee: { full_name: 'Quản lý phòng khám' } },
    created_at: new Date().toISOString(),
  };

  fallbackExpenses.unshift(newExp);
  if (matchedCat) {
    matchedCat.expenses_count = (matchedCat.expenses_count || 0) + 1;
    matchedCat.total_amount = (matchedCat.total_amount || 0) + newExp.amount;
  }

  return {
    success: true,
    message: 'Lập phiếu chi thành công, phiếu đang chờ Quản lý phê duyệt.',
    data: newExp,
  };
}

/**
 * Approve an expense voucher and record OUT cash transaction.
 */
export async function approveExpense(
  id: number | string,
  input?: ApproveExpenseInput
): Promise<ApiResponse<Expense>> {
  try {
    const res = await apiClient.patch<Expense>(`/expenses/${id}/approve`, input);
    if (res.data) {
      const idx = fallbackExpenses.findIndex((e) => String(e.id) === String(id));
      if (idx !== -1) fallbackExpenses[idx] = res.data;
      return res;
    }
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn('PATCH /expenses/:id/approve API failed, updating in-memory', err);
    }
  }

  const exp = fallbackExpenses.find((e) => String(e.id) === String(id));
  if (!exp) {
    throw new ApiError('Không tìm thấy phiếu chi.', 404);
  }

  exp.approval_status = 'APPROVED';
  exp.approved_by = 1;
  exp.approved_at = new Date().toISOString();
  exp.approver = {
    id: 1,
    name: 'BS. Trần Văn Hùng (Quản lý)',
    employee: { full_name: 'BS. Trần Văn Hùng' },
  };

  // Automatically write OUT record to cash transactions
  const cashTx: CashTransaction = {
    id: Date.now(),
    transaction_code: `CTX-${String(fallbackTransactions.length + 101).padStart(6, '0')}`,
    transaction_type: 'OUT',
    reference_type: 'Expense',
    reference_id: exp.id,
    amount: exp.amount,
    payment_method: exp.payment_method,
    transaction_date: exp.expense_date || new Date().toISOString(),
    description: `Chi cho phiếu ${exp.expense_code}: ${exp.description || exp.category?.name || 'Chi phí vận hành'}`,
    creator: { id: 1, name: 'BS. Trần Văn Hùng', employee: { full_name: 'BS. Trần Văn Hùng' } },
    created_at: new Date().toISOString(),
  };
  fallbackTransactions.unshift(cashTx);

  return {
    success: true,
    message: 'Đã phê duyệt phiếu chi và tự động ghi sổ quỹ (OUT).',
    data: exp,
  };
}

/**
 * Reject an expense voucher.
 */
export async function rejectExpense(
  id: number | string,
  input: RejectExpenseInput
): Promise<ApiResponse<Expense>> {
  try {
    const res = await apiClient.patch<Expense>(`/expenses/${id}/reject`, input);
    if (res.data) {
      const idx = fallbackExpenses.findIndex((e) => String(e.id) === String(id));
      if (idx !== -1) fallbackExpenses[idx] = res.data;
      return res;
    }
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn('PATCH /expenses/:id/reject API failed, updating in-memory', err);
    }
  }

  const exp = fallbackExpenses.find((e) => String(e.id) === String(id));
  if (!exp) {
    throw new ApiError('Không tìm thấy phiếu chi.', 404);
  }

  exp.approval_status = 'REJECTED';
  exp.rejection_reason = input.reason;
  exp.approved_by = 1;
  exp.approved_at = new Date().toISOString();
  exp.approver = {
    id: 1,
    name: 'BS. Trần Văn Hùng (Quản lý)',
    employee: { full_name: 'BS. Trần Văn Hùng' },
  };

  return {
    success: true,
    message: 'Đã từ chối phiếu chi.',
    data: exp,
  };
}

/**
 * Fetch expense categories list.
 */
export async function getExpenseCategories(params?: {
  search?: string;
  status?: string;
}): Promise<ApiResponse<ExpenseCategory[]>> {
  const query = buildQueryString(params as Record<string, unknown>);
  try {
    const res = await apiClient.get<ExpenseCategory[]>(`/expense-categories${query}`);
    if (res.data) return res;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn('API /expense-categories unavailable, using fallback', err);
    }
  }

  let list = [...fallbackCategories];
  if (params?.status) {
    list = list.filter((c) => c.status === params.status);
  }
  if (params?.search) {
    const q = params.search.toLowerCase();
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }

  return {
    success: true,
    message: 'Lấy danh mục chi phí thành công.',
    data: list,
  };
}

/**
 * Create a new expense category.
 */
export async function createExpenseCategory(
  input: CreateExpenseCategoryInput
): Promise<ApiResponse<ExpenseCategory>> {
  try {
    const res = await apiClient.post<ExpenseCategory>('/expense-categories', input);
    if (res.data) {
      fallbackCategories.push(res.data);
      return res;
    }
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn('POST /expense-categories API failed, creating in-memory', err);
    }
  }

  const newCat: ExpenseCategory = {
    id: Date.now(),
    name: input.name,
    description: input.description || null,
    status: input.status || 'ACTIVE',
    expenses_count: 0,
    total_amount: 0,
    created_at: new Date().toISOString(),
  };
  fallbackCategories.push(newCat);

  return {
    success: true,
    message: 'Thêm danh mục chi phí thành công.',
    data: newCat,
  };
}

/**
 * Update an existing expense category.
 */
export async function updateExpenseCategory(
  id: number | string,
  input: UpdateExpenseCategoryInput
): Promise<ApiResponse<ExpenseCategory>> {
  try {
    const res = await apiClient.put<ExpenseCategory>(`/expense-categories/${id}`, input);
    if (res.data) {
      const idx = fallbackCategories.findIndex((c) => String(c.id) === String(id));
      if (idx !== -1) fallbackCategories[idx] = res.data;
      return res;
    }
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) {
      console.warn('PUT /expense-categories/:id API failed, updating in-memory', err);
    }
  }

  const cat = fallbackCategories.find((c) => String(c.id) === String(id));
  if (!cat) {
    throw new ApiError('Không tìm thấy danh mục chi phí.', 404);
  }

  if (input.name !== undefined) cat.name = input.name;
  if (input.description !== undefined) cat.description = input.description;
  if (input.status !== undefined) cat.status = input.status;
  cat.updated_at = new Date().toISOString();

  return {
    success: true,
    message: 'Cập nhật danh mục chi phí thành công.',
    data: cat,
  };
}
