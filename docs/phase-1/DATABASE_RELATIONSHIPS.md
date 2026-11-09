# DATABASE RELATIONSHIPS — SƠ ĐỒ QUAN HỆ & ELOQUENT MAPPING (`P1-004`)

Tài liệu đối chiếu các quan hệ khóa ngoại (FK) trong MySQL `DBQLPK` và ánh xạ Eloquent Relationships trong `be/app/Models/`.

---

## 1. Thứ tự DAG Khóa ngoại (6 Tầng phụ thuộc)

1. **Tầng 0 (Không phụ thuộc FK)**: `employees`, `roles`, `permissions`, `patients`, `services`, `service_packages`, `expense_categories`, `alert_rules`, `products`.
2. **Tầng 1**: `users` (`employee_id`), `role_permissions` (`role_id`, `permission_id`), `package_services` (`package_id`, `service_id`), `patient_packages` (`patient_id`, `package_id`).
3. **Tầng 2**: `user_roles`, `audit_logs`, `appointments`, `expenses`, `cash_transactions`, `kpi_targets`, `notifications`, `approval_requests`, `inventory_transactions`, `import_batches`, `system_settings`.
4. **Tầng 3**: `visits` (`patient_id`, `employee_id`, `service_id`, `patient_package_id`, `appointment_id`, `created_by`), `import_errors` (`batch_id`).
5. **Tầng 4**: `patient_files` (`patient_id`, `visit_id`, `uploaded_by`), `medical_records` (`visit_id` UNIQUE, `doctor_id`), `invoices` (`patient_id`, `visit_id`, `patient_package_id`, `created_by`).
6. **Tầng 5**: `payments` (`invoice_id`, `received_by`).

---

## 2. Bảng ánh xạ Quan hệ Eloquent (`be/app/Models/`)

| Model | Quan hệ chính (`BelongsTo` / `HasMany` / `HasOne` / `BelongsToMany` / `MorphTo`) | Chính sách `onDelete` |
|---|---|---|
| `Employee` | `users()` (`HasMany`), `user()` (`HasOne`), `appointments()`, `visits()`, `medicalRecords()`, `kpiTargets()` | `restrictOnDelete` / `nullOnDelete` |
| `User` | `employee()` (`BelongsTo`), `roles()` (`BelongsToMany` via `UserRole`), `auditLogs()` | `nullOnDelete` trên `employee_id` |
| `Role` | `permissions()` (`BelongsToMany` via `RolePermission`), `users()` (`BelongsToMany` via `UserRole`) | `cascadeOnDelete` trên bảng trung gian |
| `Permission` | `roles()` (`BelongsToMany` via `RolePermission`) | `cascadeOnDelete` trên bảng trung gian |
| `Patient` | `files()`, `appointments()`, `visits()`, `patientPackages()`, `invoices()` | `restrictOnDelete` đối với lịch hẹn/lượt khám/gói/hóa đơn |
| `Service` | `packages()` (`BelongsToMany` via `PackageService`), `appointments()`, `visits()` | `restrictOnDelete` |
| `ServicePackage` | `services()` (`BelongsToMany` via `PackageService`), `patientPackages()` | `restrictOnDelete` |
| `PatientPackage` | `patient()`, `package()`, `visits()`, `invoices()` | `restrictOnDelete` |
| `Appointment` | `patient()`, `employee()`, `service()`, `creator()`, `visits()` | `restrictOnDelete` |
| `Visit` | `patient()`, `employee()`, `service()`, `patientPackage()`, `appointment()`, `creator()`, `medicalRecord()` (`HasOne`), `patientFiles()`, `invoices()` | `restrictOnDelete` / `nullOnDelete` |
| `MedicalRecord` | `visit()` (`BelongsTo`, 1–1), `doctor()` (`BelongsTo` `Employee`) | `restrictOnDelete` trên `visit_id` |
| `Invoice` | `patient()`, `visit()`, `patientPackage()`, `creator()`, `payments()` | `restrictOnDelete` |
| `Payment` | `invoice()`, `receiver()`, `cashTransactions()` (`MorphMany`) | `restrictOnDelete` |
| `Expense` | `category()`, `creator()`, `approver()`, `cashTransactions()` (`MorphMany`), `approvalRequests()` (`MorphMany`) | `restrictOnDelete` |
| `CashTransaction` | `creator()`, `reference()` (`MorphTo`) | Polymorphic index `(reference_type, reference_id)` |
| `Notification` | `user()`, `reference()` (`MorphTo`) | `cascadeOnDelete` trên `user_id` |
| `ApprovalRequest` | `requester()`, `approver()`, `reference()` (`MorphTo`) | `restrictOnDelete` trên `requested_by` |
| `Product` | `inventoryTransactions()` | `restrictOnDelete` |
| `InventoryTransaction` | `product()`, `creator()`, `reference()` (`MorphTo`) | `restrictOnDelete` trên `product_id` |
| `ImportBatch` | `importer()`, `errors()` (`HasMany` `ImportError`) | `cascadeOnDelete` từ `import_errors` |
| `SystemSetting` | `updater()` (`BelongsTo` `User`) | `nullOnDelete` |
