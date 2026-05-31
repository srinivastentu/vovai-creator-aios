import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RoleAvatar, getRoleConfig } from './role-avatar'
import type { BrainstormRole, IdeationMessageKind } from '@/lib/domain/workflows'

export interface ChatMessageData {
  id: string
  role: BrainstormRole
  messageType: IdeationMessageKind
  content: string
  structuredData?: Record<string, unknown> | null
  createdAt: string
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function SuggestionMessage({ content }: { content: string }) {
  return (
    <Card size="sm" className="border-l-2 border-l-blue-400">
      <CardContent>
        <Badge variant="secondary" className="mb-2 text-xs">
          Suggestion
        </Badge>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
      </CardContent>
    </Card>
  )
}

function StructureUpdateMessage({ content }: { content: string }) {
  return (
    <Card size="sm" className="border-l-2 border-l-cyan-400">
      <CardContent>
        <Badge variant="outline" className="mb-2 text-xs">
          Structure Update
        </Badge>
        <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-xs">{content}</p>
      </CardContent>
    </Card>
  )
}

function DecisionMessage({ content }: { content: string }) {
  return (
    <Card size="sm" className="border-l-2 border-l-green-400">
      <CardContent>
        <Badge variant="secondary" className="mb-2 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
          Decision
        </Badge>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
      </CardContent>
    </Card>
  )
}

function TextMessage({ content }: { content: string }) {
  return <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
}

function MessageContent({ messageType, content }: { messageType: IdeationMessageKind; content: string }) {
  switch (messageType) {
    case 'suggestion':
      return <SuggestionMessage content={content} />
    case 'structure_update':
      return <StructureUpdateMessage content={content} />
    case 'decision':
      return <DecisionMessage content={content} />
    case 'text':
    case 'question':
    default:
      return <TextMessage content={content} />
  }
}

export function ChatMessage({ message }: { message: ChatMessageData }) {
  const isHuman = message.role === 'human'
  const config = getRoleConfig(message.role)

  if (isHuman) {
    return (
      <div className="flex justify-end gap-2">
        <div className="max-w-[75%]">
          <div className="flex items-center justify-end gap-2 mb-1">
            <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
            <span className="text-xs font-medium">{config.label}</span>
          </div>
          <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-primary-foreground">
            <MessageContent messageType={message.messageType} content={message.content} />
          </div>
        </div>
        <RoleAvatar role={message.role} />
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <RoleAvatar role={message.role} />
      <div className="max-w-[75%]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium">{config.label}</span>
          <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5">
          <MessageContent messageType={message.messageType} content={message.content} />
        </div>
      </div>
    </div>
  )
}
