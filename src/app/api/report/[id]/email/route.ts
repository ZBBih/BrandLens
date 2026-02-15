/**
 * POST /api/report/[id]/email
 * Send report to email address
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Simple email validation
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Valid email address required' },
        { status: 400 }
      )
    }

    const report = await prisma.report.findUnique({
      where: { id },
      select: { id: true, slug: true, domain: true, data: true },
    })

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    // Set temporary public access for 7 days
    const tempPublicUntil = new Date()
    tempPublicUntil.setDate(tempPublicUntil.getDate() + 7)

    await prisma.report.update({
      where: { id },
      data: {
        emailSentTo: email,
        emailSentAt: new Date(),
        tempPublicUntil,
      },
    })

    // In production, this would integrate with an email service like Resend, SendGrid, etc.
    // For now, we'll simulate the email being sent
    const reportUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/report/${report.slug}`

    console.log(`[Email] Would send report to ${email}:`)
    console.log(`  - Report: ${report.domain}`)
    console.log(`  - URL: ${reportUrl}`)
    console.log(`  - Expires: ${tempPublicUntil.toISOString()}`)

    // TODO: Integrate with email service
    // await sendEmail({
    //   to: email,
    //   subject: `Your ${report.domain} Brand Guideline`,
    //   html: generateEmailTemplate(report, reportUrl),
    // })

    return NextResponse.json({
      success: true,
      message: `Report sent to ${email}`,
    })
  } catch (error) {
    console.error('Email send error:', error)
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    )
  }
}
