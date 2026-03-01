import path from "path";

import express from "express";
import helmet from "helmet";

import { apiCredentialsRoutes } from "./routes/apiCredentialsRoutes";
import { boardsRoutes } from "./routes/boardsRoutes";
import { categoriesRoutes } from "./routes/categoriesRoutes";
import { changelogRoutes } from "./routes/changelogRoutes";
import { commentsRoutes } from "./routes/commentsRoutes";
import { companiesRoutes } from "./routes/companiesRoutes";
import { companyRoutes } from "./routes/companyRoutes";
import { dashboardRoutes } from "./routes/dashboardRoutes";
import { freshdeskIntegrationRoutes } from "./routes/freshdeskIntegrationRoutes";
import { ensureAgentActor, resolveActor } from "./middleware/actorAccess";
import { enforceAgentIdempotency } from "./middleware/agentIdempotency";
import { painEventsRoutes } from "./routes/painEventsRoutes";
import { portalRoutes } from "./routes/portalRoutes";
import { postsRoutes } from "./routes/postsRoutes";
import { requireApiKeyWithScopes, resolveApiCredential } from "./middleware/requireApiKey";
import { attachRequestId } from "./middleware/requestId";
import { sdkRoutes } from "./routes/sdkRoutes";
import { usersRoutes } from "./routes/usersRoutes";
import { votesRoutes } from "./routes/votesRoutes";
import { webhooksRoutes } from "./routes/webhooksRoutes";
import { zoomIntegrationRoutes } from "./routes/zoomIntegrationRoutes";

export const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "img-src": ["'self'", "data:", "https:"],
        "media-src": ["'self'", "data:", "https:"],
        "frame-src": ["'self'", "https://www.youtube.com", "https://player.vimeo.com"]
      }
    }
  })
);
app.use(express.json({ limit: "30mb" }));
app.use(attachRequestId);
app.use(resolveApiCredential);
app.use(resolveActor);

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get("/", (_req, res) => {
  res.redirect(302, "/portal");
});

app.get("/sdk/painsolver.js", (_req, res) => {
  const sdkFilePath = path.resolve(process.cwd(), "src/sdk/painsolver.js");
  res.sendFile(sdkFilePath);
});

app.get("/install", (req, res) => {
  const host = `${req.protocol}://${req.get("host") ?? "localhost:3000"}`;
  res.type("html").send(`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PainSolver Install</title>
    <style>
      body { font-family: "Space Grotesk", ui-sans-serif, sans-serif; margin: 24px; background: #fff; color: #101010; }
      pre { background: #f3f7f3; border: 1px solid #d8e2d5; padding: 14px; border-radius: 8px; overflow: auto; }
      a { color: #2f4024; font-weight: 600; }
    </style>
  </head>
  <body>
    <h1>PainSolver Install Snippet</h1>
    <p>Use this snippet in your app after generating a backend HMAC signature for identify.</p>
    <pre>&lt;script src="${host}/sdk/painsolver.js"&gt;&lt;/script&gt;
&lt;div id="painsolver-board"&gt;&lt;/div&gt;
&lt;script&gt;
  PainSolver("config", { apiBaseUrl: "${host}" });
  PainSolver("identify", {
    user: { email: "user@example.com", name: "User", appUserId: "u_1" },
    company: { name: "acme" },
    hash: "SERVER_GENERATED_HMAC_SHA256"
  }).then(function () {
    PainSolver("render", { selector: "#painsolver-board" });
  });
&lt;/script&gt;</pre>
    <p><a href="/portal">Open Customer Portal</a></p>
    <p><a href="/company">Open Company Dashboard</a></p>
  </body>
</html>`);
});

app.use("/demo-assets", express.static(path.resolve(process.cwd(), "src/public/demo")));
app.get("/demo", (_req, res) => {
  const demoPath = path.resolve(process.cwd(), "src/public/demo/index.html");
  res.sendFile(demoPath);
});

app.use("/portal-assets", express.static(path.resolve(process.cwd(), "src/public/portal")));
app.get("/portal", (_req, res) => {
  const portalPath = path.resolve(process.cwd(), "src/public/portal/index.html");
  res.sendFile(portalPath);
});

app.use("/company-assets", express.static(path.resolve(process.cwd(), "src/public/company")));
app.get("/company", (_req, res) => {
  const companyPath = path.resolve(process.cwd(), "src/public/company/index.html");
  res.sendFile(companyPath);
});

app.use("/uploads", express.static(path.resolve(process.cwd(), "src/public/uploads")));

app.use("/admin", express.static(path.resolve(process.cwd(), "src/public/admin")));
app.get("/dashboard", (_req, res) => {
  const dashboardPath = path.resolve(process.cwd(), "src/public/company/index.html");
  res.sendFile(dashboardPath);
});

app.use("/api/webhooks", webhooksRoutes);
app.use("/api/integrations/freshdesk", freshdeskIntegrationRoutes);
app.use("/api/integrations/zoom", zoomIntegrationRoutes);
app.use("/api/portal", portalRoutes);
app.use("/api/company", companyRoutes);
app.use(
  "/api/agent/company",
  requireApiKeyWithScopes(["company:write"]),
  ensureAgentActor,
  enforceAgentIdempotency,
  companyRoutes
);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/v1/posts", postsRoutes);
app.use("/api/v1/votes", votesRoutes);
app.use("/api/v1/comments", commentsRoutes);
app.use("/api/v1/boards", boardsRoutes);
app.use("/api/v1/categories", categoriesRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/companies", companiesRoutes);
app.use("/api/v1/changelog", changelogRoutes);
app.use("/api/v1/pain-events", painEventsRoutes);
app.use("/api/v1/api-credentials", apiCredentialsRoutes);
app.use("/api/v1/sdk", sdkRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled server error", err);
  res.status(500).json({ error: "Internal server error" });
});
