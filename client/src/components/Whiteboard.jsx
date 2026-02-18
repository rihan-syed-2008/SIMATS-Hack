import { useEffect, useRef, useState } from "react";

const Whiteboard = ({ socket, roomCode, isHost, allowedUsers, userId }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [prevPos, setPrevPos] = useState({ x: 0, y: 0 });
  const [isErasing, setIsErasing] = useState(false);
  const [smartMode, setSmartMode] = useState(false);
  const permanentStrokes = useRef([]);
  const previewRef = useRef(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const strokePoints = useRef([]);
  const canDraw = isHost || allowedUsers.includes(userId);

  const [aiUsed, setAiUsed] = useState(false);

  const drawLine = (x1, y1, x2, y2, strokeColor, strokeWidth) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(2);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "black";

    socket.on("board_history", (strokes) => {
      permanentStrokes.current = strokes;
      const ctx = canvasRef.current.getContext("2d");

      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      strokes.forEach((stroke) => {
        drawLine(
          stroke.prevX,
          stroke.prevY,
          stroke.x,
          stroke.y,
          stroke.color,
          stroke.lineWidth,
        );
      });
    });

    socket.on("draw", ({ x, y, prevX, prevY, color, lineWidth }) => {
      drawLine(prevX, prevY, x, y, color, lineWidth);
    });
    socket.on("clear_board", () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      socket.off("draw");
      socket.off("clear_board");
      socket.off("board_history");
    };
  }, [socket]);

  const redrawPerfectShape = (type, points) => {
    const ctx = canvasRef.current.getContext("2d");

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = maxX - minX;
    const height = maxY - minY;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    if (type === "circle") {
      ctx.beginPath();
      ctx.arc(
        minX + width / 2,
        minY + height / 2,
        Math.max(width, height) / 2,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }

    if (type === "rectangle") {
      ctx.strokeRect(minX, minY, width, height);
    }

    if (type === "line") {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.stroke();
    }
  };

  const correctShapeWithAI = async (points) => {
    try {
      console.log(import.meta.env.VITE_GEMINI_URL);
      console.log(import.meta.env.VITE_GEMINI_KEY);

      console.log("correctShapeWithAI triggered");
      console.log("AI called");
      const response = await fetch(
        `${import.meta.env.VITE_GEMINI_URL}?key=${import.meta.env.VITE_GEMINI_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `The following are x,y coordinates of a hand drawn shape:
                  ${JSON.stringify(points)}
                  
                  Identify if it is a circle, rectangle, straight line or arrow.
                  Return ONLY one word: circle, rectangle, line, arrow or unknown.`,
                  },
                ],
              },
            ],
          }),
        },
      );

      const data = await response.json();
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      redrawPerfectShape(result, points);
    } catch (err) {
      console.error("AI error:", err);
    }
  };

  const handleMouseDown = (e) => {
    strokePoints.current = [];
    if (!canDraw) return;

    setIsDrawing(true);

    const rect = canvasRef.current.getBoundingClientRect();
    setPrevPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !canDraw) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const currentColor = isErasing ? "#ffffff" : color;
    const currentWidth = isErasing ? 20 : lineWidth;

    strokePoints.current.push({ x, y });

    if (smartMode) {
      const previewCtx = previewRef.current.getContext("2d");

      previewCtx.clearRect(0, 0, 600, 400);

      previewCtx.strokeStyle = currentColor;
      previewCtx.lineWidth = currentWidth;
      previewCtx.lineCap = "round";

      previewCtx.beginPath();
      previewCtx.moveTo(prevPos.x, prevPos.y);
      previewCtx.lineTo(x, y);
      previewCtx.stroke();
    } else {
      drawLine(prevPos.x, prevPos.y, x, y, currentColor, currentWidth);

      socket.emit("draw", {
        roomCode,
        x,
        y,
        prevX: prevPos.x,
        prevY: prevPos.y,
        color: currentColor,
        lineWidth: currentWidth,
      });
    }

    setPrevPos({ x, y });
  };

  const handleMouseUp = async () => {
    setIsDrawing(false);

    console.log("smartMode:", smartMode);
    console.log("points:", strokePoints.current.length);
    console.log("aiUsed:", aiUsed);

    if (!smartMode || isProcessingAI) {
      strokePoints.current = [];
      return;
    }
    setAiUsed(true);

    setIsProcessingAI(true);
    await correctShapeWithAI(strokePoints.current);
    setIsProcessingAI(false);

    strokePoints.current = [];
    /*setIsDrawing(false);

    if (!smartMode || strokePoints.current.length < 10) {
      strokePoints.current = [];
      return;
    }

    const previewCtx = previewRef.current.getContext("2d");
    previewCtx.clearRect(0, 0, 600, 400);

    const fakeResult = "rectangle"; // change to test

    // 3️⃣ Draw clean corrected shape
    redrawPerfectShape(fakeResult, strokePoints.current);
    strokePoints.current = [];*/
  };

  return (
    <div style={{ marginTop: "20px" }}>
      <h3>Whiteboard</h3>
      {isHost && (
        <button
          onClick={() => socket.emit("clear_board", { roomCode })}
          style={{ marginBottom: "10px" }}
        >
          Clear Board
        </button>
      )}
      {canDraw && (
        <div style={{ marginBottom: "10px" }}>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />

          <select
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            style={{ marginLeft: "10px" }}
          >
            <option value={2}>Thin</option>
            <option value={5}>Medium</option>
            <option value={10}>Thick</option>
          </select>

          <button
            onClick={() => setIsErasing(!isErasing)}
            style={{ marginLeft: "10px" }}
          >
            {isErasing ? "Stop Eraser" : "Eraser"}
          </button>

          <button
            onClick={() => setSmartMode(!smartMode)}
            style={{ marginLeft: "10px" }}
          >
            Smart Mode: {smartMode ? "ON" : "OFF"}
          </button>
        </div>
      )}

      <div style={{ position: "relative", width: 600, height: 400 }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            border: "1px solid black",
            background: "white",
            zIndex: 1,
          }}
        />

        <canvas
          ref={previewRef}
          width={600}
          height={400}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            zIndex: 2,
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
    </div>
  );
};

export default Whiteboard;
