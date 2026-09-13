// Audio container sniffing from magic bytes. Client-declared MIME types and
// extensions are advisory only: the server decides from the file header what
// a sample actually is. Returns the detected container label or null when
// nothing recognizable is found (uploads are then rejected).

export function sniffAudioContainer(buf: Buffer): "mp3" | "wav" | "ogg" | "flac" | "m4a" | "webm" | null {
  if (buf.length < 12) return null;

  // ID3 tag or raw MPEG frame sync.
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return "mp3"; // "ID3"
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return "mp3";

  // RIFF/WAVE.
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WAVE") return "wav";

  // Ogg.
  if (buf.toString("ascii", 0, 4) === "OggS") return "ogg";

  // FLAC.
  if (buf.toString("ascii", 0, 4) === "fLaC") return "flac";

  // ISO BMFF (mp4/m4a/mov family): "ftyp" box at offset 4.
  if (buf.toString("ascii", 4, 8) === "ftyp") return "m4a";

  // EBML (webm/mkv).
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm";

  return null;
}
