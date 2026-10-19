module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    res.status(200);
    return res.send("Invalid request method.");
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const messages = body?.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(200);
      return res.send("Request format error.");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(200);
      return res.send("Configuration Error: GEMINI_API_KEY missing in Vercel.");
    }

    const systemInstruction = {
      parts: [
        {
          text: "You are Farman Kisan Hub AI Assistant, an expert agricultural advisor. Give extremely short, concise, accurate, and direct answers (maximum 2 to 4 sentences). Never output internal reasoning, rules, or system thoughts. Do NOT use markdown symbols like stars (*), bold (**), or hashtags (#). Answer strictly in the same language as user query (Roman Urdu, Urdu, or English). Remember conversation history.",
        },
      ],
    };

    const formattedContents = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // Fast models — thinking OFF (2.5 family thinkingBudget 0 support karti hai)
    const modelsToTry = [
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash",
      "gemini-flash-lite-latest",
      "gemini-flash-latest",
    ];

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.status(200);
    if (res.flushHeaders) res.flushHeaders();

    let streamed = false;

    for (const model of modelsToTry) {
      if (streamed) break;
      try {
        const url =
          "https://generativelanguage.googleapis.com/v1beta/models/" +
          model +
          ":streamGenerateContent?alt=sse&key=" +
          apiKey;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: systemInstruction,
            contents: formattedContents,
            generationConfig: {
              maxOutputTokens: 500,
              temperature: 0.4,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        });

        if (!response.ok || !response.body) continue;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });

          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;
            try {
              const data = JSON.parse(jsonStr);
              const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                res.write(text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/#/g, ""));
                streamed = true;
              }
            } catch (e) { /* partial chunk */ }
          }
        }
      } catch (err) {
        /* agla model try karo */
      }
    }

    if (!streamed) {
      res.write("Maazrat, server busy hai. Dobara koshish karein.");
    }
    res.end();
  } catch (err) {
    res.end("Server exception error: " + err.message);
  }
};
