// Hạng bằng lái → danh sách loại xe được phép điều khiển (theo quy định VN)
export const LICENSE_VEHICLE_MAP = Object.freeze({
  A1: ["BIKE"],
  A2: ["BIKE"],
  B1: ["BIKE"],
  B2: ["BIKE"],
  C:  ["TRUCK", "BIKE"],
  D:  ["TRUCK", "BIKE"],
  E:  ["TRUCK", "SEMI_TRUCK", "TRAILER", "BIKE"],
  F:  ["TRUCK", "SEMI_TRUCK", "TRAILER", "BIKE"]
});

export function canDrive(licenseType, vehicleType) {
  return LICENSE_VEHICLE_MAP[licenseType]?.includes(vehicleType) ?? false;
}
