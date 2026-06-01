"use client"

import { useState } from "react"
import { Controller, type Control, type UseFormRegister } from "react-hook-form"
import { ChevronDown } from "lucide-react"
import type { PersonaFormValues } from "@/lib/domain/persona-schema"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NicheTagInput } from "@/components/common/NicheTagInput"
import { cn } from "@/lib/utils"

// Voice & tone group. Per the buildos-persona contract, formality and
// vocabulary are free-text descriptors (not a numeric slider). The signature
// phrases / do-not-say lists live behind an Advanced collapsible.
export function VoiceToneFields({
  control,
  register,
}: {
  control: Control<PersonaFormValues>
  register: UseFormRegister<PersonaFormValues>
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="voiceTone.formality">Formality</Label>
        <Input
          id="voiceTone.formality"
          {...register("voiceTone.formality")}
          placeholder="e.g. Conversational-expert. Peer-to-peer with builders."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="voiceTone.vocabulary">Vocabulary</Label>
        <Input
          id="voiceTone.vocabulary"
          {...register("voiceTone.vocabulary")}
          placeholder="e.g. Technical but plain. Precise nouns over adjectives."
        />
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ChevronDown
            className={cn("size-4 transition-transform", advancedOpen && "rotate-180")}
          />
          Advanced — signature phrases &amp; do-not-say
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          <div className="space-y-1.5">
            <Label>Signature phrases</Label>
            <Controller
              control={control}
              name="voiceTone.signaturePhrases"
              render={({ field }) => (
                <NicheTagInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Add a phrase…"
                />
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Do not say</Label>
            <Controller
              control={control}
              name="voiceTone.doNotSay"
              render={({ field }) => (
                <NicheTagInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Add a banned word or phrase…"
                />
              )}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
