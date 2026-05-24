import { apiClient } from "./client";

export const payrollApi = {
  drivers: (params = {}) => apiClient.get("/payroll/drivers", { params }).then((r) => r.data),
  getConfig: () => apiClient.get("/payroll/config").then((r) => r.data),
  updateConfig: (body) => apiClient.put("/payroll/config", body).then((r) => r.data)
};
