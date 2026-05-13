import mongoose from "mongoose";

export const SupportTicketStatus = Object.freeze({
  OPEN: "OPEN",
  ANSWERED: "ANSWERED",
  CLOSED: "CLOSED"
});

const supportMessageSchema = new mongoose.Schema(
  {
    Sender: { type: String, enum: ["USER", "AI", "SUPPORT"], required: true },
    Body: { type: String, required: true, trim: true },
    CreatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const supportTicketSchema = new mongoose.Schema(
  {
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
    UserID: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    Subject: { type: String, required: true, trim: true },
    Status: { type: String, enum: Object.values(SupportTicketStatus), default: SupportTicketStatus.OPEN, index: true },
    Messages: { type: [supportMessageSchema], default: [] }
  },
  { timestamps: true }
);

supportTicketSchema.index({ UserID: 1, updatedAt: -1 });

export const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);
