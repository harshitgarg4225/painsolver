const { app } = require("../dist/app");
const { ensureBootstrapData } = require("../dist/services/bootstrapService");

let bootPromise = null;

async function ensureBootstrapped() {
  // For serverless production, startup seeding/backfills should be run as controlled jobs,
  // not as a hard requirement for request handling.
  if (process.env.VERCEL && process.env.PAINSOLVER_AUTO_BOOTSTRAP !== "true") {
    return;
  }

  if (!bootPromise) {
    bootPromise = ensureBootstrapData();
  }

  return bootPromise;
}

module.exports = async (req, res) => {
  try {
    await ensureBootstrapped();
  } catch (error) {
    // Never crash the serverless invocation on bootstrap failure.
    // Route handlers will surface actionable API errors if dependencies are unavailable.
    console.error("Bootstrap failed", error);
  }
  return app(req, res);
};
