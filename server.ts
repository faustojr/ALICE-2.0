import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import rateLimit from "express-rate-limit";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Rate limiting to prevent bot attacks
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: "Too many requests, please try again later." }
  });

  app.use(limiter);
  app.use(cors());
  app.use(express.json());

  // In-memory store for user data
  // In a real app, this would be a database
  let users: Record<string, any> = {
    'ana@municipio.gov.br': { 
        email: 'ana@municipio.gov.br',
        name: 'Ana Silva', area: 'Jurídico', points: 1250, 
        specialties: { 'Lei de Licitações': 800, 'Lei de Resp. Fiscal': 200, 'Soft Skills': 250, 'Plano Diretor': 0 },
        preferredDays: 'Terça e Quinta', preferredTime: '08:00 - 09:00',
        bestTopic: 'Lei de Licitações', bestTopicScore: 92,
        worstTopic: 'Plano Diretor', worstTopicScore: 0,
        softSkillsLevel: 'Avançado',
        lastAccess: new Date().toISOString()
    }
  };

  // API Routes
  app.get("/api/users", (req, res) => {
    // Basic protection for the user list
    const adminSecret = req.headers['x-admin-secret'];
    if (process.env.ADMIN_SECRET && adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: "Unauthorized access to user data" });
    }
    res.json(Object.values(users));
  });

  app.post("/api/users/login", (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    
    const user = users[email.toLowerCase()];
    if (user) {
      res.json({ found: true, user });
    } else {
      res.json({ found: false });
    }
  });

  app.post("/api/users/update", (req, res) => {
    const userData = req.body;
    if (!userData.email) {
      return res.status(400).json({ error: "Email is required" });
    }
    
    const emailKey = userData.email.toLowerCase();
    users[emailKey] = {
      ...users[emailKey],
      ...userData,
      email: emailKey,
      lastAccess: new Date().toISOString()
    };
    
    res.json({ success: true, user: users[emailKey] });
  });

  app.get("/api/users/stats", (req, res) => {
    const userList = Object.values(users);
    if (userList.length === 0) return res.json({ averagePoints: 0 });
    
    const totalPoints = userList.reduce((sum, user) => sum + (user.points || 0), 0);
    const averagePoints = Math.round(totalPoints / userList.length);
    
    res.json({ averagePoints });
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
