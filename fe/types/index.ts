// Auth types
export type {
  UserStatus,
  EmployeeProfile,
  UserRole,
  User,
  LoginCredentials,
  LoginResponseData,
  PaginationMeta,
  ApiResponse,
  PaginatedResponse,
  ApiErrorResponse,
  AuthContextType,
} from './auth';

// Employee types
export type {
  EmployeeStatus,
  Gender,
  EmployeeUser,
  Employee,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeQueryParams,
} from './employee';

// User types
export type {
  UserItem,
  CreateUserInput,
  UpdateUserInput,
  ChangePasswordInput,
  UserQueryParams,
  RoleItem,
} from './user';

// Patient types
export type {
  PatientStatus,
  DuplicateMatchedPatient,
  DuplicateWarning,
  Patient,
  CreatePatientInput,
  UpdatePatientInput,
  PatientQueryParams,
  CheckDuplicateInput,
  CheckDuplicateResponseData,
  PatientMutationResponse,
} from './patient';

// Service types
export type {
  ServiceStatus,
  Service,
  CreateServiceInput,
  UpdateServiceInput,
  ServiceQueryParams,
} from './service';

// Package types
export type {
  PackageStatus,
  PatientPackageStatus,
  ServicePackage,
  PatientPackage,
  CreatePackageInput,
  UpdatePackageInput,
  AssignPackageInput,
  PackageQueryParams,
} from './package';

// Appointment types
export type {
  AppointmentStatus,
  Appointment,
  CreateAppointmentInput,
  UpdateAppointmentInput,
  AppointmentQueryParams,
} from './appointment';
export { APPOINTMENT_STATUS_MAP } from './appointment';

// Visit types
export type {
  VisitStatus,
  VisitPaymentStatus,
  Visit,
  CreateVisitInput,
  UpdateVisitInput,
  VisitQueryParams,
} from './visit';
export { VISIT_STATUS_MAP, PAYMENT_STATUS_MAP } from './visit';

// Medical Record types
export type {
  MedicalRecord,
  CreateMedicalRecordInput,
  UpdateMedicalRecordInput,
} from './medical-record';

// KPI types
export type {
  KpiEvaluationStatus,
  KpiTarget,
  KpiSummary,
  CreateKpiTargetInput,
  UpdateKpiTargetInput,
  KpiQueryParams,
  KpiChartComparisonItem,
} from './kpi';
