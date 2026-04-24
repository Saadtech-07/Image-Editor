import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter(_req, file, callback) {
    if (file.mimetype?.startsWith("image/")) {
      callback(null, true);
      return;
    }

    callback(new Error("Only image uploads are supported."));
  },
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/remove-bg", upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'Missing multipart file field "image".' });
      return;
    }

    if (!process.env.REMOVE_BG_API_KEY) {
      res.status(500).json({ message: "REMOVE_BG_API_KEY is not configured." });
      return;
    }

    const formData = new FormData();
    const imageBlob = new Blob([req.file.buffer], {
      type: req.file.mimetype || "application/octet-stream",
    });

    formData.append("image_file", imageBlob, req.file.originalname || "image.png");
    formData.append("size", "auto");

    const removeBgResponse = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.REMOVE_BG_API_KEY,
      },
      body: formData,
    });

    if (!removeBgResponse.ok) {
      const details = await removeBgResponse.text();
      res.status(removeBgResponse.status).json({
        message: "remove.bg failed to process the image.",
        details: details.slice(0, 700),
      });
      return;
    }

    const contentType = removeBgResponse.headers.get("content-type") || "image/png";
    const processedImage = Buffer.from(await removeBgResponse.arrayBuffer());

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");
    res.send(processedImage);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const statusCode = error instanceof multer.MulterError ? 400 : 500;

  res.status(statusCode).json({
    message: error.message || "Unexpected server error.",
  });
});

app.listen(port, () => {
  console.log(`AI Image Editor API running on http://localhost:${port}`);
});
