import ReactMarkdown, { type Components } from "react-markdown"

// Section content is markdown produced by the Long-Form synthesizer. The repo
// has no @tailwindcss/typography plugin, so element styling is supplied via
// react-markdown's `components` map rather than `prose` classes — no new dep.
const components: Components = {
  h1: ({ children }) => <h1 className="mt-4 mb-2 text-xl font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-4 mb-2 text-lg font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-3 mb-1.5 text-base font-semibold">{children}</h3>,
  p: ({ children }) => <p className="mb-3 text-sm leading-7 text-foreground/90">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1 text-sm">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1 text-sm">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-border pl-3 text-sm italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em]">{children}</code>
  ),
  hr: () => <hr className="my-4 border-border" />,
}

export function MarkdownView({ children }: { children: string }) {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>
}
