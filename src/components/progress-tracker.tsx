'use client'

import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ProgressTrackerProps {
  status: string
  step?: string
  currentUrl?: string
  pagesProcessed?: number
}

interface StepInfo {
  key: string
  label: string
  description: string
  education: string
  icon: string
}

const STEPS: StepInfo[] = [
  {
    key: 'queued',
    label: 'Queued',
    description: 'Waiting to start...',
    education: 'We check if we have a recent cached version of this brand analysis first.',
    icon: '🕐',
  },
  {
    key: 'crawling',
    label: 'Crawling',
    description: 'Fetching website pages...',
    education: 'We visit key pages like the homepage, about page, and contact page to understand your brand.',
    icon: '🔍',
  },
  {
    key: 'extracting',
    label: 'Extracting',
    description: 'Analyzing brand elements...',
    education: 'We look at CSS styles, fonts, colors, meta tags, and structured data to find brand assets.',
    icon: '🎨',
  },
  {
    key: 'analyzing',
    label: 'Analyzing',
    description: 'AI tone & voice analysis...',
    education: 'AI reads your copy to understand your brand voice, personality, and communication style.',
    icon: '🤖',
  },
  {
    key: 'generating',
    label: 'Generating',
    description: 'Creating report...',
    education: 'We compile everything into a professional brand guideline you can share with your team.',
    icon: '📄',
  },
]

function getStepIndex(status: string): number {
  const index = STEPS.findIndex(s => s.key === status)
  return index >= 0 ? index : 0
}

function getProgress(status: string): number {
  const index = getStepIndex(status)
  return ((index + 1) / STEPS.length) * 100
}

export function ProgressTracker({ status, step, currentUrl, pagesProcessed }: ProgressTrackerProps) {
  const currentStepIndex = getStepIndex(status)
  const progress = getProgress(status)
  const currentStep = STEPS[currentStepIndex]

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{currentStep?.icon || '🔄'}</span>
          <div>
            <CardTitle>Analyzing Brand...</CardTitle>
            <CardDescription>
              {step || currentStep?.description || 'Processing...'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Progress value={progress} className="h-2" />

        <div className="flex justify-between">
          {STEPS.map((s, index) => (
            <div
              key={s.key}
              className={`flex flex-col items-center ${
                index <= currentStepIndex
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                  index < currentStepIndex
                    ? 'bg-primary text-primary-foreground'
                    : index === currentStepIndex
                    ? 'bg-primary text-primary-foreground animate-pulse'
                    : 'bg-muted'
                }`}
              >
                {index < currentStepIndex ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{s.icon}</span>
                )}
              </div>
              <span className="text-xs mt-2 hidden sm:block font-medium">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Educational callout */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">
                {currentStep?.label || 'Processing'}
              </p>
              <p className="text-sm text-blue-700 mt-1">
                {currentStep?.education || 'Working on your brand analysis...'}
              </p>
            </div>
          </div>
        </div>

        {status === 'crawling' && (
          <div className="bg-muted rounded-lg p-4 text-sm">
            {currentUrl && (
              <p className="text-muted-foreground truncate">
                <span className="font-medium">Current:</span>{' '}
                <span className="font-mono text-xs">{currentUrl}</span>
              </p>
            )}
            {pagesProcessed !== undefined && (
              <p className="text-muted-foreground mt-1">
                <span className="font-medium">Pages processed:</span> {pagesProcessed}
              </p>
            )}
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground">
          This typically takes 1-3 minutes depending on the website size.
        </p>
      </CardContent>
    </Card>
  )
}
