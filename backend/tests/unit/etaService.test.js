/**
 * Tests cho etaService — cascade ETA ±20p + giải trình lệch giờ.
 *
 * Cover:
 *   - hhmmToMinutes / minutesToHhmm parsing & wrap-around 24h.
 *   - cascadeEta: dịch đúng các điểm sau, không động vào điểm đã COMPLETED.
 *   - handleStopCompletion: |dev| ≤ 20 → autoCascaded; |dev| > 20 → requiresExplanation.
 *   - DEVIATION_THRESHOLD_MIN = 20.
 */
import {
  hhmmToMinutes, minutesToHhmm, cascadeEta, handleStopCompletion, DEVIATION_THRESHOLD_MIN
} from "../../src/services/etaService.js";

const TripTaskStatus = { PENDING: "PENDING", COMPLETED: "COMPLETED", FAILED: "FAILED" };

function makeTrip(tasks) {
  return {
    _id: "trip1",
    OrganizationID: "org1",
    TripCode: "T1",
    VehicleCode: "V1",
    Tasks: tasks,
    EtaHistory: [],
    toString() { return "trip1"; }
  };
}

describe("etaService.hhmmToMinutes", () => {
  test("parses standard HH:mm", () => {
    expect(hhmmToMinutes("08:30")).toBe(8 * 60 + 30);
    expect(hhmmToMinutes("00:00")).toBe(0);
    expect(hhmmToMinutes("23:59")).toBe(23 * 60 + 59);
  });
  test("returns null for invalid input", () => {
    expect(hhmmToMinutes(null)).toBeNull();
    expect(hhmmToMinutes("")).toBeNull();
    expect(hhmmToMinutes("25:00")).toBeNull();
    expect(hhmmToMinutes("8:65")).toBeNull();
  });
});

describe("etaService.minutesToHhmm", () => {
  test("formats with zero-pad", () => {
    expect(minutesToHhmm(8 * 60 + 5)).toBe("08:05");
    expect(minutesToHhmm(0)).toBe("00:00");
  });
  test("wraps around 24h for negative/overflow", () => {
    expect(minutesToHhmm(-10)).toBe("23:50");
    expect(minutesToHhmm(1450)).toBe("00:10");
  });
});

describe("etaService.cascadeEta", () => {
  test("dịch các điểm StopIndex > fromStopIndex, bỏ qua COMPLETED", () => {
    const trip = makeTrip([
      { StopIndex: 1, PlannedArrivalTime: "08:00", PlannedDepartureTime: "08:15", Status: "COMPLETED" },
      { StopIndex: 2, PlannedArrivalTime: "09:00", PlannedDepartureTime: "09:15", Status: "PENDING" },
      { StopIndex: 3, PlannedArrivalTime: "10:00", PlannedDepartureTime: "10:15", Status: "PENDING" }
    ]);
    const r = cascadeEta(trip, { fromStopIndex: 1, shiftMinutes: 30, reason: "TRAFFIC" });
    expect(r.shifted).toBe(2);
    expect(trip.Tasks[0].PlannedArrivalTime).toBe("08:00"); // COMPLETED không bị đổi (cũng StopIndex=1, bị filter)
    expect(trip.Tasks[1].PlannedArrivalTime).toBe("09:30");
    expect(trip.Tasks[1].PlannedDepartureTime).toBe("09:45");
    expect(trip.Tasks[2].PlannedArrivalTime).toBe("10:30");
    expect(trip.EtaHistory).toHaveLength(1);
    expect(trip.EtaHistory[0].ShiftMinutes).toBe(30);
  });

  test("không dịch nếu shiftMinutes = 0", () => {
    const trip = makeTrip([{ StopIndex: 2, PlannedArrivalTime: "09:00", Status: "PENDING" }]);
    const r = cascadeEta(trip, { fromStopIndex: 1, shiftMinutes: 0 });
    expect(r.shifted).toBe(0);
    expect(trip.EtaHistory).toHaveLength(0);
  });

  test("shift âm = dịch về sớm hơn", () => {
    const trip = makeTrip([{ StopIndex: 2, PlannedArrivalTime: "09:00", Status: "PENDING" }]);
    cascadeEta(trip, { fromStopIndex: 1, shiftMinutes: -15, reason: "EARLY" });
    expect(trip.Tasks[0].PlannedArrivalTime).toBe("08:45");
  });
});

