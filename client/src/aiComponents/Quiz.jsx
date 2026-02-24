import { useState, useEffect } from "react";
import "./AI.css";
import { jsPDF } from "jspdf";

function Quiz({
  mode = "live",
  quiz = null,
  roomCode,
  socket,
  isHost = false,
  onEndQuiz = null,
}) {
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);

  const currentUserId = localStorage.getItem("userId");
  const [currentContextId, setCurrentContextId] = useState(null);
  const [questionCount, setQuestionCount] = useState("");
  const [questionType, setQuestionType] = useState("mixed");

  const isRoomMode = !!roomCode;

  useEffect(() => {
    if (quiz && roomCode) {
      console.log("Questions received:", quiz);
      console.log("First question type:", quiz[0]?.type);
      setQuestions(quiz);
    }
  }, [quiz, roomCode]);

  const downloadQuizReport = () => {
    const doc = new jsPDF();

    let y = 10;

    doc.setFontSize(16);
    doc.text("AI Quiz Report", 10, y);
    y += 10;

    doc.setFontSize(12);
    doc.text(`Topic: ${topic}`, 10, y);
    y += 8;

    doc.text(`Score: ${score} / ${questions.length}`, 10, y);
    y += 10;

    questions.forEach((q, index) => {
      const userAnswer = selectedAnswers[index] || "Not Answered";
      const correct =
        userAnswer.toString().trim().toLowerCase() ===
        q.correctAnswer.toString().trim().toLowerCase();

      doc.setFontSize(11);
      doc.text(`${index + 1}. ${q.question}`, 10, y);
      y += 7;

      doc.text(`Your Answer: ${userAnswer}`, 15, y);
      y += 6;

      doc.text(`Correct Answer: ${q.correctAnswer}`, 15, y);
      y += 6;

      doc.text(correct ? "Result: Correct" : "Result: Incorrect", 15, y);
      y += 10;

      // New page if too long
      if (y > 270) {
        doc.addPage();
        y = 10;
      }
    });

    doc.save(`Quiz_Report_${topic}.pdf`);
  };

  const generateQuiz = async () => {
    if (!topic.trim()) return;

    // 🔥 ROOM MODE (Host Setup Phase)
    if (mode === "setup" && socket) {
      socket.emit("generate_room_quiz", {
        roomCode,
        topic,
        questionCount: questionCount || 5,
        questionType,
      });

      return;
    }
    console.log("Questions received:", questions);

    // 🔥 NORMAL STANDALONE MODE
    setLoading(true);
    setQuestions([]);
    setScore(null);
    setSelectedAnswers({});

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/ai/generate-quiz`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            topic,
            userId: currentUserId, // ✅ USE IT HERE
            contextId: currentContextId,
            questionCount: questionCount || 10,
            questionType,
          }),
        },
      );

      const data = await res.json();
      setQuestions(data.questions);

      if (!currentContextId) {
        setCurrentContextId(data.contextId);
      }
    } catch (err) {
      console.error("Quiz error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (index, option) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [index]: option,
    });
  };

  const submitQuiz = () => {
    if (isRoomMode && socket) {
      const answerArray = questions.map((_, i) => selectedAnswers[i] || null);

      socket.emit("submit_quiz", {
        roomCode,
        answers: answerArray,
      });

      return;
    }

    // 🔥 Normal standalone mode scoring
    let correct = 0;

    questions.forEach((q, index) => {
      const userAnswer = selectedAnswers[index];
      if (!userAnswer) return;

      if (
        userAnswer.toString().trim().toLowerCase() ===
        q.correctAnswer.toString().trim().toLowerCase()
      ) {
        correct++;
      }
    });

    setScore(correct);
  };

  return (
    <div className="ai-wrapper">
      <div className="ai-card">
        <h2 className="ai-title">AI Quiz Generator</h2>
        {(!roomCode || mode === "setup") && (
          <>
            <div className="quiz-setup-header">
              <h3>Create Your Quiz</h3>
              <p>Choose topic, number of questions and question type</p>
              <div className="quiz-divider"></div>
            </div>

            <div className="ai-input-group">
              <input
                type="text"
                placeholder="Enter topic..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />

              <input
                type="number"
                placeholder="Number of questions (default 10)"
                value={questionCount}
                onChange={(e) => setQuestionCount(e.target.value)}
              />

              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value)}
              >
                <option value="mixed">Mixed</option>
                <option value="mcq">Multiple Choice</option>
                <option value="truefalse">True / False</option>
                <option value="fill">Fill in the blanks</option>
              </select>

              <button
                onClick={generateQuiz}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? "Generating..." : "Generate"}
              </button>
            </div>
          </>
        )}

        {questions.length > 0 && (
          <div className="ai-questions">
            {questions.map((q, index) => {
              const userAnswer = selectedAnswers[index];
              const isCorrect =
                score !== null &&
                userAnswer &&
                userAnswer.toString().trim().toLowerCase() ===
                  q.correctAnswer.toString().trim().toLowerCase();

              return (
                <div key={index} className="question-card">
                  <h4>
                    {index + 1}. {q.question}
                  </h4>

                  {/* MCQ */}
                  {q.options?.length > 0 && (
                    <div className="options">
                      {q.options.map((option, i) => {
                        const isSelected = userAnswer === option;
                        const showCorrect =
                          score !== null && option === q.correctAnswer;

                        return (
                          <label
                            key={i}
                            className={`option
                  ${isSelected ? "selected" : ""}
                  ${score !== null && showCorrect ? "correct" : ""}
                  ${
                    score !== null && isSelected && option !== q.correctAnswer
                      ? "wrong"
                      : ""
                  }
                `}
                          >
                            <input
                              type="radio"
                              name={`question-${index}`}
                              checked={userAnswer === option}
                              disabled={score !== null}
                              onChange={() => handleOptionSelect(index, option)}
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* TRUE / FALSE */}
                  {q.type === "truefalse" && (
                    <div className="options">
                      {["True", "False"].map((option) => {
                        const isSelected = userAnswer === option;
                        const showCorrect =
                          score !== null && option === q.correctAnswer;

                        return (
                          <label
                            key={option}
                            className={`option
                  ${isSelected ? "selected" : ""}
                  ${score !== null && showCorrect ? "correct" : ""}
                  ${
                    score !== null && isSelected && option !== q.correctAnswer
                      ? "wrong"
                      : ""
                  }
                `}
                          >
                            <input
                              type="radio"
                              name={`question-${index}`}
                              checked={userAnswer === option}
                              disabled={score !== null}
                              onChange={() => handleOptionSelect(index, option)}
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* FILL IN THE BLANK */}
                  {q.type === "fill" && (
                    <div>
                      <input
                        type="text"
                        placeholder="Type your answer"
                        value={userAnswer || ""}
                        disabled={score !== null}
                        onChange={(e) =>
                          setSelectedAnswers({
                            ...selectedAnswers,
                            [index]: e.target.value,
                          })
                        }
                      />

                      {score !== null && !isCorrect && (
                        <p className="correct-answer">
                          Correct Answer: {q.correctAnswer}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Show correct answer for MCQ/TF if wrong */}
                  {score !== null &&
                    userAnswer &&
                    userAnswer !== q.correctAnswer &&
                    q.type !== "fill" && (
                      <p className="correct-answer">
                        Correct Answer: {q.correctAnswer}
                      </p>
                    )}
                </div>
              );
            })}

            {score === null && (
              <button onClick={submitQuiz} className="btn-primary submit-btn">
                Submit Quiz
              </button>
            )}
            {isHost && mode === "live" && (
              <button className="btn-danger" onClick={onEndQuiz}>
                End Quiz
              </button>
            )}
            {score !== null && (
              <div className="score-display">
                <p>
                  Your Score: {score} / {questions.length}
                </p>

                <button onClick={downloadQuizReport} className="btn-primary">
                  Download Report
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Quiz;
