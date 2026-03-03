import { Router } from "express";
import { put, del } from "@vercel/blob";
import { z } from "zod";
import { randomUUID } from "crypto";

import { prisma } from "../db/prisma";

export const uploadRoutes = Router();

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Upload image endpoint
uploadRoutes.post("/image", async (req, res) => {
  try {
    const contentType = req.headers["content-type"] || "";
    
    // Check if it's a direct file upload
    if (!contentType.startsWith("image/")) {
      res.status(400).json({ error: "Content-Type must be an image type" });
      return;
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      res.status(400).json({ 
        error: `Unsupported image type. Allowed: ${ALLOWED_TYPES.join(", ")}` 
      });
      return;
    }

    // Check content length
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    if (contentLength > MAX_FILE_SIZE) {
      res.status(400).json({ 
        error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` 
      });
      return;
    }

    // Generate unique filename
    const ext = contentType.split("/")[1] || "png";
    const filename = `${randomUUID()}.${ext}`;
    const pathname = `uploads/comments/${filename}`;

    // Collect body chunks
    const chunks: Buffer[] = [];
    let totalSize = 0;

    for await (const chunk of req) {
      totalSize += chunk.length;
      if (totalSize > MAX_FILE_SIZE) {
        res.status(400).json({ error: "File too large" });
        return;
      }
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    // Upload to Vercel Blob
    const blob = await put(pathname, buffer, {
      access: "public",
      contentType
    });

    // Store metadata in database
    await prisma.uploadedFile.create({
      data: {
        filename,
        originalName: filename,
        mimeType: contentType,
        sizeBytes: buffer.length,
        url: blob.url,
        purpose: "comment"
      }
    });

    res.status(200).json({
      url: blob.url,
      filename,
      size: buffer.length,
      contentType
    });
  } catch (error) {
    console.error("Image upload failed:", error);
    res.status(500).json({ 
      error: "Upload failed",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Multipart form upload (for browser form submissions)
uploadRoutes.post("/image/form", async (req, res) => {
  try {
    const contentType = req.headers["content-type"] || "";
    
    if (!contentType.includes("multipart/form-data")) {
      res.status(400).json({ error: "Expected multipart/form-data" });
      return;
    }

    // For multipart, we need to parse the form data manually or use a library
    // This is a simplified version - in production, use multer or busboy
    res.status(501).json({ 
      error: "Use /api/uploads/image with direct binary upload instead",
      hint: "Set Content-Type to image/png, image/jpeg, etc. and send raw image bytes"
    });
  } catch (error) {
    console.error("Form upload failed:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Delete image endpoint
const deleteSchema = z.object({
  url: z.string().url()
});

uploadRoutes.post("/image/delete", async (req, res) => {
  const parsed = deleteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid delete payload" });
    return;
  }

  try {
    // Delete from Vercel Blob
    await del(parsed.data.url);

    // Remove from database
    await prisma.uploadedFile.deleteMany({
      where: { url: parsed.data.url }
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Image delete failed:", error);
    res.status(500).json({ error: "Delete failed" });
  }
});

// Get upload settings
uploadRoutes.get("/settings", async (_req, res) => {
  const settings = await prisma.portalSettings.findFirst();
  
  res.status(200).json({
    maxSizeMb: settings?.maxImageSizeMb ?? 5,
    allowedTypes: settings?.allowedImageTypes ?? ALLOWED_TYPES,
    maxImagesPerComment: 5
  });
});

