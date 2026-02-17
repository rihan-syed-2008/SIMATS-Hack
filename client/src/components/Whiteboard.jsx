import { useEffect, useRef, useState } from "react";

const Whiteboard = ({ socket, roomCode, isHost }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [prevPos, setPrevPos] = useState({ x: 0, y: 0 });
  const drawLine = (x1, y1, x2, y2, strokeColor, strokeWidth) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(2);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "black";

    socket.on("draw", ({ x, y, prevX, prevY }) => {
      drawLine(prevX, prevY, x, y);
    });
    socket.on("clear_board", () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      socket.off("draw");
      socket.off("clear_board");
    };
  }, [socket]);

  const handleMouseDown = (e) => {
    if (!isHost) return;

    setIsDrawing(true);

    const rect = canvasRef.current.getBoundingClientRect();
    setPrevPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !isHost) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    drawLine(prevPos.x, prevPos.y, x, y);

    socket.emit("draw", {
      roomCode,
      x,
      y,
      prevX: prevPos.x,
      prevY: prevPos.y,
      color,
      lineWidth,
    });

    setPrevPos({ x, y });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
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
      </div>

      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        style={{ border: "1px solid black", background: "white" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
};

export default Whiteboard;
