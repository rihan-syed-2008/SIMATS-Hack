import { useEffect, useRef, useState } from "react";
import "./Whiteboard.css";

const Whiteboard = ({ socket, roomCode, isHost, allowedUsers, userId }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [prevPos, setPrevPos] = useState({ x: 0, y: 0 });
  const [isErasing, setIsErasing] = useState(false);
  const [smartMode, setSmartMode] = useState(false);
  const [images, setImages] = useState([]);
  const [activeImageId, setActiveImageId] = useState(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const [textMode, setTextMode] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState(null);
  const [texts, setTexts] = useState([]);
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
    const canvas = canvasRef.current;
    const preview = previewRef.current;

    const resizeCanvas = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      preview.width = rect.width;
      preview.height = rect.height;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      permanentStrokes.current.forEach((stroke) => {
        drawLine(
          stroke.prevX * canvas.width,
          stroke.prevY * canvas.height,
          stroke.x * canvas.width,
          stroke.y * canvas.height,
          stroke.color,
          stroke.lineWidth,
        );
      });
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "black";

    socket.on("move_image_object", ({ id, x, y }) => {
      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, x, y } : img)),
      );
    });

    socket.on("add_text", (textObject) => {
      setTexts((prev) => [...prev, textObject]);
    });

    socket.on("add_image_object", (imageObject) => {
      setImages((prev) => [...prev, imageObject]);
    });

    socket.on("delete_image_object", (id) => {
      setImages((prev) => prev.filter((img) => img.id !== id));
    });

    socket.on("board_history", (objects) => {
      permanentStrokes.current = [];

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const rect = canvas.getBoundingClientRect();

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      objects.forEach((obj) => {
        if (obj.type === "stroke") {
          permanentStrokes.current.push(obj);

          drawLine(
            obj.prevX * rect.width,
            obj.prevY * rect.height,
            obj.x * rect.width,
            obj.y * rect.height,
            obj.color,
            obj.lineWidth,
          );
        }

        if (obj.type === "image") {
          setImages((prev) => [...prev, obj]);
        }

        if (obj.type === "text") {
          setTexts((prev) => [...prev, obj]);
        }
      });
    });

    socket.on("draw", ({ x, y, prevX, prevY, color, lineWidth }) => {
      permanentStrokes.current.push({ x, y, prevX, prevY, color, lineWidth });

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();

      drawLine(
        prevX * rect.width,
        prevY * rect.height,
        x * rect.width,
        y * rect.height,
        color,
        lineWidth,
      );
    });
    socket.on("clear_board", () => {
      // 🔥 CLEAR ALL MEMORY
      permanentStrokes.current = [];
      setImages([]);
      setTexts([]);
    });

    return () => {
      socket.off("draw");
      socket.off("clear_board");
      socket.off("board_history");
      socket.off("move_image_object");
      socket.off("add_text");
      socket.off("add_image_object");
      socket.off("delete_image_object");
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
    if (!canDraw) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // ✅ TEXT MODE
    if (textMode) {
      setTextPosition({ x, y });
      return;
    }

    // ✅ CHECK IF CLICKED ON IMAGE
    const clickedImage = images.find(
      (img) =>
        x >= img.x &&
        x <= img.x + img.width &&
        y >= img.y &&
        y <= img.y + img.height,
    );

    if (clickedImage) {
      const cornerSize = 15;

      const isCorner =
        x >= clickedImage.x + clickedImage.width - cornerSize &&
        y >= clickedImage.y + clickedImage.height - cornerSize;

      setActiveImageId(clickedImage.id);

      if (isCorner) {
        setIsResizing(true);
      } else {
        setIsDraggingImage(true);
      }

      return;
    }

    // ✅ NORMAL DRAWING STARTS HERE
    strokePoints.current = [];
    setIsDrawing(true);

    setPrevPos({ x, y });
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isResizing && activeImageId) {
      setImages((prev) =>
        prev.map((img) =>
          img.id === activeImageId
            ? {
                ...img,
                width: Math.max(50, x - img.x),
                height: Math.max(50, y - img.y),
              }
            : img,
        ),
      );
      return;
    }

    // ✅ IMAGE DRAGGING MODE
    if (isDraggingImage && activeImageId) {
      setImages((prev) =>
        prev.map((img) =>
          img.id === activeImageId
            ? {
                ...img,
                x: x - img.width / 2,
                y: y - img.height / 2,
              }
            : img,
        ),
      );
      socket.emit("move_image_object", {
        roomCode,
        id: activeImageId,
        x: x - images.find((img) => img.id === activeImageId)?.width / 2,
        y: y - images.find((img) => img.id === activeImageId)?.height / 2,
      });
      return; // stop here — don't draw
    }

    // ❌ If not drawing → stop
    if (!isDrawing || !canDraw) return;

    const currentColor = isErasing ? "#ffffff" : color;
    const currentWidth = isErasing ? 20 : lineWidth;

    strokePoints.current.push({ x, y });

    if (smartMode) {
      const previewCtx = previewRef.current.getContext("2d");

      previewCtx.clearRect(
        0,
        0,
        previewRef.current.width,
        previewRef.current.height,
      );

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
        x: x / rect.width,
        y: y / rect.height,
        prevX: prevPos.x / rect.width,
        prevY: prevPos.y / rect.height,
        color: currentColor,
        lineWidth: currentWidth,
      });

      permanentStrokes.current.push({
        x: x / rect.width,
        y: y / rect.height,
        prevX: prevPos.x / rect.width,
        prevY: prevPos.y / rect.height,
        color: currentColor,
        lineWidth: currentWidth,
      });
    }

    setPrevPos({ x, y });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const canvas = canvasRef.current;

        const maxWidth = 300; // maximum display width
        const scale = maxWidth / img.width;

        const newImage = {
          id: crypto.randomUUID(),
          src: reader.result,
          x: canvas.width / 2 - (img.width * scale) / 2,
          y: canvas.height / 2 - (img.height * scale) / 2,
          width: img.width * scale,
          height: img.height * scale,
        };

        setImages((prev) => [...prev, newImage]);

        socket.emit("add_image_object", {
          roomCode,
          image: newImage,
        });
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw images
    images.forEach((img) => {
      const image = new Image();
      image.src = img.src;

      ctx.drawImage(image, img.x, img.y, img.width, img.height);
    });

    // Draw strokes
    permanentStrokes.current.forEach((stroke) => {
      drawLine(
        stroke.prevX * canvas.width,
        stroke.prevY * canvas.height,
        stroke.x * canvas.width,
        stroke.y * canvas.height,
        stroke.color,
        stroke.lineWidth,
      );
    });

    // Draw text
    texts.forEach((t) => {
      ctx.fillStyle = t.color;
      ctx.font = "20px Arial";
      ctx.fillText(t.text, t.x, t.y);
    });
  };

  useEffect(() => {
    redrawCanvas();
  }, [images, texts]);

  const handleMouseUp = async () => {
    setIsDraggingImage(false);
    setActiveImageId(null);
    setIsDrawing(false);
    setIsResizing(false);

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
    <div className="whiteboard-wrapper">
      {/* Canvas Container */}
      <div className="canvas-container">
        <canvas ref={canvasRef} className="canvas-base" />

        <canvas
          ref={previewRef}
          className="canvas-preview"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => {
            e.preventDefault();

            const rect = canvasRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const imageToDelete = images.find(
              (img) =>
                x >= img.x &&
                x <= img.x + img.width &&
                y >= img.y &&
                y <= img.y + img.height,
            );

            if (imageToDelete) {
              setImages((prev) =>
                prev.filter((img) => img.id !== imageToDelete.id),
              );

              socket.emit("delete_image_object", {
                roomCode,
                id: imageToDelete.id,
              });
            }
          }}
        />

        {textPosition && textMode && (
          <div
            style={{
              position: "absolute",
              left: textPosition.x,
              top: textPosition.y,
              background: "white",
              padding: "5px",
              border: "1px solid gray",
            }}
          >
            <textarea
              style={{
                color: "black",
                background: "white",
                border: "none",
                outline: "none",
                resize: "none",
              }}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();

                  const newText = {
                    text: textInput,
                    x: textPosition.x,
                    y: textPosition.y,
                    color,
                  };

                  setTexts((prev) => [...prev, newText]);
                  socket.emit("add_text", { roomCode, ...newText });

                  setTextInput("");
                  setTextPosition(null);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Floating Toolbar */}
      {canDraw && (
        <div className="wb-toolbar">
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            id="imageUpload"
            onChange={handleImageUpload}
          />

          <button
            className={`wb-btn ${textMode ? "active" : ""}`}
            onClick={() => setTextMode(!textMode)}
          >
            T
          </button>

          <button
            className="wb-btn"
            onClick={() => document.getElementById("imageUpload").click()}
          >
            🖼
          </button>
          {/* Color Picker */}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="wb-color"
          />

          {/* Thickness */}
          <div className="wb-thickness">
            <button
              className={lineWidth === 2 ? "active" : ""}
              onClick={() => setLineWidth(2)}
            >
              •
            </button>

            <button
              className={lineWidth === 5 ? "active" : ""}
              onClick={() => setLineWidth(5)}
            >
              ••
            </button>

            <button
              className={lineWidth === 10 ? "active" : ""}
              onClick={() => setLineWidth(10)}
            >
              •••
            </button>
          </div>

          {/* Eraser */}
          <button
            className={`wb-btn ${isErasing ? "active" : ""}`}
            onClick={() => setIsErasing(!isErasing)}
          >
            🧽
          </button>

          {/* Smart Mode */}
          <div
            className={`wb-toggle ${smartMode ? "active" : ""}`}
            onClick={() => setSmartMode(!smartMode)}
          >
            Smart
          </div>

          {/* Clear (Host Only) */}
          <button
            className="wb-btn danger"
            onClick={() => socket.emit("clear_board", { roomCode })}
          >
            🗑
          </button>
        </div>
      )}
    </div>
  );
};

export default Whiteboard;
