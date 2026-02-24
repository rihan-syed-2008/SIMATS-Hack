import { useState } from "react";
import "./AI.css";
import { jsPDF } from "jspdf";

function Flashcards() {
  const [topic, setTopic] = useState("");
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const currentUserId = localStorage.getItem("userId");
  const [currentContextId, setCurrentContextId] = useState(null);

  const downloadFlashcards = () => {
    const doc = new jsPDF();

    let y = 10;

    doc.setFontSize(16);
    doc.text("AI Flashcards", 10, y);
    y += 10;

    doc.setFontSize(12);
    doc.text(`Topic: ${topic}`, 10, y);
    y += 10;

    cards.forEach((card, index) => {
      doc.setFontSize(12);
      doc.text(`Card ${index + 1}`, 10, y);
      y += 7;

      doc.text("Q:", 10, y);
      y += 6;
      const splitQ = doc.splitTextToSize(card.question, 170);
      doc.text(splitQ, 15, y);
      y += splitQ.length * 6;
      y += 8;

      doc.text("A:", 10, y);
      y += 6;
      const split = doc.splitTextToSize(card.answer, 170);
      doc.text(split, 15, y);
      y += split.length * 6;
      y += 10;

      if (y > 270) {
        doc.addPage();
        y = 10;
      }
    });

    doc.save(`Flashcards_${topic}.pdf`);
  };

  const generateFlashcards = async () => {
    if (!topic.trim()) return;

    setLoading(true);
    setCards([]);
    setCurrentIndex(0);
    setFlipped(false);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/ai/generate-flashcards`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            userId: currentUserId,
            roomId: null,
            contextId: currentContextId,
          }),
        },
      );

      const data = await res.json();
      setCards(data.cards);

      if (!currentContextId) {
        setCurrentContextId(data.contextId);
      }
    } catch (err) {
      console.error("Flashcard error:", err);
    } finally {
      setLoading(false);
    }
  };

  const nextCard = () => {
    setFlipped(false);
    setCurrentIndex((prev) => (prev + 1 < cards.length ? prev + 1 : prev));
  };

  const prevCard = () => {
    setFlipped(false);
    setCurrentIndex((prev) => (prev - 1 >= 0 ? prev - 1 : prev));
  };

  return (
    <div className="ai-wrapper">
      <div className="ai-card">
        <h2 className="ai-title">AI Flashcards</h2>

        <div className="ai-input-group">
          <input
            type="text"
            placeholder="Enter topic..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />

          <button
            onClick={generateFlashcards}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>

        {cards.length > 0 && (
          <>
            <p className="flashcard-hint">Tap the card to reveal the answer</p>
            <div className="flashcard-container">
              <div
                className={`flashcard ${flipped ? "flipped" : ""}`}
                onClick={() => setFlipped(!flipped)}
              >
                <div className="flashcard-front">
                  {cards[currentIndex].question}
                </div>
                <div className="flashcard-back">
                  {cards[currentIndex].answer}
                </div>
              </div>
            </div>

            <div className="flashcard-controls">
              <button onClick={prevCard} disabled={currentIndex === 0}>
                Prev
              </button>
              <span>
                {currentIndex + 1} / {cards.length}
              </span>
              <button
                onClick={nextCard}
                disabled={currentIndex === cards.length - 1}
              >
                Next
              </button>
            </div>
            <div className="flashcard-download">
              <button onClick={downloadFlashcards} className="btn-primary">
                Download Flashcards
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Flashcards;
