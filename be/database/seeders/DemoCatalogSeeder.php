<?php

namespace Database\Seeders;

use App\Models\AlertRule;
use App\Models\Employee;
use App\Models\ExpenseCategory;
use App\Models\Product;
use App\Models\Service;
use App\Models\ServicePackage;
use Illuminate\Database\Seeder;

class DemoCatalogSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (app()->isProduction()) {
            return;
        }

        $servicesData = [
            [
                'service_code' => 'SRV-001',
                'name' => 'Khám nội tổng quát',
                'description' => 'Khám lâm sàng, chẩn đoán ban đầu và tư vấn sức khỏe tổng quát',
                'price' => 150000,
                'duration_minutes' => 30,
                'status' => 'ACTIVE',
            ],
            [
                'service_code' => 'SRV-002',
                'name' => 'Khám chuyên khoa Da liễu',
                'description' => 'Thăm khám, soi da và tư vấn phác đồ điều trị da liễu',
                'price' => 200000,
                'duration_minutes' => 30,
                'status' => 'ACTIVE',
            ],
            [
                'service_code' => 'SRV-003',
                'name' => 'Siêu âm ổ bụng tổng quát',
                'description' => 'Siêu âm 4D ổ bụng đánh giá gan, mật, tụy, lách, thận',
                'price' => 250000,
                'duration_minutes' => 20,
                'status' => 'ACTIVE',
            ],
            [
                'service_code' => 'SRV-004',
                'name' => 'Xét nghiệm công thức máu toàn phần (CBC)',
                'description' => 'Phân tích các chỉ số tế bào máu ngoại vi cơ bản',
                'price' => 180000,
                'duration_minutes' => 15,
                'status' => 'ACTIVE',
            ],
            [
                'service_code' => 'SRV-005',
                'name' => 'Chụp X-quang tim phổi thẳng',
                'description' => 'Chụp X-quang kỹ thuật số tim phổi tầm soát bệnh lý hô hấp',
                'price' => 160000,
                'duration_minutes' => 15,
                'status' => 'ACTIVE',
            ],
            [
                'service_code' => 'SRV-006',
                'name' => 'Lấy cao răng và đánh bóng',
                'description' => 'Vệ sinh cao răng siêu âm và đánh bóng bề mặt răng',
                'price' => 300000,
                'duration_minutes' => 45,
                'status' => 'ACTIVE',
            ],
            [
                'service_code' => 'SRV-007',
                'name' => 'Nội soi Tai Mũi Họng',
                'description' => 'Nội soi ống mềm chuyên sâu chẩn đoán vòm họng và thanh quản',
                'price' => 220000,
                'duration_minutes' => 25,
                'status' => 'ACTIVE',
            ],
            [
                'service_code' => 'SRV-008',
                'name' => 'Đo điện tim (ECG)',
                'description' => 'Ghi điện tâm đồ 12 chuyển đạo đánh giá nhịp tim',
                'price' => 120000,
                'duration_minutes' => 15,
                'status' => 'ACTIVE',
            ],
        ];

        $servicesByCode = [];
        foreach ($servicesData as $data) {
            $service = Service::updateOrCreate(
                ['service_code' => $data['service_code']],
                $data
            );
            $servicesByCode[$data['service_code']] = $service;
        }

        $packagesData = [
            [
                'package_code' => 'PKG-001',
                'name' => 'Gói khám sức khỏe tổng quát tiêu chuẩn',
                'description' => 'Bao gồm khám nội, siêu âm bụng, xét nghiệm máu và đo điện tim',
                'price' => 600000,
                'total_sessions' => 4,
                'validity_days' => 180,
                'status' => 'ACTIVE',
                'services' => [
                    ['service_code' => 'SRV-001', 'quantity' => 1],
                    ['service_code' => 'SRV-003', 'quantity' => 1],
                    ['service_code' => 'SRV-004', 'quantity' => 1],
                    ['service_code' => 'SRV-008', 'quantity' => 1],
                ],
            ],
            [
                'package_code' => 'PKG-002',
                'name' => 'Gói chăm sóc răng miệng định kỳ',
                'description' => 'Liệu trình 3 buổi lấy cao răng và vệ sinh nha khoa toàn diện trong 1 năm',
                'price' => 750000,
                'total_sessions' => 3,
                'validity_days' => 365,
                'status' => 'ACTIVE',
                'services' => [
                    ['service_code' => 'SRV-006', 'quantity' => 3],
                ],
            ],
            [
                'package_code' => 'PKG-003',
                'name' => 'Gói khám và nội soi Tai Mũi Họng chuyên sâu',
                'description' => '2 buổi nội soi chẩn đoán và tái khám đánh giá đáp ứng phác đồ',
                'price' => 400000,
                'total_sessions' => 2,
                'validity_days' => 90,
                'status' => 'ACTIVE',
                'services' => [
                    ['service_code' => 'SRV-007', 'quantity' => 2],
                ],
            ],
        ];

        foreach ($packagesData as $pkgData) {
            $packageServices = $pkgData['services'];
            unset($pkgData['services']);

            $package = ServicePackage::updateOrCreate(
                ['package_code' => $pkgData['package_code']],
                $pkgData
            );

            $syncPayload = [];
            foreach ($packageServices as $item) {
                if (isset($servicesByCode[$item['service_code']])) {
                    $serviceId = $servicesByCode[$item['service_code']]->id;
                    $syncPayload[$serviceId] = [
                        'quantity' => $item['quantity'],
                        'created_at' => now(),
                    ];
                }
            }

            $package->services()->sync($syncPayload);
        }

        $expenseCategories = [
            ['name' => 'Vật tư y tế tiêu hao', 'description' => 'Găng tay, bơm kim tiêm, cồn sát khuẩn, bông băng', 'status' => 'ACTIVE'],
            ['name' => 'Hóa chất & Sinh phẩm xét nghiệm', 'description' => 'Hóa chất chạy máy phân tích máu, sinh hóa, que thử', 'status' => 'ACTIVE'],
            ['name' => 'Vận hành & Tiện ích phòng khám', 'description' => 'Điện nước, viễn thông, bảo trì thiết bị', 'status' => 'ACTIVE'],
        ];

        foreach ($expenseCategories as $cat) {
            ExpenseCategory::updateOrCreate(
                ['name' => $cat['name']],
                $cat
            );
        }

        // Demo Products (Phase 2 - PRD-001 -> PRD-005)
        $productsData = [
            [
                'product_code' => 'PRD-001',
                'name' => 'Paracetamol 500mg',
                'unit' => 'Hộp',
                'minimum_stock' => 50.000,
                'status' => 'ACTIVE',
            ],
            [
                'product_code' => 'PRD-002',
                'name' => 'Amoxicillin 500mg',
                'unit' => 'Hộp',
                'minimum_stock' => 30.000,
                'status' => 'ACTIVE',
            ],
            [
                'product_code' => 'PRD-003',
                'name' => 'Bơm tiêm vô trùng 5ml',
                'unit' => 'Cái',
                'minimum_stock' => 200.000,
                'status' => 'ACTIVE',
            ],
            [
                'product_code' => 'PRD-004',
                'name' => 'Cồn y tế 70 độ 500ml',
                'unit' => 'Chai',
                'minimum_stock' => 20.000,
                'status' => 'ACTIVE',
            ],
            [
                'product_code' => 'PRD-005',
                'name' => 'Găng tay y tế Nitrile (Hộp 100 chiếc)',
                'unit' => 'Hộp',
                'minimum_stock' => 40.000,
                'status' => 'ACTIVE',
            ],
        ];

        foreach ($productsData as $prod) {
            Product::updateOrCreate(
                ['product_code' => $prod['product_code']],
                $prod
            );
        }

        // Demo Alert Rules (Phase 2 - LOW_STOCK, PACKAGE_EXPIRING, OVERDUE_INVOICE)
        $alertRulesData = [
            [
                'name' => 'Cảnh báo tồn kho thuốc & vật tư dưới mức tối thiểu',
                'alert_type' => 'LOW_STOCK',
                'threshold_value' => 10.00,
                'threshold_days' => null,
                'threshold_sessions' => null,
                'status' => 'ACTIVE',
            ],
            [
                'name' => 'Cảnh báo gói dịch vụ bệnh nhân sắp hết hạn sử dụng',
                'alert_type' => 'PACKAGE_EXPIRING',
                'threshold_value' => null,
                'threshold_days' => 30,
                'threshold_sessions' => 1,
                'status' => 'ACTIVE',
            ],
            [
                'name' => 'Cảnh báo hóa đơn công nợ quá hạn thanh toán',
                'alert_type' => 'OVERDUE_INVOICE',
                'threshold_value' => 500000.00,
                'threshold_days' => 15,
                'threshold_sessions' => null,
                'status' => 'ACTIVE',
            ],
        ];

        foreach ($alertRulesData as $rule) {
            AlertRule::updateOrCreate(
                ['alert_type' => $rule['alert_type']],
                $rule
            );
        }

        // Demo Doctors & Examining Employees
        $employeesData = [
            [
                'employee_code' => 'EMP-001',
                'full_name' => 'BS.CKI Nguyễn Văn An',
                'phone' => '0901234567',
                'email' => 'bacsi.an@clinic.local',
                'date_of_birth' => '1982-05-15',
                'gender' => 'MALE',
                'position' => 'Bác sĩ Trưởng khoa Nội',
                'department' => 'Khoa Khám Bệnh',
                'hire_date' => '2020-01-15',
                'status' => 'ACTIVE',
                'notes' => 'Chuyên gia nội tiêu hóa và tim mạch',
            ],
            [
                'employee_code' => 'EMP-002',
                'full_name' => 'ThS.BS Trần Thị Mai',
                'phone' => '0912345678',
                'email' => 'bacsi.mai@clinic.local',
                'date_of_birth' => '1988-08-20',
                'gender' => 'FEMALE',
                'position' => 'Bác sĩ Da liễu',
                'department' => 'Khoa Da liễu & Thẩm mỹ',
                'hire_date' => '2021-03-01',
                'status' => 'ACTIVE',
                'notes' => 'Chuyên khoa da liễu và laser thẩm mỹ',
            ],
            [
                'employee_code' => 'EMP-003',
                'full_name' => 'BS Lê Hoàng Nam',
                'phone' => '0923456789',
                'email' => 'bacsi.nam@clinic.local',
                'date_of_birth' => '1985-11-10',
                'gender' => 'MALE',
                'position' => 'Bác sĩ Siêu âm & CĐHA',
                'department' => 'Khoa Chẩn đoán hình ảnh',
                'hire_date' => '2021-06-15',
                'status' => 'ACTIVE',
                'notes' => 'Chuyên siêu âm tổng quát và X-quang',
            ],
            [
                'employee_code' => 'EMP-004',
                'full_name' => 'BS.CKI Phạm Thu Hà',
                'phone' => '0934567890',
                'email' => 'bacsi.ha@clinic.local',
                'date_of_birth' => '1990-03-25',
                'gender' => 'FEMALE',
                'position' => 'Bác sĩ Răng Hàm Mặt',
                'department' => 'Khoa Răng Hàm Mặt',
                'hire_date' => '2022-02-01',
                'status' => 'ACTIVE',
                'notes' => 'Chuyên nha khoa tổng quát và phục hình',
            ],
            [
                'employee_code' => 'EMP-005',
                'full_name' => 'BS Vũ Minh Đức',
                'phone' => '0945678901',
                'email' => 'bacsi.duc@clinic.local',
                'date_of_birth' => '1987-09-12',
                'gender' => 'MALE',
                'position' => 'Bác sĩ Tai Mũi Họng',
                'department' => 'Khoa Tai Mũi Họng',
                'hire_date' => '2022-05-10',
                'status' => 'ACTIVE',
                'notes' => 'Chuyên nội soi TMH và phẫu thuật tiểu phẫu',
            ],
        ];

        foreach ($employeesData as $empData) {
            Employee::updateOrCreate(
                ['employee_code' => $empData['employee_code']],
                $empData
            );
        }
    }
}
