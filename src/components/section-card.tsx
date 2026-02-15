'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface Evidence {
  url: string
  snippet: string
  context?: string
}

interface SectionCardProps {
  title: string
  description?: string
  confidence: number
  source: 'verified' | 'extracted' | 'inferred' | 'not_found'
  children: React.ReactNode
  evidence?: Evidence[]
}

const sourceColors: Record<string, string> = {
  verified: 'bg-green-100 text-green-800',
  extracted: 'bg-blue-100 text-blue-800',
  inferred: 'bg-yellow-100 text-yellow-800',
  not_found: 'bg-gray-100 text-gray-800',
}

const sourceLabels: Record<string, string> = {
  verified: 'Verified',
  extracted: 'Extracted',
  inferred: 'Inferred',
  not_found: 'Not Found',
}

export function SectionCard({
  title,
  description,
  confidence,
  source,
  children,
  evidence,
}: SectionCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && (
              <CardDescription className="mt-1">{description}</CardDescription>
            )}
          </div>
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${sourceColors[source]}`}
          >
            {sourceLabels[source]}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Progress value={confidence} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground w-12 text-right">
            {confidence}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {children}

        {evidence && evidence.length > 0 && (
          <Accordion type="single" collapsible className="mt-4">
            <AccordionItem value="evidence" className="border-none">
              <AccordionTrigger className="text-sm text-muted-foreground hover:no-underline py-2">
                View Evidence ({evidence.length})
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 mt-2">
                  {evidence.slice(0, 5).map((e, i) => (
                    <div
                      key={i}
                      className="text-xs bg-muted p-2 rounded border-l-2 border-muted-foreground/20"
                    >
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate block"
                      >
                        {e.url}
                      </a>
                      <p className="text-muted-foreground mt-1 italic">
                        &quot;{e.snippet}&quot;
                      </p>
                      {e.context && (
                        <p className="text-muted-foreground/70 mt-1">
                          Context: {e.context}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  )
}
