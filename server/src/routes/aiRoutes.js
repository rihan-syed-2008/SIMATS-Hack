const express = require("express");
const Groq = require("groq-sdk");
const client = require("../config/sanity");
const crypto = require("crypto");
const router = express.Router();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

router.get("/conversations/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const chats = await client.fetch(
      `*[_type == "message" && userId == $userId] | order(timestamp desc){
    contextId,
    timestamp
  }`,
      { userId },
    );

    const uniqueContexts = [
      ...new Map(chats.map((item) => [item.contextId, item])).values(),
    ];

    res.json(uniqueContexts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.get("/history/:contextId", async (req, res) => {
  try {
    const { contextId } = req.params;

    const history = await client.fetch(
      `*[_type == "message" && contextId == $contextId] | order(timestamp asc)`,
      { contextId },
    );

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: "Failed to load history" });
  }
});

router.post("/chat", async (req, res) => {
  try {
    const { message, roomId, userId } = req.body;

    if (!message || !userId) {
      return res.status(400).json({ error: "Message and userId required" });
    }

    // 🔥 Decide memory context
    let contextId;

    if (roomId) {
      contextId = roomId;
    } else {
      // If frontend sends existing contextId → reuse it
      if (req.body.contextId) {
        contextId = req.body.contextId;
      } else {
        // First message → generate title
        contextId = message
          .slice(0, 30)
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, "")
          .replace(/\s+/g, "_");
      }
    }

    // 1️⃣ Fetch previous messages for this context
    const history = await client.fetch(
      `*[_type == "message" && contextId == $contextId] | order(timestamp asc)`,
      { contextId },
    );

    // 2️⃣ Convert history to model format
    const messages = history.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Optional system message
    messages.unshift({
      role: "system",
      content: `You are a highly intelligent academic AI assistant.

Always respond in a clear, structured format using:

• Headings
• Bullet points
• Short paragraphs
• Code blocks when needed
• Step-by-step explanations when helpful

Keep answers clean and professional.
Avoid long messy paragraphs.
Be concise but structured.
`,
    });

    // Add current user message
    messages.push({
      role: "user",
      content: message,
    });

    // 3️⃣ Call GROQ with memory (limit last 20 messages)
    const completion = await groq.chat.completions.create({
      messages: messages.slice(-20),
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
    });

    const reply = completion.choices[0].message.content;

    // 4️⃣ Save user message
    await client.create({
      _type: "message",
      contextId,
      userId,
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    });

    // 5️⃣ Save AI message
    await client.create({
      _type: "message",
      contextId,
      userId: "AI",
      role: "assistant",
      content: reply,
      timestamp: new Date().toISOString(),
    });

    res.json({ reply, contextId });
  } catch (error) {
    console.error("Groq Error:", error);
    res.status(500).json({ error: "AI failed" });
  }
});
router.post("/generate-quiz", async (req, res) => {
  try {
    const { topic, roomId, userId, questionCount, questionType } = req.body;

    if (!topic || !userId) {
      return res.status(400).json({ error: "Topic and userId required" });
    }

    let contextId;

    if (roomId) {
      contextId = roomId;
    } else {
      // If frontend sends existing contextId → reuse it
      if (req.body.contextId) {
        contextId = req.body.contextId;
      } else {
        // First message → generate title
        contextId = topic
          .slice(0, 30)
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, "")
          .replace(/\s+/g, "_");
      }
    }

    const count = questionCount || 10;

    const prompt = `
Generate ${count} questions about "${topic}".

Question type: ${questionType}.

Rules:

If questionType is:
- "mcq" → All questions must be multiple choice.
- "truefalse" → All must be True/False.
- "fill" → All must be fill in the blank.
- "mixed" → Random mix of all three types.

Return ONLY valid JSON array in this exact format:

[
  {
    "type": "mcq | truefalse | fill",
    "question": "Question text",
    "options": ["A", "B", "C", "D"],  // ONLY for mcq
    "correctAnswer": "Correct answer text"
  }
]

Important rules:
- type field is mandatory.
- For truefalse, DO NOT include options.
- For fill, DO NOT include options.
- For truefalse, correctAnswer must be exactly "True" or "False".
- No markdown.
- No explanations.
- Return pure JSON only.
`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
    });

    const rawText = completion.choices[0].message.content;

    let questions;

    try {
      const cleanedText = rawText.trim();

      const jsonStart = cleanedText.indexOf("[");
      const jsonEnd = cleanedText.lastIndexOf("]") + 1;

      if (jsonStart === -1 || jsonEnd === -1) {
        return res.status(500).json({
          error: "AI did not return valid JSON.",
        });
      }

      const jsonString = cleanedText.slice(jsonStart, jsonEnd);

      questions = JSON.parse(jsonString);

      // Normalize types
      questions = questions.map((q) => {
        const normalizedType = q.type?.toLowerCase() || "mcq";

        let normalizedAnswer = q.correctAnswer;

        if (normalizedType === "truefalse") {
          normalizedAnswer =
            normalizedAnswer?.toString().toLowerCase() === "true"
              ? "True"
              : "False";
        }

        return {
          ...q,
          type: normalizedType,
          correctAnswer: normalizedAnswer,
        };
      });
    } catch (err) {
      return res.status(500).json({
        error: "AI returned invalid JSON. Try again.",
      });
    }

    // Save quiz in Sanity
    await client.create({
      _type: "quiz",
      contextId,
      topic,
      questions,
      createdAt: new Date().toISOString(),
    });

    res.json({ questions, contextId });
  } catch (error) {
    console.error("Quiz Error:", error);
    res.status(500).json({ error: "Quiz generation failed" });
  }
});
router.post("/generate-flashcards", async (req, res) => {
  try {
    const { topic, roomId, userId } = req.body;

    if (!topic || !userId) {
      return res.status(400).json({ error: "Topic and userId required" });
    }

    let contextId;

    if (roomId) {
      contextId = roomId;
    } else {
      // If frontend sends existing contextId → reuse it
      if (req.body.contextId) {
        contextId = req.body.contextId;
      } else {
        // First message → generate title
        contextId = topic
          .slice(0, 30)
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, "")
          .replace(/\s+/g, "_");
      }
    }

    const prompt = `
Generate 10 flashcards about "${topic}".

Return ONLY valid JSON in this format:

[
  {
    "question": "Question text",
    "answer": "Answer text"
  }
]

Do not include markdown.
Do not include explanations.
Only return pure JSON.
`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
    });

    const rawText = completion.choices[0].message.content;

    let cards;

    try {
      const cleanedText = rawText.trim();
      const jsonStart = cleanedText.indexOf("[");
      const jsonEnd = cleanedText.lastIndexOf("]") + 1;

      const jsonString = cleanedText.slice(jsonStart, jsonEnd);
      cards = JSON.parse(jsonString);

      // Add unique _key for each card
      cards = cards.map((card) => ({
        _key: crypto.randomUUID(),
        ...card,
      }));
    } catch (err) {
      return res.status(500).json({
        error: "AI returned invalid JSON",
      });
    }

    await client.create({
      _type: "flashcardSet",
      contextId,
      topic,
      cards,
      createdAt: new Date().toISOString(),
    });

    res.json({ cards, contextId });
  } catch (error) {
    console.error("Flashcard Error:", error);
    res.status(500).json({ error: "Flashcard generation failed" });
  }
});

module.exports = router;
