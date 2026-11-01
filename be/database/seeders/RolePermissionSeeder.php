<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $permissions = [
            // Module Auth & Users
            ['module' => 'auth', 'action' => 'view', 'permission_key' => 'users.view', 'description' => 'Xem danh sách và thông tin tài khoản người dùng'],
            ['module' => 'auth', 'action' => 'create', 'permission_key' => 'users.create', 'description' => 'Tạo tài khoản người dùng mới'],
            ['module' => 'auth', 'action' => 'update', 'permission_key' => 'users.update', 'description' => 'Cập nhật tài khoản người dùng'],
            ['module' => 'auth', 'action' => 'delete', 'permission_key' => 'users.delete', 'description' => 'Vô hiệu hóa hoặc khóa tài khoản'],
            ['module' => 'auth', 'action' => 'view', 'permission_key' => 'roles.view', 'description' => 'Xem danh sách vai trò và phân quyền'],
            ['module' => 'auth', 'action' => 'manage', 'permission_key' => 'roles.manage', 'description' => 'Quản lý vai trò và phân bổ quyền'],
            ['module' => 'auth', 'action' => 'view', 'permission_key' => 'permissions.view', 'description' => 'Xem danh mục quyền hệ thống'],

            // Module Employees
            ['module' => 'employees', 'action' => 'view', 'permission_key' => 'employees.view', 'description' => 'Xem danh sách và hồ sơ nhân viên'],
            ['module' => 'employees', 'action' => 'create', 'permission_key' => 'employees.create', 'description' => 'Thêm mới hồ sơ nhân viên'],
            ['module' => 'employees', 'action' => 'update', 'permission_key' => 'employees.update', 'description' => 'Cập nhật hồ sơ nhân viên'],
            ['module' => 'employees', 'action' => 'delete', 'permission_key' => 'employees.delete', 'description' => 'Đổi trạng thái nhân viên'],

            // Module Patients
            ['module' => 'patients', 'action' => 'view', 'permission_key' => 'patients.view', 'description' => 'Xem danh sách và thông tin bệnh nhân'],
            ['module' => 'patients', 'action' => 'create', 'permission_key' => 'patients.create', 'description' => 'Tạo mới hồ sơ bệnh nhân'],
            ['module' => 'patients', 'action' => 'update', 'permission_key' => 'patients.update', 'description' => 'Cập nhật thông tin bệnh nhân'],
            ['module' => 'patients', 'action' => 'delete', 'permission_key' => 'patients.delete', 'description' => 'Đổi trạng thái hoặc vô hiệu hóa hồ sơ bệnh nhân'],
            ['module' => 'patients', 'action' => 'mask_bypass', 'permission_key' => 'patients.mask_bypass', 'description' => 'Xem thông tin cá nhân và số điện thoại đầy đủ không bị che dấu'],

            // Module Patient Files (Tệp đính kèm y tế)
            ['module' => 'patient_files', 'action' => 'view', 'permission_key' => 'patient_files.view', 'description' => 'Xem và tải tài liệu y tế bệnh nhân'],
            ['module' => 'patient_files', 'action' => 'upload', 'permission_key' => 'patient_files.upload', 'description' => 'Tải lên tài liệu y tế bệnh nhân'],
            ['module' => 'patient_files', 'action' => 'delete', 'permission_key' => 'patient_files.delete', 'description' => 'Xóa tài liệu y tế bệnh nhân'],

            // Module Services
            ['module' => 'services', 'action' => 'view', 'permission_key' => 'services.view', 'description' => 'Xem danh mục dịch vụ'],
            ['module' => 'services', 'action' => 'create', 'permission_key' => 'services.create', 'description' => 'Tạo dịch vụ khám chữa bệnh mới'],
            ['module' => 'services', 'action' => 'update', 'permission_key' => 'services.update', 'description' => 'Cập nhật thông tin và bảng giá dịch vụ'],
            ['module' => 'services', 'action' => 'delete', 'permission_key' => 'services.delete', 'description' => 'Ngừng cung cấp dịch vụ'],

            // Module Service Packages
            ['module' => 'service_packages', 'action' => 'view', 'permission_key' => 'service_packages.view', 'description' => 'Xem danh mục gói dịch vụ'],
            ['module' => 'service_packages', 'action' => 'create', 'permission_key' => 'service_packages.create', 'description' => 'Tạo mới gói dịch vụ'],
            ['module' => 'service_packages', 'action' => 'update', 'permission_key' => 'service_packages.update', 'description' => 'Cập nhật cấu hình gói dịch vụ'],
            ['module' => 'service_packages', 'action' => 'delete', 'permission_key' => 'service_packages.delete', 'description' => 'Ngừng áp dụng gói dịch vụ'],
            ['module' => 'service_packages', 'action' => 'view', 'permission_key' => 'patient_packages.view', 'description' => 'Xem danh sách gói dịch vụ của bệnh nhân'],
            ['module' => 'service_packages', 'action' => 'create', 'permission_key' => 'patient_packages.assign', 'description' => 'Cấp gói dịch vụ cho bệnh nhân'],

            // Module Appointments
            ['module' => 'appointments', 'action' => 'view', 'permission_key' => 'appointments.view', 'description' => 'Xem lịch hẹn khám'],
            ['module' => 'appointments', 'action' => 'create', 'permission_key' => 'appointments.create', 'description' => 'Đặt lịch hẹn mới cho bệnh nhân'],
            ['module' => 'appointments', 'action' => 'update', 'permission_key' => 'appointments.update', 'description' => 'Cập nhật thông tin và dời lịch hẹn'],
            ['module' => 'appointments', 'action' => 'cancel', 'permission_key' => 'appointments.cancel', 'description' => 'Hủy lịch hẹn của bệnh nhân'],

            // Module Visits
            ['module' => 'visits', 'action' => 'view', 'permission_key' => 'visits.view', 'description' => 'Xem danh sách và chi tiết lượt khám'],
            ['module' => 'visits', 'action' => 'create', 'permission_key' => 'visits.create', 'description' => 'Tiếp đón và tạo lượt khám mới'],
            ['module' => 'visits', 'action' => 'update', 'permission_key' => 'visits.update', 'description' => 'Cập nhật lượt khám và trạng thái điều trị'],
            ['module' => 'visits', 'action' => 'cancel', 'permission_key' => 'visits.cancel', 'description' => 'Hủy lượt khám và hoàn lại buổi gói'],

            // Module Medical Records
            ['module' => 'medical_records', 'action' => 'view', 'permission_key' => 'medical_records.view', 'description' => 'Xem hồ sơ bệnh án chuyên môn'],
            ['module' => 'medical_records', 'action' => 'create', 'permission_key' => 'medical_records.create', 'description' => 'Lập bệnh án cho lượt khám'],
            ['module' => 'medical_records', 'action' => 'update', 'permission_key' => 'medical_records.update', 'description' => 'Cập nhật chẩn đoán và phác đồ điều trị'],
            ['module' => 'medical_records', 'action' => 'history', 'permission_key' => 'medical_records.history.view', 'description' => 'Xem lịch sử chỉnh sửa và vết kiểm toán bệnh án'],

            // Module Invoices
            ['module' => 'invoices', 'action' => 'view', 'permission_key' => 'invoices.view', 'description' => 'Xem danh sách hóa đơn thanh toán'],
            ['module' => 'invoices', 'action' => 'create', 'permission_key' => 'invoices.create', 'description' => 'Lập hóa đơn thanh toán viện phí'],
            ['module' => 'invoices', 'action' => 'update', 'permission_key' => 'invoices.update', 'description' => 'Điều chỉnh hóa đơn'],

            // Module Payments
            ['module' => 'payments', 'action' => 'view', 'permission_key' => 'payments.view', 'description' => 'Xem lịch sử thanh toán và phiếu thu'],
            ['module' => 'payments', 'action' => 'create', 'permission_key' => 'payments.create', 'description' => 'Xác nhận thu tiền và xuất phiếu thu'],

            // Module Expenses
            ['module' => 'expenses', 'action' => 'view', 'permission_key' => 'expenses.view', 'description' => 'Xem sổ quỹ chi và danh sách phiếu chi'],
            ['module' => 'expenses', 'action' => 'create', 'permission_key' => 'expenses.create', 'description' => 'Lập đề xuất phiếu chi'],
            ['module' => 'expenses', 'action' => 'approve', 'permission_key' => 'expenses.approve', 'description' => 'Phê duyệt phiếu chi phòng khám'],

            // Module Reports
            ['module' => 'reports', 'action' => 'view', 'permission_key' => 'reports.view', 'description' => 'Xem báo cáo doanh thu, lượt khám và vận hành'],

            // Module Settings
            ['module' => 'settings', 'action' => 'view', 'permission_key' => 'settings.view', 'description' => 'Xem tham số và cấu hình hệ thống'],
            ['module' => 'settings', 'action' => 'update', 'permission_key' => 'settings.update', 'description' => 'Cập nhật cấu hình phòng khám'],

            // Module Debts (Công nợ)
            ['module' => 'debts', 'action' => 'view', 'permission_key' => 'debts.view', 'description' => 'Xem và đối soát công nợ bệnh nhân'],

            // Module Cash Transactions (Sổ quỹ & Dòng tiền)
            ['module' => 'cash_transactions', 'action' => 'view', 'permission_key' => 'cash_transactions.view', 'description' => 'Xem sổ quỹ và biến động dòng tiền'],
            ['module' => 'cash_transactions', 'action' => 'create', 'permission_key' => 'cash_transactions.create', 'description' => 'Tạo phiếu giao dịch sổ quỹ'],

            // Module Products (Thuốc & Vật tư y tế)
            ['module' => 'products', 'action' => 'view', 'permission_key' => 'products.view', 'description' => 'Xem danh mục thuốc và vật tư y tế'],
            ['module' => 'products', 'action' => 'create', 'permission_key' => 'products.create', 'description' => 'Thêm mới thuốc và vật tư y tế'],
            ['module' => 'products', 'action' => 'update', 'permission_key' => 'products.update', 'description' => 'Cập nhật thuốc và vật tư y tế'],
            ['module' => 'products', 'action' => 'delete', 'permission_key' => 'products.delete', 'description' => 'Xóa hoặc ngừng áp dụng thuốc và vật tư'],

            // Module Inventory (Quản lý kho)
            ['module' => 'inventory', 'action' => 'view', 'permission_key' => 'inventory.view', 'description' => 'Xem tồn kho và lịch sử biến động kho'],
            ['module' => 'inventory', 'action' => 'in', 'permission_key' => 'inventory.in', 'description' => 'Lập phiếu nhập kho thuốc và vật tư'],
            ['module' => 'inventory', 'action' => 'out', 'permission_key' => 'inventory.out', 'description' => 'Lập phiếu xuất kho thuốc và vật tư'],
            ['module' => 'inventory', 'action' => 'adjust', 'permission_key' => 'inventory.adjust', 'description' => 'Kiểm kê và điều chỉnh số lượng tồn kho'],

            // Module KPI (Chỉ tiêu nhân viên)
            ['module' => 'kpi_targets', 'action' => 'view', 'permission_key' => 'kpi_targets.view', 'description' => 'Xem chỉ tiêu và thực đạt KPI nhân viên'],
            ['module' => 'kpi_targets', 'action' => 'manage', 'permission_key' => 'kpi_targets.manage', 'description' => 'Thiết lập và giao chỉ tiêu KPI nhân viên'],

            // Module Data Transfer (Import / Export)
            ['module' => 'data_transfer', 'action' => 'manage', 'permission_key' => 'imports.manage', 'description' => 'Import dữ liệu danh mục hoặc giao dịch từ CSV'],
            ['module' => 'data_transfer', 'action' => 'view', 'permission_key' => 'exports.view', 'description' => 'Xuất dữ liệu và báo cáo ra file Excel/CSV'],

            // Module Notifications & Alerts (Thông báo & Quy tắc cảnh báo)
            ['module' => 'notifications', 'action' => 'view', 'permission_key' => 'notifications.view', 'description' => 'Xem thông báo và cảnh báo hệ thống'],
            ['module' => 'notifications', 'action' => 'manage', 'permission_key' => 'alert_rules.manage', 'description' => 'Cấu hình quy tắc cảnh báo tự động'],

            // Module Approvals (Luồng phê duyệt)
            ['module' => 'approvals', 'action' => 'view', 'permission_key' => 'approvals.view', 'description' => 'Xem danh sách yêu cầu phê duyệt'],
            ['module' => 'approvals', 'action' => 'manage', 'permission_key' => 'approvals.manage', 'description' => 'Phê duyệt hoặc từ chối các yêu cầu'],

            // Module Audit Logs (Kiểm toán hệ thống)
            ['module' => 'audit_logs', 'action' => 'view', 'permission_key' => 'audit_logs.view', 'description' => 'Xem nhật ký kiểm toán hệ thống'],
        ];

        $permissionIds = [];
        foreach ($permissions as $perm) {
            $record = Permission::updateOrCreate(
                ['permission_key' => $perm['permission_key']],
                [
                    'module' => $perm['module'],
                    'action' => $perm['action'],
                    'description' => $perm['description'],
                ]
            );
            $permissionIds[$perm['permission_key']] = $record->id;
        }

        $allPermissionKeys = array_keys($permissionIds);

        $rolesMatrix = [
            'ADMIN' => [
                'description' => 'Quản trị hệ thống: Toàn quyền cấu hình, tài khoản, vai trò, danh mục, kiểm toán và phân quyền.',
                'permissions' => $allPermissionKeys,
            ],
            'MANAGER' => [
                'description' => 'Quản lý phòng khám: Quản lý nhân sự, dịch vụ, gói, lịch hẹn, xem báo cáo, không sửa cấu hình hệ thống.',
                'permissions' => [
                    'users.view',
                    'employees.view',
                    'employees.create',
                    'employees.update',
                    'patients.view',
                    'patients.create',
                    'patients.update',
                    'patients.mask_bypass',
                    'patient_files.view',
                    'patient_files.upload',
                    'patient_files.delete',
                    'services.view',
                    'services.create',
                    'services.update',
                    'service_packages.view',
                    'service_packages.create',
                    'service_packages.update',
                    'patient_packages.view',
                    'patient_packages.assign',
                    'appointments.view',
                    'appointments.create',
                    'appointments.update',
                    'appointments.cancel',
                    'visits.view',
                    'visits.create',
                    'visits.update',
                    'visits.cancel',
                    'medical_records.view',
                    'medical_records.history.view',
                    'invoices.view',
                    'payments.view',
                    'expenses.view',
                    'expenses.create',
                    'expenses.approve',
                    'reports.view',
                    'settings.view',
                    'debts.view',
                    'cash_transactions.view',
                    'cash_transactions.create',
                    'products.view',
                    'products.create',
                    'products.update',
                    'products.delete',
                    'inventory.view',
                    'inventory.in',
                    'inventory.out',
                    'inventory.adjust',
                    'kpi_targets.view',
                    'kpi_targets.manage',
                    'imports.manage',
                    'exports.view',
                    'notifications.view',
                    'approvals.view',
                    'approvals.manage',
                    'alert_rules.manage',
                ],
            ],
            'DOCTOR' => [
                'description' => 'Bác sĩ điều trị: Xem lịch khám, thực hiện khám, cập nhật hồ sơ bệnh án, kê đơn, chỉ định dịch vụ.',
                'permissions' => [
                    'employees.view',
                    'patients.view',
                    'patient_files.view',
                    'patient_files.upload',
                    'patient_files.delete',
                    'services.view',
                    'service_packages.view',
                    'patient_packages.view',
                    'appointments.view',
                    'appointments.update',
                    'visits.view',
                    'visits.update',
                    'medical_records.view',
                    'medical_records.create',
                    'medical_records.update',
                    'medical_records.history.view',
                    'notifications.view',
                ],
            ],
            'NURSE' => [
                'description' => 'Điều dưỡng / Kỹ thuật viên: Tiếp đón, hỗ trợ lâm sàng, xem thông tin bệnh nhân, xem và tải lên tệp đính kèm y tế, không lập/sửa bệnh án chuyên môn.',
                'permissions' => [
                    'employees.view',
                    'patients.view',
                    'patient_files.view',
                    'patient_files.upload',
                    'services.view',
                    'appointments.view',
                    'visits.view',
                    'visits.update',
                    'notifications.view',
                ],
            ],
            'RECEPTIONIST' => [
                'description' => 'Nhân viên tiếp đón: Tiếp đón bệnh nhân, tra cứu hồ sơ, đặt lịch hẹn, tạo lượt khám mới (không xem bệnh án).',
                'permissions' => [
                    'employees.view',
                    'patients.view',
                    'patients.create',
                    'patients.update',
                    'patients.mask_bypass',
                    'patient_files.view',
                    'patient_files.upload',
                    'services.view',
                    'service_packages.view',
                    'patient_packages.view',
                    'patient_packages.assign',
                    'appointments.view',
                    'appointments.create',
                    'appointments.update',
                    'appointments.cancel',
                    'visits.view',
                    'visits.create',
                    'visits.update',
                    'notifications.view',
                ],
            ],
            'CASHIER' => [
                'description' => 'Thu ngân: Lập hóa đơn, thu tiền lượt khám/gói, in biên lai (không xem bệnh án y tế).',
                'permissions' => [
                    'patients.view',
                    'services.view',
                    'service_packages.view',
                    'patient_packages.view',
                    'visits.view',
                    'invoices.view',
                    'invoices.create',
                    'invoices.update',
                    'payments.view',
                    'payments.create',
                    'debts.view',
                    'cash_transactions.view',
                    'notifications.view',
                ],
            ],
            'ACCOUNTANT' => [
                'description' => 'Kế toán phòng khám: Quản lý chi phí, công nợ, đối soát dòng tiền, xuất báo cáo tài chính.',
                'permissions' => [
                    'invoices.view',
                    'payments.view',
                    'debts.view',
                    'expenses.view',
                    'expenses.create',
                    'expenses.approve',
                    'cash_transactions.view',
                    'cash_transactions.create',
                    'reports.view',
                    'exports.view',
                    'inventory.view',
                    'products.view',
                    'notifications.view',
                    'approvals.view',
                ],
            ],
            'EMPLOYEE' => [
                'description' => 'Nhân viên cơ bản: Xem thông tin cá nhân, xem lịch làm việc được phân công.',
                'permissions' => [
                    'appointments.view',
                    'visits.view',
                    'notifications.view',
                ],
            ],
            'VIEWER' => [
                'description' => 'Khách xem (Read-only): Chỉ xem báo cáo tổng hợp được chỉ định; tuyệt đối không tạo/sửa/xóa bất kỳ dữ liệu nào.',
                'permissions' => [
                    'services.view',
                    'service_packages.view',
                    'reports.view',
                    'debts.view',
                    'cash_transactions.view',
                    'products.view',
                    'inventory.view',
                    'kpi_targets.view',
                    'notifications.view',
                ],
            ],
        ];

        foreach ($rolesMatrix as $roleName => $data) {
            $role = Role::updateOrCreate(
                ['name' => $roleName],
                ['description' => $data['description']]
            );

            $syncPayload = [];
            foreach ($data['permissions'] as $permKey) {
                if (isset($permissionIds[$permKey])) {
                    $syncPayload[$permissionIds[$permKey]] = ['created_at' => now()];
                }
            }

            $role->permissions()->sync($syncPayload);
        }
    }
}
