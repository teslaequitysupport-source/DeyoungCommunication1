# Desktop API Surface (Planned Client Contract)

Checked: 2026-09-10. The desktop shell reuses these; nothing new is required
server side.

- Auth: same session endpoints; device registration row planned for device
  management (schema field reserved via SecurityEvent device notes).
- Session: POST /api/sessions with clientInfo {ua, platform: desktop};
  gateway token exchange identical to web.
- Streaming: identical gateway protocol (socket.io client in the shell).
- Diagnostics: the client posts its own latency metrics on session end;
  the desktop adds audio device identifiers in clientInfo for support.
- Reconnection: exponential backoff, session resume is NOT silent; a new
  session is started (honest accounting, no ghost usage).
