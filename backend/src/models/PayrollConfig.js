import mongoose from "mongoose";

/**
 * PayrollConfig — cấu hình lương tài xế per tổ chức.
 * Mỗi org có 1 doc duy nhất; nếu chưa có dùng default.
 */
const payrollConfigSchema = new mongoose.Schema(
  {
    OrganizationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true
    },
    BaseSalary: { type: Number, default: 8_000_000, min: 0 },           // Lương cứng / tháng
    KmThreshold: { type: Number, default: 1000, min: 0 },               // Ngưỡng km mới tính thưởng
    PerKmBonus: { type: Number, default: 500, min: 0 },                 // VND / km vượt
    PerCompletedTrip: { type: Number, default: 50_000, min: 0 },        // VND / chuyến HT
    CodCommissionRate: { type: Number, default: 0.005, min: 0, max: 1 },// 0.005 = 0.5%
    UpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

export const PayrollConfig = mongoose.model("PayrollConfig", payrollConfigSchema);

export const DEFAULT_PAYROLL_CONFIG = {
  BaseSalary: 8_000_000,
  KmThreshold: 1000,
  PerKmBonus: 500,
  PerCompletedTrip: 50_000,
  CodCommissionRate: 0.005
};

/**
 * Load config cho org. Nếu chưa có doc → trả default. Không tạo ngầm.
 */
export async function loadPayrollConfig(orgId) {
  if (!orgId) return { ...DEFAULT_PAYROLL_CONFIG };
  const doc = await PayrollConfig.findOne({ OrganizationID: orgId }).lean();
  if (!doc) return { ...DEFAULT_PAYROLL_CONFIG };
  return {
    BaseSalary: doc.BaseSalary,
    KmThreshold: doc.KmThreshold,
    PerKmBonus: doc.PerKmBonus,
    PerCompletedTrip: doc.PerCompletedTrip,
    CodCommissionRate: doc.CodCommissionRate
  };
}
