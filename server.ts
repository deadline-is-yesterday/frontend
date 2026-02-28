import express from "express";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Mock database for the simulation
  let currentScenario: any = null;

  // API routes FIRST
  app.post("/api/scenario", (req, res) => {
    currentScenario = req.body;
    console.log("Saved scenario with", currentScenario.zones?.length || 0, "zones");
    res.json({ success: true, message: "Сценарий успешно сохранен на сервере" });
  });

  app.get("/api/scenario", (req, res) => {
    res.json(currentScenario || { scenario: null, zones: [] });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
