import mongoose from "mongoose";

export const ChatHandledBy = Object.freeze({
  BOT: "bot",
  HUMAN: "human"
});

export const ChatMessageSender = Object.freeze({
  USER: "user",
  BOT: "bot",
  HUMAN: "human",
  SYSTEM: "system"
});

const chatMessageSchema = new mongoose.Schema(
  {
    sender: { type: String, enum: Object.values(ChatMessageSender), required: true },
    body: { type: String, required: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const chatSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
    handledBy: {
      type: String,
      enum: Object.values(ChatHandledBy),
      default: ChatHandledBy.BOT,
      index: true
    },
    status: { type: String, enum: ["OPEN", "ANSWERED", "CLOSED"], default: "OPEN", index: true },
    subject: { type: String, trim: true, default: "" },
    messages: { type: [chatMessageSchema], default: [] }
  },
  { timestamps: true }
);

chatSessionSchema.index({ userId: 1, updatedAt: -1 });
chatSessionSchema.index({ OrganizationID: 1, handledBy: 1, updatedAt: -1 });

export const ChatSession = mongoose.model("ChatSession", chatSessionSchema);
