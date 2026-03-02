import crypto from "crypto";

import { env } from "../config/env";
import { stripHtml } from "../lib/text";

interface ZoomOAuthStatePayload {
  userId: string;
  email: string;
  issuedAt: number;
  nonce: string;
}

interface ZoomTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
}

interface ZoomProfile {
  id: string;
  account_id?: string;
  email?: string;
}

interface ZoomRecordingFile {
  id?: string;
  file_type?: string;
  recording_type?: string;
  file_extension?: string;
  download_url?: string;
  status?: string;
}

interface ZoomRecordingMeeting {
  id?: string | number;
  uuid?: string;
  topic?: string;
  start_time?: string;
  host_email?: string;
  recording_files?: ZoomRecordingFile[];
}

interface ZoomRecordingsResponse {
  meetings?: ZoomRecordingMeeting[];
  next_page_token?: string;
}

export interface ZoomConnectionStatusView {
  connected: boolean;
  zoomUserEmail: string | null;
  zoomUserId: string | null;
  zoomAccountId: string | null;
  expiresAt: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
}

export interface ZoomTranscriptImportItem {
  sourceReferenceId: string;
  topic: string;
  startedAt: string | null;
  hostEmail: string | null;
  transcriptText: string;
}

function stateSignature(encodedPayload: string): string {
  return crypto
    .createHmac("sha256", env.PAINSOLVER_CLIENT_SECRET)
    .update(encodedPayload)
    .digest("hex");
}

function decodeStatePayload(state: string): ZoomOAuthStatePayload | null {
  const [encodedPayload, signature] = String(state || "").split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = stateSignature(encodedPayload);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as ZoomOAuthStatePayload;
    if (!parsed.userId || !parsed.email || !parsed.issuedAt || !parsed.nonce) {
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

function transcriptFromVtt(rawText: string): string {
  const clean = String(rawText || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) {
        return false;
      }

      if (line.toUpperCase() === "WEBVTT") {
        return false;
      }

      if (/^\d+$/.test(line)) {
        return false;
      }

      if (
        /^\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?\s+-->\s+\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?/.test(line) ||
        /^\d{2}:\d{2}(?:\.\d{1,3})?\s+-->\s+\d{2}:\d{2}(?:\.\d{1,3})?/.test(line)
      ) {
        return false;
      }

      return true;
    })
    .map((line) => line.replace(/^<v[^>]*>/, "").replace(/<\/v>$/, ""))
    .join(" ");

  return stripHtml(clean).replace(/\s+/g, " ").trim();
}

async function exchangeTokenWithZoom(params: URLSearchParams): Promise<ZoomTokenResponse> {
  if (env.USE_MOCK_ZOOM) {
    return {
      access_token: `mock_zoom_access_${Date.now()}`,
      refresh_token: `mock_zoom_refresh_${Date.now()}`,
      token_type: "bearer",
      scope: "recording:read user:read",
      expires_in: 3600
    };
  }

  const auth = Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`https://zoom.us/oauth/token?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zoom token exchange failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as ZoomTokenResponse;
}

async function fetchZoomApiJson<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`https://api.zoom.us/v2${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zoom API request failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as T;
}

