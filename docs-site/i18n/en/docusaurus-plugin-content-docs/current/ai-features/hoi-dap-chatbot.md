---
title: Q&A Chatbot
sidebar_position: 1
---

# Q&A Chatbot

The built-in AI assistant helps users **self-serve** for common how-to questions about the system — no need to wait for customer service.

![AI assistant](/img/screenshots/chatbot-open.png)

## Open the chatbot

**Left sidebar** → click **"Q&A"** (❓ icon).

The chatbot panel opens on the **right** without covering the working area — you can ask and operate at the same time.

## Ask a question

Type a natural question in Vietnamese or English in the input at the bottom:

| Good question | Vague question |
|---|---|
| "How do I export the payroll report?" | "payroll" |
| "How to add a new customer" | "customer" |
| "What do drivers use to log into the app?" | "app" |

The chatbot uses **RAG (Retrieval-Augmented Generation)**:

1. Searches **43 curated knowledge topics**
2. If found → answers immediately with source attribution
3. If not found → suggests a hand-off to customer service

## Scope

The chatbot is **well-versed** in:

- ✅ How to use each feature (CRUD master data, orders, planning, reports)
- ✅ RBAC/DAC permissions
- ✅ Business workflows (approve → plan → deliver → reconcile)
- ✅ Common errors + fixes
- ✅ AI Agent capabilities
- ✅ Mobile driver app

The chatbot **will not** answer:

- ❌ Information outside TMS (weather, news...)
- ❌ Personal questions, investment advice...
- ❌ Specific database content ("status of order X") — that's the [AI Agent](/ai-features/ai-agent)'s job

:::tip Chatbot vs Agent
- **Q&A Chatbot** = answers "**how to do X**" (how-to, guidance)
- **AI Agent** = "**does X for you**" (UI automation) + reads live data
:::

## Hand-off to a human

If the chatbot has no answer, the panel shows a **"Contact support agent"** button:

1. Click the button → opens a form
2. Fill in:
   - Name + contact email
   - Specific problem
3. Click **"Send"**
4. Email is sent to admin@road-freight.io with the conversation context attached
5. Customer service replies via email within **24 business hours**

## Behind the scenes

- **LLM**: Google Gemini 2.5 Flash Lite (free, good enough for RAG)
- **Knowledge base**: 43 topics in `backend/src/utils/supportKnowledge.js`
- **Threshold**: score ≥ 5 to count as a match (avoids false positives)
- **Fallback**: outside scope → hand-off instead of hallucinating

## FAQ

**Q: The chatbot answered incorrectly?**
A: Use the **"Contact support agent"** button → describe the wrong answer. The team improves the knowledge base over time.

**Q: Is chat history saved?**
A: Yes. Returning to the chatbot keeps the previous conversation — context continues.

**Q: Can I ask in English?**
A: Yes. Gemini supports multiple languages, though the knowledge base is mostly in Vietnamese, so Vietnamese answers are more accurate.

**Q: Will the chatbot exhaust our Gemini quota?**
A: Each question uses ~1-2k tokens. The free tier (15 req/min) is enough for a small business. Scale up with Gemini Pro or self-hosted LLM later.

## Next

- [AI Agent](/ai-features/ai-agent) — Command the AI to operate the UI for you
