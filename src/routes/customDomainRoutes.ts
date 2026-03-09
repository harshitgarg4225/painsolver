import { Router } from "express";
import { z } from "zod";
import dns from "dns/promises";

import { prisma } from "../db/prisma";
import { requireCompanyWriteAccess } from "../middleware/actorAccess";

export const customDomainRoutes = Router();

// All routes require company admin access
customDomainRoutes.use(requireCompanyWriteAccess);

const addDomainSchema = z.object({
  domain: z.string()
    .min(3)
    .max(255)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i, {
      message: "Invalid domain format. Example: feedback.yourcompany.com"
    })
});

// Get current custom domain settings
customDomainRoutes.get("/", async (_req, res) => {
  const domains = await prisma.customDomain.findMany({
    orderBy: { createdAt: "desc" }
  });

  const settings = await prisma.portalSettings.findFirst();

  res.status(200).json({
    domains: domains.map(d => ({
      id: d.id,
      domain: d.domain,
      status: d.status,
      verificationToken: d.verificationToken,
      verificationMethod: d.verificationMethod,
      sslStatus: d.sslStatus,
      verifiedAt: d.verifiedAt?.toISOString() ?? null,
      lastCheckedAt: d.lastCheckedAt?.toISOString() ?? null,
      errorMessage: d.errorMessage,
      createdAt: d.createdAt.toISOString()
    })),
    activeDomainId: settings?.customDomainId ?? null
  });
});

// Add a new custom domain
customDomainRoutes.post("/add", async (req, res) => {
  const parsed = addDomainSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ 
      error: "Invalid domain", 
      details: parsed.error.flatten() 
    });
    return;
  }

  const domain = parsed.data.domain.toLowerCase();

  // Check if domain already exists
  const existing = await prisma.customDomain.findUnique({
    where: { domain }
  });

  if (existing) {
    res.status(400).json({ 
      error: "Domain already registered",
      existingStatus: existing.status
    });
    return;
  }

  // Create new domain record
  const companyId = (req as any).companyId ?? "default";
  const newDomain = await prisma.customDomain.create({
    data: {
      domain,
      status: "pending_verification",
      verificationMethod: "dns_txt",
      companyId
    }
  });

  res.status(201).json({
    domain: {
      id: newDomain.id,
      domain: newDomain.domain,
      status: newDomain.status,
      verificationToken: newDomain.verificationToken,
      verificationMethod: newDomain.verificationMethod
    },
    instructions: {
      method: "DNS TXT Record",
      steps: [
        `1. Go to your DNS provider for ${domain}`,
        `2. Add a TXT record with:`,
        `   - Host/Name: _painsolver-verify`,
        `   - Value: ${newDomain.verificationToken}`,
        `3. Wait for DNS propagation (usually 5-15 minutes)`,
        `4. Click "Verify Domain" below`
      ],
      record: {
        type: "TXT",
        name: "_painsolver-verify",
        value: newDomain.verificationToken
      }
    }
  });
});

