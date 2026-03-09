import path from "path";

import compression from "compression";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";

import { apiCredentialsRoutes } from "./routes/apiCredentialsRoutes";
import { authRoutes } from "./routes/authRoutes";
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
import { slackIntegrationRoutes } from "./routes/slackIntegrationRoutes";
import { uploadRoutes } from "./routes/uploadRoutes";
import { customDomainRoutes } from "./routes/customDomainRoutes";
import { tenantRoutes } from "./routes/tenantRoutes";
import cannyMigrationRoutes from "./routes/cannyMigrationRoutes";
import { resolveTenantContext } from "./middleware/tenantContext";

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
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "30mb" }));
app.use(attachRequestId);
app.use(resolveApiCredential);
app.use(resolveActor);
app.use(resolveTenantContext);

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

// Old install redirect - now served from /install-assets
// app.get("/install-old", ...) removed in favor of interactive wizard

const staticCacheOptions = { maxAge: "1h", etag: true };

app.use("/demo-assets", express.static(path.resolve(process.cwd(), "src/public/demo"), staticCacheOptions));
app.get("/demo", (_req, res) => {
  const demoPath = path.resolve(process.cwd(), "src/public/demo/index.html");
  res.sendFile(demoPath);
});

app.use("/portal-assets", express.static(path.resolve(process.cwd(), "src/public/portal"), staticCacheOptions));
app.get("/portal", (_req, res) => {
  const portalPath = path.resolve(process.cwd(), "src/public/portal/index.html");
  res.sendFile(portalPath);
});

app.use("/docs-assets", express.static(path.resolve(process.cwd(), "src/public/docs"), staticCacheOptions));
app.get("/docs", (_req, res) => {
  const docsPath = path.resolve(process.cwd(), "src/public/docs/index.html");
  res.sendFile(docsPath);
});

app.use("/install-assets", express.static(path.resolve(process.cwd(), "src/public/install"), staticCacheOptions));
app.get("/install", (_req, res) => {
  const installPath = path.resolve(process.cwd(), "src/public/install/index.html");
  res.sendFile(installPath);
});

app.use("/roadmap-assets", express.static(path.resolve(process.cwd(), "src/public/roadmap"), staticCacheOptions));
app.get("/roadmap", (_req, res) => {
  const roadmapPath = path.resolve(process.cwd(), "src/public/roadmap/index.html");
  res.sendFile(roadmapPath);
});

app.use("/auth-assets", express.static(path.resolve(process.cwd(), "src/public/auth"), staticCacheOptions));
app.get("/auth", (_req, res) => {
  const authPath = path.resolve(process.cwd(), "src/public/auth/index.html");
  res.sendFile(authPath);
});
app.get("/auth/verify-success", (_req, res) => {
  res.sendFile(path.resolve(process.cwd(), "src/public/auth/verify-success.html"));
});
app.get("/auth/verify-error", (_req, res) => {
  res.sendFile(path.resolve(process.cwd(), "src/public/auth/verify-error.html"));
});
app.get("/auth/reset-password", (_req, res) => {
  res.sendFile(path.resolve(process.cwd(), "src/public/auth/reset-password.html"));
});
app.get("/auth/accept-invite", (_req, res) => {
  res.sendFile(path.resolve(process.cwd(), "src/public/auth/accept-invite.html"));
});
app.get("/login", (_req, res) => res.redirect("/auth"));
app.get("/signup", (_req, res) => res.redirect("/auth"));
app.get("/roadmap/:slug", (_req, res) => {
  const roadmapPath = path.resolve(process.cwd(), "src/public/roadmap/index.html");
  res.sendFile(roadmapPath);
});

app.use("/profile-assets", express.static(path.resolve(process.cwd(), "src/public/profile"), staticCacheOptions));
app.get("/profile", (_req, res) => {
  const profilePath = path.resolve(process.cwd(), "src/public/profile/index.html");
  res.sendFile(profilePath);
});

app.use("/company-assets", express.static(path.resolve(process.cwd(), "src/public/company"), staticCacheOptions));
app.get("/company", (_req, res) => {
  const companyPath = path.resolve(process.cwd(), "src/public/company/index.html");
  res.sendFile(companyPath);
});

app.use("/uploads", express.static(path.resolve(process.cwd(), "src/public/uploads"), staticCacheOptions));

app.use("/admin", express.static(path.resolve(process.cwd(), "src/public/admin"), staticCacheOptions));
app.get("/dashboard", (_req, res) => {
  const dashboardPath = path.resolve(process.cwd(), "src/public/company/index.html");
  res.sendFile(dashboardPath);
});

app.use("/migrate-assets", express.static(path.resolve(process.cwd(), "src/public/migrate"), staticCacheOptions));
app.get("/migrate/canny", (_req, res) => {
  const migratePath = path.resolve(process.cwd(), "src/public/migrate/canny.html");
  res.sendFile(migratePath);
});

app.use("/api/webhooks", webhooksRoutes);
app.use("/api/integrations/freshdesk", freshdeskIntegrationRoutes);
app.use("/api/integrations/zoom", zoomIntegrationRoutes);
app.use("/api/integrations/slack", slackIntegrationRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/custom-domains", customDomainRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/tenant", tenantRoutes);
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
app.use("/api/v1", cannyMigrationRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled server error", err);
  res.status(500).json({ error: "Internal server error" });
});
