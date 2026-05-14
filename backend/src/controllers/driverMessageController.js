import { Driver } from "../models/Driver.js";
import { DriverMessage, DriverMessageSender } from "../models/DriverMessage.js";
import { Trip } from "../models/Trip.js";
import { assertOrgInScope, scopeFilter } from "../middlewares/dac.js";
import { ApiError } from "../utils/apiError.js";
import { getIO } from "../socket.js";

function cleanText(text) {
  return String(text ?? "").trim().slice(0, 2000);
}

function emitMessage(message) {
  try {
    getIO()?.to(`org_${message.OrganizationID.toString()}`).emit("driver-message:new", message);
    if (message.DriverUserID) getIO()?.to(`user_${message.DriverUserID.toString()}`).emit("driver-message:new", message);
  } catch {
    // Socket is optional for this feature; polling still works.
  }
}

async function loadScopedTrip(req) {
  const trip = await Trip.findById(req.params.id).lean();
  if (!trip) throw new ApiError(404, "Trip not found");
  assertOrgInScope(req.orgScope, trip.OrganizationID);
  return trip;
}

async function loadDriverTrip(req) {
  const driver = await Driver.findOne({ LinkedUserID: req.user._id, Status: "Active" }).lean();
  if (!driver) throw new ApiError(403, "Tài khoản chưa liên kết tài xế");
  const trip = await Trip.findOne({ _id: req.params.id, DriverID: driver._id }).lean();
  if (!trip) throw new ApiError(404, "Trip not found");
  return { driver, trip };
}

export async function listTripMessages(req, res) {
  const trip = await loadScopedTrip(req);
  const messages = await DriverMessage.find({ TripID: trip._id })
    .sort({ createdAt: 1 })
    .lean();
  res.json({ success: true, data: messages });
}

export async function sendTripMessage(req, res) {
  const trip = await loadScopedTrip(req);
  const text = cleanText(req.body?.text);
  if (!text) throw new ApiError(400, "Nội dung tin nhắn là bắt buộc");

  const message = await DriverMessage.create({
    OrganizationID: trip.OrganizationID,
    TripID: trip._id,
    DriverID: trip.DriverID,
    DriverUserID: trip.DriverUserID,
    SenderType: DriverMessageSender.DISPATCHER,
    SenderUserID: req.user._id,
    SenderName: req.user.FullName || req.user.UserName || "Dispatcher",
    Text: text
  });
  emitMessage(message);
  res.status(201).json({ success: true, data: message });
}

export async function listMyMessages(req, res) {
  const driver = await Driver.findOne({ LinkedUserID: req.user._id, Status: "Active" }).lean();
  if (!driver) throw new ApiError(403, "Tài khoản chưa liên kết tài xế");
  const messages = await DriverMessage.find({ DriverUserID: req.user._id })
    .sort({ createdAt: 1 })
    .limit(300)
    .lean();
  res.json({ success: true, data: messages });
}

export async function listMyTripMessages(req, res) {
  const { trip } = await loadDriverTrip(req);
  const messages = await DriverMessage.find({ TripID: trip._id, DriverUserID: req.user._id })
    .sort({ createdAt: 1 })
    .lean();
  res.json({ success: true, data: messages });
}

export async function sendMyTripMessage(req, res) {
  const { driver, trip } = await loadDriverTrip(req);
  const text = cleanText(req.body?.text);
  if (!text) throw new ApiError(400, "Nội dung tin nhắn là bắt buộc");

  const message = await DriverMessage.create({
    OrganizationID: trip.OrganizationID,
    TripID: trip._id,
    DriverID: driver._id,
    DriverUserID: req.user._id,
    SenderType: DriverMessageSender.DRIVER,
    SenderUserID: req.user._id,
    SenderName: req.user.FullName || driver.XName || "Tài xế",
    Text: text
  });
  emitMessage(message);
  res.status(201).json({ success: true, data: message });
}

export async function unreadCounts(req, res) {
  const filter = { ...scopeFilter(req.orgScope), SenderType: DriverMessageSender.DRIVER, ReadByDispatcherAt: null };
  const rows = await DriverMessage.aggregate([
    { $match: filter },
    { $group: { _id: "$TripID", count: { $sum: 1 } } }
  ]);
  res.json({ success: true, data: rows.map((row) => ({ TripID: row._id, count: row.count })) });
}