async function fetchTranscriptBody(downloadUrl: string, accessToken: string): Promise<string> {
  if (env.USE_MOCK_ZOOM) {
    return transcriptFromVtt(
      "WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nNeed comments parity for Meta scheduled posts.\n00:00:05.000 --> 00:00:08.000\nPlease add analytics export by board."
    );
  }

  const attemptPrimary = await fetch(downloadUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (attemptPrimary.ok) {
    const text = await attemptPrimary.text();
    return transcriptFromVtt(text);
  }

  const separator = downloadUrl.includes("?") ? "&" : "?";
  const fallbackUrl = `${downloadUrl}${separator}access_token=${encodeURIComponent(accessToken)}`;
  const attemptFallback = await fetch(fallbackUrl, { method: "GET" });
  if (!attemptFallback.ok) {
    const errorText = await attemptFallback.text();
    throw new Error(`Zoom transcript download failed (${attemptFallback.status}): ${errorText}`);
  }

  return transcriptFromVtt(await attemptFallback.text());
}

export function createZoomOAuthState(input: {
  userId: string;
  email: string;
}): string {
  const payload: ZoomOAuthStatePayload = {
    userId: input.userId,
    email: input.email,
    issuedAt: Date.now(),
    nonce: crypto.randomBytes(12).toString("hex")
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${stateSignature(encoded)}`;
}

export function parseZoomOAuthState(state: string): {
  userId: string;
  email: string;
} | null {
  const parsed = decodeStatePayload(state);
  if (!parsed) {
    return null;
  }

  const maxAgeMs = 10 * 60 * 1000;
  if (Date.now() - parsed.issuedAt > maxAgeMs) {
    return null;
  }

  return {
    userId: parsed.userId,
    email: parsed.email
  };
}

export function buildZoomAuthorizeUrl(state: string): string {
  if (env.USE_MOCK_ZOOM) {
    const callback = new URL(env.ZOOM_REDIRECT_URI);
    callback.searchParams.set("code", "mock_zoom_code");
    callback.searchParams.set("state", state);
    return callback.toString();
  }

  const authorize = new URL("https://zoom.us/oauth/authorize");
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", env.ZOOM_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", env.ZOOM_REDIRECT_URI);
  authorize.searchParams.set("state", state);
  return authorize.toString();
}

export async function exchangeZoomAuthorizationCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  scope: string | null;
  expiresAt: Date | null;
}> {
  const params = new URLSearchParams();
  params.set("grant_type", "authorization_code");
  params.set("code", code);
  params.set("redirect_uri", env.ZOOM_REDIRECT_URI);

  const token = await exchangeTokenWithZoom(params);
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenType: token.token_type || "bearer",
    scope: token.scope ?? null,
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null
  };
}

export async function refreshZoomAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  scope: string | null;
  expiresAt: Date | null;
}> {
  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", refreshToken);

  const token = await exchangeTokenWithZoom(params);
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || refreshToken,
    tokenType: token.token_type || "bearer",
    scope: token.scope ?? null,
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null
  };
}

export async function fetchZoomProfile(accessToken: string): Promise<ZoomProfile> {
  if (env.USE_MOCK_ZOOM) {
    return {
      id: "mock_zoom_user",
      account_id: "mock_zoom_account",
      email: "member@painsolver.io"
    };
  }

  return fetchZoomApiJson<ZoomProfile>("/users/me", accessToken);
}

/**
 * Extract individual topics/feature requests from a transcript
 * For multi-topic extraction from a single call
 */
export interface ExtractedTopic {
  topic: string;
  context: string;
  speaker?: string;
  timestamp?: string;
}

/**
 * Parse VTT transcript with speaker diarization
 */
export function parseVttWithSpeakers(vttText: string): Array<{
  speaker: string;
  text: string;
  timestamp: string;
}> {
  const lines = vttText.replace(/\r/g, "").split("\n");
  const utterances: Array<{ speaker: string; text: string; timestamp: string }> = [];
  
  let currentTimestamp = "";
  let currentSpeaker = "";
  let currentText = "";
  
  for (const line of lines) {
    // Skip WEBVTT header and numbers
    if (line.toUpperCase() === "WEBVTT" || /^\d+$/.test(line.trim()) || !line.trim()) {
      continue;
    }
    
    // Parse timestamp line
    const timestampMatch = line.match(/^(\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)\s+-->\s+\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?/);
    if (timestampMatch) {
      if (currentText) {
        utterances.push({
          speaker: currentSpeaker || "Speaker",
          text: currentText.trim(),
          timestamp: currentTimestamp
        });
      }
      currentTimestamp = timestampMatch[1];
      currentText = "";
      continue;
    }
    
    // Parse speaker tag (e.g., <v John Smith>)
    const speakerMatch = line.match(/^<v\s+([^>]+)>/);
    if (speakerMatch) {
      currentSpeaker = speakerMatch[1];
      currentText = line.replace(/<v[^>]*>/, "").replace(/<\/v>$/, "").trim();
    } else {
      currentText += " " + line.replace(/<[^>]*>/g, "").trim();
    }
  }
  
  // Don't forget the last utterance
  if (currentText) {
    utterances.push({
      speaker: currentSpeaker || "Speaker",
      text: currentText.trim(),
      timestamp: currentTimestamp
    });
  }
  
  return utterances;
}

/**
 * Format transcript with speaker context for AI processing
 */
export function formatTranscriptForAI(utterances: Array<{
  speaker: string;
  text: string;
  timestamp: string;
}>): string {
  return utterances
    .map((u) => `[${u.timestamp}] ${u.speaker}: ${u.text}`)
    .join("\n");
}

/**
 * Simple heuristic to identify potential feedback segments
 */
export function identifyFeedbackSegments(transcript: string): string[] {
  const segments: string[] = [];
  const lines = transcript.split("\n");
  
  // Keywords that suggest feedback
  const feedbackIndicators = [
    /\b(would be nice|should have|could we|can we get|feature|request|wish|want|need|improve|better|missing|doesn't work|broken|bug|error|issue)\b/i,
    /\b(when will|roadmap|planned|considering|thinking about)\b/i,
    /\b(our customers|our users|our team|we need)\b/i
  ];
  
  let currentSegment = "";
  let inFeedbackSection = false;
  
  for (const line of lines) {
    const hasFeedbackIndicator = feedbackIndicators.some((regex) => regex.test(line));
    
    if (hasFeedbackIndicator) {
      inFeedbackSection = true;
    }
    
    if (inFeedbackSection) {
      currentSegment += line + "\n";
      
      // End segment after 3-5 lines of context
      if (currentSegment.split("\n").length >= 5) {
        segments.push(currentSegment.trim());
        currentSegment = "";
        inFeedbackSection = false;
      }
    }
  }
  
  if (currentSegment) {
    segments.push(currentSegment.trim());
  }
  
  return segments;
}

/**
 * Zoom webhook event types
 */
export interface ZoomWebhookPayload {
  event: string;
  event_ts: number;
  payload: {
    account_id?: string;
    object?: {
      id?: string | number;
      uuid?: string;
      topic?: string;
      host_email?: string;
      start_time?: string;
      recording_files?: Array<{
        id?: string;
        file_type?: string;
        recording_type?: string;
        download_url?: string;
        status?: string;
        file_extension?: string;
      }>;
    };
  };
}

/**
 * Verify Zoom webhook signature
 */
export function verifyZoomWebhookSignature(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  const secret = env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (!secret) {
    console.warn("[Zoom] No webhook secret configured, skipping verification");
    return true; // Allow in development
  }

  const message = `v0:${timestamp}:${body}`;
  const hash = crypto.createHmac("sha256", secret).update(message).digest("hex");
  const expected = `v0=${hash}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Handle Zoom URL validation challenge
 */
export function handleZoomChallenge(plainToken: string): {
  plainToken: string;
  encryptedToken: string;
} {
  const secret = env.ZOOM_WEBHOOK_SECRET_TOKEN || "";
  const hash = crypto.createHmac("sha256", secret).update(plainToken).digest("hex");
  return {
    plainToken,
    encryptedToken: hash
  };
}

export async function listZoomTranscriptImports(input: {
  accessToken: string;
  daysBack: number;
  maxMeetings?: number;
}): Promise<ZoomTranscriptImportItem[]> {
  if (env.USE_MOCK_ZOOM) {
    const now = new Date();
    return [
      {
        sourceReferenceId: `zoom:mock:${now.toISOString().slice(0, 10)}:1`,
        topic: "Weekly Customer Voice Call",
        startedAt: now.toISOString(),
        hostEmail: "host@painsolver.io",
        transcriptText:
          "Customers asked for better roadmap filters by board and status. They also want in-post commenting for roadmap items."
      },
      {
        sourceReferenceId: `zoom:mock:${now.toISOString().slice(0, 10)}:2`,
        topic: "Support Escalations Review",
        startedAt: now.toISOString(),
        hostEmail: "host@painsolver.io",
        transcriptText:
          "Agencies reported missing planner comments from Meta-scheduled posts. They requested complete comments parity and export."
      }
    ];
  }

  const to = new Date();
  const from = new Date(Date.now() - Math.max(1, input.daysBack) * 24 * 60 * 60 * 1000);
  const fromText = from.toISOString().slice(0, 10);
  const toText = to.toISOString().slice(0, 10);

  const maxMeetings = Math.min(100, Math.max(1, input.maxMeetings ?? 30));
  let nextPageToken = "";
  let loadedMeetings = 0;
  const items: ZoomTranscriptImportItem[] = [];

  while (loadedMeetings < maxMeetings) {
    const query = new URLSearchParams();
    query.set("from", fromText);
    query.set("to", toText);
    query.set("page_size", "30");
    if (nextPageToken) {
      query.set("next_page_token", nextPageToken);
    }

    const page = await fetchZoomApiJson<ZoomRecordingsResponse>(`/users/me/recordings?${query.toString()}`, input.accessToken);
    const meetings = page.meetings ?? [];
    if (!meetings.length) {
      break;
    }

    for (const meeting of meetings) {
      if (loadedMeetings >= maxMeetings) {
        break;
      }
      loadedMeetings += 1;

      const meetingId = String(meeting.id ?? "");
      const meetingUuid = String(meeting.uuid ?? "").trim() || meetingId;
      if (!meetingUuid) {
        continue;
      }

      const recordingFiles = meeting.recording_files ?? [];
      const transcriptFiles = recordingFiles.filter((file) => {
        const type = String(file.file_type ?? "").toUpperCase();
        const recordingType = String(file.recording_type ?? "").toLowerCase();
        const extension = String(file.file_extension ?? "").toLowerCase();
        const status = String(file.status ?? "").toLowerCase();
        if (status && status !== "completed") {
          return false;
        }

        return type === "TRANSCRIPT" || recordingType.includes("transcript") || extension === "vtt";
      });

      for (const file of transcriptFiles) {
        const fileId = String(file.id ?? "").trim();
        const downloadUrl = String(file.download_url ?? "").trim();
        if (!fileId || !downloadUrl) {
          continue;
        }

        const transcriptText = await fetchTranscriptBody(downloadUrl, input.accessToken);
        if (!transcriptText) {
          continue;
        }

        const topic = String(meeting.topic ?? "").trim() || "Zoom call";
        items.push({
          sourceReferenceId: `zoom:${meetingUuid}:${fileId}`,
          topic,
          startedAt: meeting.start_time ?? null,
          hostEmail: meeting.host_email ?? null,
          transcriptText
        });
      }
    }

    nextPageToken = String(page.next_page_token ?? "");
    if (!nextPageToken) {
      break;
    }
  }

  return items;
}
