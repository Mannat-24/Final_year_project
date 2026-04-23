import { useState } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const AiChatWidget = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        user?.role === "teacher"
          ? "AI Coach ready. Ask for class strategy or enter a student admission number (for example GFPS-1001)."
          : "AI Coach ready. Ask for study plans, weak areas, or test strategy."
    }
  ]);

  if (!["teacher", "student"].includes(user?.role)) return null;

  const send = async () => {
    if (!text.trim() || loading) return;

    const userMessage = text.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setText("");
    setLoading(true);

    try {
      const payload = { message: userMessage };
      if (user.role === "teacher" && studentCode.trim()) payload.studentCode = studentCode.trim();
      const { data } = await client.post("/ai/chat", payload);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "AI service is temporarily unavailable." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-5 z-[60] w-[92vw] max-w-sm rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold">AI Progress Assistant</h3>
            <button className="text-sm text-slate-500" onClick={() => setOpen(false)}>Close</button>
          </div>

          {user.role === "teacher" && (
            <input
              className="input mb-2"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
              placeholder="Admission Number (e.g. GFPS-1001)"
            />
          )}

          <div className="mb-2 h-56 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2 dark:bg-slate-800">
            {messages.map((m, i) => (
              <div key={i} className={`rounded-xl px-3 py-2 text-sm ${m.role === "assistant" ? "bg-white dark:bg-slate-700" : "bg-brand-500 text-white"}`}>
                {m.content}
              </div>
            ))}
            {loading && <div className="text-xs text-slate-500">Thinking...</div>}
          </div>

          <div className="flex gap-2">
            <input
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask AI for suggestions"
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
            />
            <button className="btn-primary" onClick={send}>Send</button>
          </div>
        </div>
      )}

      <button
        className="fixed bottom-4 right-4 z-[60] flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-cyan-500 text-white shadow-2xl ring-2 ring-white/60 transition hover:scale-105"
        onClick={() => setOpen((v) => !v)}
        title="Open AI Assistant"
      >
        <img src="/robot-icon.svg" alt="AI Robot" className="h-10 w-10" />
      </button>
    </>
  );
};

export default AiChatWidget;

