import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "id_cards.db");
const db = new Database(dbPath);

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS id_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    father_name TEXT,
    mother_name TEXT,
    birth_date_place TEXT,
    civil_status TEXT,
    profession TEXT,
    address TEXT,
    id_number TEXT NOT NULL,
    entry_date_china TEXT,
    document_presented TEXT,
    issue_date TEXT,
    expiry_date TEXT,
    photo TEXT,
    fingerprint TEXT,
    signature TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    image_data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    photo TEXT,
    role TEXT DEFAULT 'operator',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    system_name TEXT DEFAULT 'Portal ID Embaixada',
    primary_color TEXT DEFAULT '#0f172a',
    logo TEXT
  );
`);

// Insert default admin and settings if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE email = ?").get('kaleyapt@gmail.com');
if (!adminExists) {
  db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)").run(
    'Administrador',
    'kaleyapt@gmail.com',
    '123456', // In a real app, use hashing
    'admin'
  );
}

const settingsExists = db.prepare("SELECT * FROM settings WHERE id = ?").get('main');
if (!settingsExists) {
  db.prepare("INSERT INTO settings (id, system_name, primary_color) VALUES (?, ?, ?)").run(
    'main',
    'Portal ID Embaixada',
    '#0f172a'
  );
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  const PORT = Number(process.env.PORT) || 3000;

  // Auth Routes
  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    try {
      const user = db.prepare("SELECT id, name, email, photo, role FROM users WHERE email = ? AND password = ?").get(email, password);
      if (user) {
        res.json(user);
      } else {
        res.status(401).json({ error: "Credenciais inválidas" });
      }
    } catch (error) {
      res.status(500).json({ error: "Erro no servidor" });
    }
  });

  // User Management Routes
  app.get("/api/users", (req, res) => {
    try {
      const users = db.prepare("SELECT id, name, email, photo, role, created_at FROM users").all();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });

  app.post("/api/users", (req, res) => {
    const { name, email, password, photo, role } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO users (name, email, password, photo, role) VALUES (?, ?, ?, ?, ?)");
      const result = stmt.run(name, email, password, photo, role);
      res.json({ id: result.lastInsertRowid, success: true });
    } catch (error: any) {
      if (error.message.includes('UNIQUE')) {
        res.status(400).json({ error: "E-mail já cadastrado" });
      } else {
        res.status(500).json({ error: "Erro ao criar usuário" });
      }
    }
  });

  app.delete("/api/users/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao eliminar usuário" });
    }
  });

  // System Settings Routes
  app.get("/api/settings", (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM settings WHERE id = 'main'").get();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar configurações" });
    }
  });

  app.post("/api/settings", (req, res) => {
    const { system_name, primary_color, logo } = req.body;
    try {
      db.prepare(`
        UPDATE settings 
        SET system_name = ?, primary_color = ?, logo = ? 
        WHERE id = 'main'
      `).run(system_name, primary_color, logo);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao salvar configurações" });
    }
  });

  // Template Routes
  app.get("/api/templates", (req, res) => {
    try {
      const templates = db.prepare("SELECT * FROM templates").all();
      const result = templates.reduce((acc: any, curr: any) => {
        if (curr.id === 'layout') {
          try {
            acc[curr.id] = JSON.parse(curr.image_data);
          } catch (e) {
            acc[curr.id] = null;
          }
        } else {
          acc[curr.id] = curr.image_data;
        }
        return acc;
      }, {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar modelos" });
    }
  });

  app.post("/api/templates", (req, res) => {
    try {
      const { front, back, ambassadorSignature, layout } = req.body;
      const upsert = db.prepare("INSERT OR REPLACE INTO templates (id, image_data) VALUES (?, ?)");
      
      if (front) upsert.run("front", front);
      if (back) upsert.run("back", back);
      if (ambassadorSignature) upsert.run("ambassadorSignature", ambassadorSignature);
      if (layout) upsert.run("layout", JSON.stringify(layout));
      
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao salvar modelos" });
    }
  });

  // API Routes
  app.post("/api/cards", (req, res) => {
    console.log("Recebida requisição POST /api/cards");
    try {
      const { 
        fullName, fatherName, motherName, birthDateAndPlace, 
        civilStatus, profession, address, idNumber,
        entryDateChina, documentPresented, issueDate, expiryDate,
        photo, fingerprint, signature 
      } = req.body;

      if (!fullName || !idNumber) {
        console.warn("Campos obrigatórios ausentes:", { fullName, idNumber });
        return res.status(400).json({ error: "Nome e Número de ID são obrigatórios" });
      }

      console.log("Inserindo cartão no banco de dados para:", fullName);

      const stmt = db.prepare(`
        INSERT INTO id_cards (
          full_name, father_name, mother_name, birth_date_place, 
          civil_status, profession, address, id_number,
          entry_date_china, document_presented, issue_date, expiry_date,
          photo, fingerprint, signature
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        fullName, fatherName, motherName, birthDateAndPlace, 
        civilStatus, profession, address, idNumber,
        entryDateChina, documentPresented, issueDate, expiryDate,
        photo, fingerprint, signature
      );

      console.log("Cartão inserido com sucesso. ID:", result.lastInsertRowid);
      res.json({ id: result.lastInsertRowid, success: true });
    } catch (error) {
      console.error("Erro ao salvar cartão no servidor:", error);
      res.status(500).json({ error: "Erro interno ao salvar cartão: " + (error as Error).message });
    }
  });

  app.get("/api/cards", (req, res) => {
    try {
      const cards = db.prepare("SELECT * FROM id_cards ORDER BY created_at DESC").all();
      res.json(cards);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cards" });
    }
  });

  app.delete("/api/cards/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM id_cards WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete card" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
