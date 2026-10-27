export default function UsersLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đang tải danh sách tài khoản...</p>
    </div>
  );
}
