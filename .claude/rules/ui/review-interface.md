---
paths: ["src/app/**", "src/components/**"]
---
# UI Component Rules
- Functional React components with hooks only
- Tailwind CSS utilities only — no custom CSS files
- shadcn/ui as the base design system
- The review interface is the MOST important screen
- Show real-time streaming progress using SSE (EventSource)
- Display iteration history with scores
- Five review actions (Approve, Reject, Feedback, Use Segments, Mix & Produce) must be prominent
- Always show cost information
- Mobile-responsive from the start
- Visual-First: build UI with sample data FIRST, then connect engine