// Verify domain ownership via DNS
customDomainRoutes.post("/verify/:domainId", async (req, res) => {
  const { domainId } = req.params;

  const domainRecord = await prisma.customDomain.findUnique({
    where: { id: domainId }
  });

  if (!domainRecord) {
    res.status(404).json({ error: "Domain not found" });
    return;
  }

  const lookupHost = `_painsolver-verify.${domainRecord.domain}`;

  try {
    // Lookup TXT records
    const records = await dns.resolveTxt(lookupHost);
    const flatRecords = records.flat();

    const isVerified = flatRecords.some(
      record => record === domainRecord.verificationToken
    );

    if (isVerified) {
      const updated = await prisma.customDomain.update({
        where: { id: domainId },
        data: {
          status: "verified",
          verifiedAt: new Date(),
          lastCheckedAt: new Date(),
          errorMessage: null
        }
      });

      res.status(200).json({
        verified: true,
        domain: {
          id: updated.id,
          domain: updated.domain,
          status: updated.status,
          verifiedAt: updated.verifiedAt?.toISOString()
        },
        nextStep: "Your domain is verified! Now add a CNAME record pointing to cname.vercel-dns.com to activate it."
      });
    } else {
      await prisma.customDomain.update({
        where: { id: domainId },
        data: {
          lastCheckedAt: new Date(),
          errorMessage: `TXT record not found. Found: ${flatRecords.join(", ") || "(none)"}`
        }
      });

      res.status(200).json({
        verified: false,
        error: "Verification failed",
        found: flatRecords,
        expected: domainRecord.verificationToken,
        hint: "DNS changes can take 5-30 minutes to propagate. Try again in a few minutes."
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "DNS lookup failed";
    
    await prisma.customDomain.update({
      where: { id: domainId },
      data: {
        lastCheckedAt: new Date(),
        errorMessage
      }
    });

    // ENOTFOUND means the record doesn't exist yet
    if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("ENODATA")) {
      res.status(200).json({
        verified: false,
        error: "TXT record not found",
        hint: "Make sure you've added the TXT record and waited for DNS propagation."
      });
    } else {
      res.status(200).json({
        verified: false,
        error: errorMessage
      });
    }
  }
});

// Activate domain (set as primary)
customDomainRoutes.post("/activate/:domainId", async (req, res) => {
  const { domainId } = req.params;

  const domainRecord = await prisma.customDomain.findUnique({
    where: { id: domainId }
  });

  if (!domainRecord) {
    res.status(404).json({ error: "Domain not found" });
    return;
  }

  if (domainRecord.status !== "verified") {
    res.status(400).json({ 
      error: "Domain must be verified before activation",
      currentStatus: domainRecord.status
    });
    return;
  }

  // Update portal settings to use this domain
  const companyId = (req as any).companyId ?? "default";
  await prisma.portalSettings.upsert({
    where: { id: "default" },
    update: { customDomainId: domainId },
    create: { 
      id: "default",
      customDomainId: domainId,
      companyId
    }
  });

  // Update domain status
  await prisma.customDomain.update({
    where: { id: domainId },
    data: { 
      status: "active",
      sslStatus: "provisioning"
    }
  });

  res.status(200).json({
    activated: true,
    domain: domainRecord.domain,
    note: "SSL certificate will be provisioned automatically. Your portal will be accessible at https://" + domainRecord.domain + " within a few minutes."
  });
});

// Remove/delete domain
customDomainRoutes.delete("/:domainId", async (req, res) => {
  const { domainId } = req.params;

  const domainRecord = await prisma.customDomain.findUnique({
    where: { id: domainId }
  });

  if (!domainRecord) {
    res.status(404).json({ error: "Domain not found" });
    return;
  }

  // If this is the active domain, clear it from settings
  const settings = await prisma.portalSettings.findFirst({
    where: { customDomainId: domainId }
  });

  if (settings) {
    await prisma.portalSettings.update({
      where: { id: settings.id },
      data: { customDomainId: null }
    });
  }

  // Delete the domain record
  await prisma.customDomain.delete({
    where: { id: domainId }
  });

  res.status(200).json({ 
    ok: true,
    deleted: domainRecord.domain
  });
});

// Check CNAME setup for activation
customDomainRoutes.post("/check-cname/:domainId", async (req, res) => {
  const { domainId } = req.params;

  const domainRecord = await prisma.customDomain.findUnique({
    where: { id: domainId }
  });

  if (!domainRecord) {
    res.status(404).json({ error: "Domain not found" });
    return;
  }

  try {
    const cnameRecords = await dns.resolveCname(domainRecord.domain);
    const hasVercelCname = cnameRecords.some(
      record => record.includes("vercel") || record.includes("cname.vercel-dns.com")
    );

    if (hasVercelCname) {
      await prisma.customDomain.update({
        where: { id: domainId },
        data: { 
          sslStatus: "active",
          lastCheckedAt: new Date()
        }
      });

      res.status(200).json({
        configured: true,
        cnameRecords,
        sslStatus: "active"
      });
    } else {
      res.status(200).json({
        configured: false,
        cnameRecords,
        expected: "cname.vercel-dns.com",
        hint: "Add a CNAME record pointing your domain to cname.vercel-dns.com"
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "DNS lookup failed";
    
    if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("ENODATA")) {
      res.status(200).json({
        configured: false,
        error: "No CNAME record found",
        hint: "Add a CNAME record pointing your domain to cname.vercel-dns.com"
      });
    } else {
      res.status(200).json({
        configured: false,
        error: errorMessage
      });
    }
  }
});

