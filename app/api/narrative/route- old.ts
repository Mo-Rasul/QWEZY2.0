import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()
    if (!prompt) return NextResponse.json({ error: 'No prompt' }, { status: 400 })

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: `
    You are a data analyst writing executive email summaries.
    
    Write a concise summary (max 5 sentences total).
    Each sentence MUST be on its own line (line break between sentences).
    Do NOT write as a paragraph.
    
    Use specific numbers, percentages, trends, and names from the data.
    Highlight insights, not raw data.
    Call out trends, changes, or anomalies clearly.
    
    Avoid filler language and avoid em dashes.
    Do not explain methodology.
    
    Structure:
    Line 1: Overall takeaway  
    Line 2–3: Key metrics and trends with numbers  
    Line 4: Notable anomaly, risk, or opportunity  
    Line 5 (optional): Recommendation or implication  
    
    If no meaningful trend exists, say that clearly.
    
    Tone: natural, clear, human, professional.
    `,
      messages: [{ role: 'user', content: prompt }],
    });
    

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    return NextResponse.json({ text })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
