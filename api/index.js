const { app } = require("../dist/app");
const { ensureBootstrapData } = require("../dist/services/bootstrapService");

let bootPromise = null;

async function ensureBootstrapped() {
  if (!bootPromise) {
    bootPromise = ensureBootstrapData();
  }

  return bootPromise;
}

module.exports = async (req, res) => {
  await ensureBootstrapped();
  return app(req, res);
};
