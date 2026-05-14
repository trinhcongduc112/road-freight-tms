import mongoose from "mongoose";

export const DriverMessageSender = Object.freeze({
  DISPATCHER: "DISPATCHER",
  DRIVER: "DRIVER"
});

const driverMessageSchema = new mongoose.Schema(
  {
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    TripID: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    DriverID: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", default: null, index: true },
    DriverUserID: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    SenderType: { type: String, enum: Object.values(DriverMessageSender), required: true, index: true },
    SenderUserID: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    SenderName: { type: String, trim: true, default: "" },
    Text: { type: String, trim: true, required: true, maxlength: 2000 },
    ReadByDriverAt: { type: Date, default: null },
    ReadByDispatcherAt: { type: Date, default: null }
  },
  { timestamps: true }
);

driverMessageSchema.index({ TripID: 1, createdAt: 1 });
driverMessageSchema.index({ DriverUserID: 1, createdAt: -1 });

export const DriverMessage = mongoose.model("DriverMessage", driverMessageSchema);
