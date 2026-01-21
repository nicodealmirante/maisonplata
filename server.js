import express from "express";
import cors from "cors";
import pkg from "pg";
import multer from "multer";
import path from "path";
import fs from "fs";

const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 3000;

/* ====== DB ====== */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

/* ====== MIDDLEWARE ====== */
app.use(cors());
app.use(express.json());

/* ====== UPLOADS ====== */
const UPLOAD_DIR = "./uploads";
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, name + ext);
  },
});

const upload = multer({ storage });

app.use("/uploads", express.static(path.resolve(UPLOAD_DIR)));

/* ====== ROUTES ====== */

// HEALTH
app.get("/", (_, res) => {
  res.send("Backend OK");
});

// LISTAR
app.get("/registros", async (_, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM registros ORDER BY created_at DESC"
  );
  res.json(rows);
});

// INSERTAR (con archivo)
app.post("/registro", upload.single("archivo"), async (req, res) => {
  try {
    const { tipo, detalle } = req.body;

    // ---- monto: parse + regla (si > 200 dividir por 1000)
    let monto = Number(String(req.body?.monto ?? "").replace(",", "."));
    if (!Number.isFinite(monto)) {
      return res.status(400).json({ error: "Monto inválido" });
    }
    if (monto > 200) monto = monto / 1000;

    const archivo_url = req.file
      ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
      : null;

    await pool.query(
      `INSERT INTO registros (tipo, detalle, monto, archivo_url)
       VALUES ($1,$2,$3,$4)`,
      [tipo, detalle, monto, archivo_url]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error guardando registro" });
  }
});

/* ====== START ====== */
app.listen(PORT, () => {
  console.log("Backend escuchando en", PORT);
});
