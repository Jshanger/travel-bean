import { Router } from "express";
import { requireAuth } from "../middlewares/auth";

const router = Router();
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

router.use(requireAuth);

async function speechToText(audioBuffer: Buffer, contentType: string, extension: string) {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL ?? process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  if (!apiKey) throw new Error("Voice transcription is not configured");

  const form = new FormData();
  form.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe");
  form.append("file", new Blob([new Uint8Array(audioBuffer)], { type: contentType }), `travel-bean-recording.${extension}`);

  const response = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const payload = await response.json() as { text?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "Transcription failed");
  return payload.text?.trim() ?? "";
}

// Accepts raw audio bytes, returns transcript
// Content-Type: audio/m4a | audio/mp4 | audio/aac | audio/wav
router.post("/", async (req, res) => {
  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;
  req.on("data", (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_AUDIO_BYTES) {
      tooLarge = true;
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", async () => {
    try {
      if (tooLarge) {
        res.status(413).json({ error: "Audio recording is too large" });
        return;
      }
      const audioBuffer = Buffer.concat(chunks);
      if (!audioBuffer.length) {
        res.status(400).json({ error: "Empty audio" });
        return;
      }
      const contentType = (req.headers["content-type"] ?? "audio/m4a") as string;
      const format = contentType.includes("wav") ? "wav"
        : contentType.includes("aac") ? "aac"
        : "m4a";
      const transcript = await speechToText(audioBuffer, contentType, format);
      res.json({ transcript });
    } catch (err: any) {
      req.log.error({ err }, "transcription failed");
      const status = err?.message === "Voice transcription is not configured" ? 503 : 500;
      res.status(status).json({ error: err?.message ?? "Transcription failed" });
    }
  });
});

export default router;
