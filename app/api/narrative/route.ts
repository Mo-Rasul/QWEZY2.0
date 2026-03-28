import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()
    if (!prompt) return NextResponse.json({ error: 'No prompt' }, { status: 400 })

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      system: `You are a data analyst writing executive email summaries. Write in short paragraphs separated by a blank line. Each paragraph is 1-2 sentences. Maximum 3 paragraphs total.

Rules:
- Use specific numbers, names, and percentages from the data
- No em dashes, no bullet points, no numbered lists
- No filler phrases like "it is worth noting" or "this report shows"
- Sound like a smart human analyst, not a robot
- If there is a trend, anomaly, or opportunity, call it out clearly in its own paragraph`,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''

    // Normalise line endings, preserve blank lines between paragraphs
    const formatted = raw.trim().replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n')

    return NextResponse.json({ text: formatted })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
