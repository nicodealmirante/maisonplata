
import express from "express";
import cors from "cors";
import { pool } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/registro", async (req, res) => {
  const { tipo, detalle, monto } = req.body;
  await pool.query(
    "INSERT INTO registros (tipo, detalle, monto) VALUES ($1,$2,$3)",
    [tipo, detalle, monto]
  );
  res.json({ ok: true });
});

app.get("/registros", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM registros ORDER BY created_at ASC"
  );
  res.json(rows);
});

app.delete("/registros", async (req, res) => {
  await pool.query("DELETE FROM registros");
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Backend OK"));
