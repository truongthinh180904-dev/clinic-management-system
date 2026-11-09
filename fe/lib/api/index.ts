export {
  ApiError,
  apiClient,
  getStoredToken,
  setStoredToken,
  removeStoredToken,
  request,
} from './client';

export {
  loginApi,
  getMeApi,
  logoutApi,
} from './auth';

export {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
  deleteEmployee,
} from './employees';

export {
  getUsers,
  getUser,
  createUser,
  updateUser,
  updateUserStatus,
  changeUserPassword,
  deleteUser,
  getRoles,
  updateUserRoles,
} from './users';

export {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  updatePatientStatus,
  deletePatient,
  checkDuplicatePatients,
} from './patients';

export {
  getServices,
  getService,
  createService,
  updateService,
  updateServiceStatus,
  deleteService,
} from './services';

export {
  getServicePackages,
  getServicePackage,
  createServicePackage,
  updateServicePackage,
  updateServicePackageStatus,
  deleteServicePackage,
  assignPackageToPatient,
  getPatientPackages,
  getPatientPackage,
  updatePatientPackageStatus,
  getAllPatientPackages,
} from './packages';

export {
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
  cancelAppointment,
  deleteAppointment,
} from './appointments';

export {
  getVisits,
  getVisit,
  createVisit,
  updateVisit,
  updateVisitStatus,
  cancelVisit,
  deleteVisit,
} from './visits';

export {
  getVisitMedicalRecord,
  createVisitMedicalRecord,
  updateVisitMedicalRecord,
  getMedicalRecord,
  updateMedicalRecord,
} from './medical-records';
