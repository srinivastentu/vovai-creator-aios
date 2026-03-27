---
paths: ["src/lib/media*", "src/lib/assembly*", "src/lib/ffmpeg*"]
---
# Media Processing Rules
- Use FFmpeg (via command line) for all media assembly
- Never load entire video files into Node.js memory
- Store all media artifacts in /tmp during processing, move to storage when done
- Every media operation MUST have a timeout (max 5 minutes)
- Log FFmpeg commands before execution for debugging
- Validate media files exist and have correct format BEFORE processing
- Support these formats: MP4 (video), PNG/JPG (images), MP3/WAV (audio), SRT (captions)
