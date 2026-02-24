import { useState, useRef, useEffect } from "react";
import "./AI.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
function Chat() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const currentUserId = localStorage.getItem("userId");
  const [currentContextId, setCurrentContextId] = useState(null);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const fetchConversations = async () => {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/ai/conversations/${currentUserId}`,
      );
      const data = await res.json();
      setConversations(data);
    };

    fetchConversations();
  }, [currentUserId]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!currentContextId) return;

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/ai/history/${currentContextId}`,
      );

      const data = await res.json();

      setMessages(
        data.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      );
    };

    loadHistory();
  }, [currentContextId]);

  const startNewChat = () => {
    setMessages([]);
    setCurrentContextId(null);
  };

  const askAI = async () => {
    if (!prompt.trim()) return;

    const userMessage = {
      role: "user",
      content: prompt,
    };

    setMessages((prev) => [...prev, userMessage]);
    setPrompt("");
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          userId: currentUserId,
          roomId: null,
          contextId: currentContextId,
        }),
      });

      const data = await res.json();

      const aiMessage = {
        role: "assistant",
        content: data.reply,
      };

      setMessages((prev) => [...prev, aiMessage]);

      if (!currentContextId) {
        setCurrentContextId(data.contextId);

        const resConv = await fetch(
          `${import.meta.env.VITE_API_URL}/api/ai/conversations/${currentUserId}`,
        );
        const dataConv = await resConv.json();
        setConversations(dataConv);
      }
    } catch (err) {
      console.log(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "AI failed to respond." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askAI();
    }
  };

  return (
    <div className="chat-wrapper">
      <div className="chat-sidebar">
        {Array.isArray(conversations) &&
          conversations.map((chat) => (
            <div
              key={chat.contextId}
              onClick={() => setCurrentContextId(chat.contextId)}
              className={`conversation-item ${
                currentContextId === chat.contextId ? "active" : ""
              }`}
            >
              {chat.contextId.replace(/_/g, " ")}
            </div>
          ))}
      </div>
      <div className="chat-card">
        <h2 className="ai-title">AI Assistant</h2>
        <button onClick={startNewChat}>New Chat</button>

        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`chat-bubble ${
                msg.role === "user" ? "user" : "assistant"
              }`}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {msg.content}
              </ReactMarkdown>
            </div>
          ))}

          {loading && (
            <div className="chat-bubble assistant typing">Thinking...</div>
          )}

          <div ref={bottomRef}></div>
        </div>

        <div className="chat-input-area">
          <textarea
            placeholder="Ask anything..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <button onClick={askAI} disabled={loading}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;
