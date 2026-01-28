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
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false
});

app.use(cors());
app.use(express.json());

/* ====== UPLOADS ====== */
const UPLOAD_DIR = "./uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, name + ext);
  }
});
const upload = multer({ storage });

app.use("/uploads", express.static(UPLOAD_DIR));

/* ====== HELPERS ====== */
function publicFileUrl(req, filename) {
  if (!filename) return null;
  // Railway normalmente expone con el mismo host
  return `${req.protocol}://${req.get("host")}/uploads/${filename}`;
}

/* =========================
   POST /registro (CREAR)
========================= */
app.post("/registro", upload.single("archivo"), async (req, res) => {
  try {
    const { tipo, detalle, monto } = req.body;
    if (!tipo || !monto) return res.status(400).json({ ok:false, error:"Faltan campos" });

    const archivo_url = req.file ? publicFileUrl(req, req.file.filename) : null;

    const q = `
      INSERT INTO registros (tipo, detalle, monto, archivo_url, activo, created_at)
      VALUES ($1, $2, $3, $4, TRUE, NOW())
      RETURNING *
    `;
    const values = [tipo, detalle || "", Number(monto), archivo_url];
    const r = await pool.query(q, values);

    res.json({ ok:true, data:r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:"Error creando registro" });
  }
});

/* =========================
   GET /registros (LISTAR)
========================= */
app.get("/registros", async (_req, res) => {
  try {
    const q = `
      SELECT id, tipo, detalle, monto, archivo_url, activo, created_at
      FROM registros
      ORDER BY created_at DESC
    `;
    const r = await pool.query(q);
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:"Error listando registros" });
  }
});

/* =========================
   PATCH /registro/:id/disable
========================= */
app.patch("/registro/:id/disable", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok:false, error:"ID inválido" });

    const q = `UPDATE registros SET activo = FALSE WHERE id = $1 RETURNING *`;
    const r = await pool.query(q, [id]);

    if (!r.rows.length) return res.status(404).json({ ok:false, error:"No existe" });
    res.json({ ok:true, data:r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:"Error deshabilitando" });
  }
});

/* =========================
   PATCH /registro/:id/enable (opcional)
========================= */
app.patch("/registro/:id/enable", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok:false, error:"ID inválido" });

    const q = `UPDATE registros SET activo = TRUE WHERE id = $1 RETURNING *`;
    const r = await pool.query(q, [id]);

    if (!r.rows.length) return res.status(404).json({ ok:false, error:"No existe" });
    res.json({ ok:true, data:r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:"Error habilitando" });
  }
});

app.listen(PORT, () => {
  console.log("🌐 API activa en puerto", PORT);
});
