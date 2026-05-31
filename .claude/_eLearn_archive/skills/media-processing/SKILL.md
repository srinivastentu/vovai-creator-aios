---
name: media-processing
description: >
  FFmpeg and media processing patterns. Use when working on
  audio/video assembly, rendering, or format conversion.
---
# Media Processing with FFmpeg

## Common Commands
```bash
# Combine image + audio into video
ffmpeg -loop 1 -i image.png -i audio.mp3 -c:v libx264 -t [duration] -pix_fmt yuv420p output.mp4

# Concatenate multiple videos
ffmpeg -f concat -safe 0 -i filelist.txt -c copy output.mp4

# Add background music (lower volume)
ffmpeg -i video.mp4 -i music.mp3 -filter_complex "[1:a]volume=0.2[bg];[0:a][bg]amix=inputs=2" output.mp4

# Generate SRT from timing data
# (Use Node.js to write .srt file, FFmpeg to burn in)
ffmpeg -i video.mp4 -vf subtitles=captions.srt output.mp4
```

## Rules
- Always validate inputs exist before FFmpeg commands
- Use -y flag to overwrite output files
- Log every FFmpeg command for debugging
- Set timeout: 5 minutes max per operation
- Store intermediate files in /tmp, final in storage