describe("etaService.handleStopCompletion", () => {
  test("|dev| ≤ 20 → autoCascaded, requiresExplanation = false", () => {
    /* Giả lập task đã complete trễ 10 phút.
       Plan: 08:00, Actual (qua CompletedAt) → set tay = 08:10 UTC+7.
       08:10 VN = 01:10 UTC. */
    const trip = makeTrip([
      { StopIndex: 1, PlannedArrivalTime: "08:00",
        Status: TripTaskStatus.COMPLETED, CompletedAt: new Date(Date.UTC(2025,0,1, 1, 10)) },
      { StopIndex: 2, PlannedArrivalTime: "09:00", Status: TripTaskStatus.PENDING },
      { StopIndex: 3, PlannedArrivalTime: "10:00", Status: TripTaskStatus.PENDING }
    ]);
    const r = handleStopCompletion(trip, 1);
    expect(r.autoCascaded).toBe(true);
    expect(r.requiresExplanation).toBe(false);
    expect(r.deviationMin).toBe(10);
    expect(trip.Tasks[1].PlannedArrivalTime).toBe("09:10");
    expect(trip.Tasks[2].PlannedArrivalTime).toBe("10:10");
  });

  test("|dev| > 20 → requiresExplanation = true, KHÔNG cascade ngay", () => {
    /* Trễ 45 phút → ngoài ngưỡng, không tự dịch. */
    const trip = makeTrip([
      { StopIndex: 1, PlannedArrivalTime: "08:00",
        Status: TripTaskStatus.COMPLETED, CompletedAt: new Date(Date.UTC(2025,0,1, 1, 45)) },
      { StopIndex: 2, PlannedArrivalTime: "09:00", Status: TripTaskStatus.PENDING }
    ]);
    const r = handleStopCompletion(trip, 1);
    expect(r.autoCascaded).toBe(false);
    expect(r.requiresExplanation).toBe(true);
    expect(r.deviationMin).toBe(45);
    expect(trip.Tasks[1].PlannedArrivalTime).toBe("09:00"); // chưa cascade
    expect(trip.EtaHistory).toHaveLength(0);
  });

  test("đến sớm 25 phút (|dev|>20) → requiresExplanation cho case sớm", () => {
    const trip = makeTrip([
      { StopIndex: 1, PlannedArrivalTime: "10:00",
        Status: TripTaskStatus.COMPLETED, CompletedAt: new Date(Date.UTC(2025,0,1, 2, 35)) }, // 09:35 VN
      { StopIndex: 2, PlannedArrivalTime: "11:00", Status: TripTaskStatus.PENDING }
    ]);
    const r = handleStopCompletion(trip, 1);
    expect(r.deviationMin).toBe(-25);
    expect(r.autoCascaded).toBe(false);
    expect(r.requiresExplanation).toBe(true);
  });

  test("task không có PlannedArrivalTime hợp lệ → no-op", () => {
    const trip = makeTrip([
      { StopIndex: 1, PlannedArrivalTime: "", Status: TripTaskStatus.COMPLETED, CompletedAt: new Date() },
      { StopIndex: 2, PlannedArrivalTime: "09:00", Status: TripTaskStatus.PENDING }
    ]);
    const r = handleStopCompletion(trip, 1);
    expect(r.autoCascaded).toBe(false);
    expect(r.requiresExplanation).toBe(false);
    expect(trip.Tasks[1].PlannedArrivalTime).toBe("09:00");
  });
});

describe("DEVIATION_THRESHOLD_MIN", () => {
  test("constant = 20", () => {
    expect(DEVIATION_THRESHOLD_MIN).toBe(20);
  });
});
