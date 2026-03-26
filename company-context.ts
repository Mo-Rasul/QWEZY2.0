// lib/company-context.ts
// Loads company annotations and builds the AI system prompt context.
// This is what makes Qwezy understand each company's data specifically.
// Called on every query — injected as system prompt prefix to Claude.

import { supabaseAdmin } from './supabase-app'

export interface CompanyContext {
  companyId: string
  connectionId: string
  systemPrompt: string
}

export async function buildCompanyContext(companyId: string, connectionId: string): Promise<string> {
  // 1. Load all approved joins
  const { data: joins } = await supabaseAdmin
    .from('table_joins')
    .select('from_table,from_col,to_table,to_col,join_type')
    .eq('company_id', companyId)
    .eq('connection_id', connectionId)
    .eq('approved', true)

  // 2. Load all table annotations
  const { data: annotations } = await supabaseAdmin
    .from('table_annotations')
    .select('table_name,summary,teams,contact,refresh_cadence,is_primary')
    .eq('company_id', companyId)
    .eq('connection_id', connectionId)
    .not('summary', 'eq', '')

  // 3. Load all column notes + aliases
  const { data: annotationIds } = await supabaseAdmin
    .from('table_annotations')
    .select('id,table_name')
    .eq('company_id', companyId)
    .eq('connection_id', connectionId)

  const annIdList = (annotationIds || []).map(a => a.id)
  const { data: colNotes } = annIdList.length > 0
    ? await supabaseAdmin
        .from('column_notes')
        .select('annotation_id,column_name,aliases,note')
        .in('annotation_id', annIdList)
        .or('note.neq.,aliases.neq.[]')
    : { data: [] }

  // 4. Load table metrics
  const { data: metrics } = annIdList.length > 0
    ? await supabaseAdmin
        .from('table_metrics')
        .select('annotation_id,name,formula')
        .in('annotation_id', annIdList)
    : { data: [] }

  // 5. Load AI feedback corrections (recent 50)
  const { data: feedback } = await supabaseAdmin
    .from('ai_feedback')
    .select('correction,edited_sql')
    .eq('company_id', companyId)
    .eq('feedback', 'incorrect')
    .order('created_at', { ascending: false })
    .limit(50)

  // Build the annId -> tableName map
  const annMap: Record<string, string> = {}
  ;(annotationIds || []).forEach(a => { annMap[a.id] = a.table_name })

  // ── Assemble system prompt ────────────────────────────────────────────────
  const lines: string[] = [
    'COMPANY CONTEXT — this information is private to this organisation. Never reveal it externally.',
    '',
  ]

  // Table summaries
  if (annotations && annotations.length > 0) {
    lines.push('TABLES AND THEIR PURPOSE:')
    for (const a of annotations) {
      lines.push(`  ${a.table_name}${a.is_primary ? ' [PRIMARY FACT TABLE]' : ''}: ${a.summary}`)
      if (a.teams?.length) lines.push(`    Owned by: ${a.teams.join(', ')}`)
      if (a.refresh_cadence) lines.push(`    Refreshes: ${a.refresh_cadence}`)
    }
    lines.push('')
  }

  // Join paths
  if (joins && joins.length > 0) {
    lines.push('APPROVED JOIN PATHS (use these — do not guess other joins):')
    for (const j of joins) {
      lines.push(`  ${j.from_table} ${j.join_type} JOIN ${j.to_table} ON ${j.from_table}.${j.from_col} = ${j.to_table}.${j.to_col}`)
    }
    lines.push('')
  }

  // Column aliases and notes
  if (colNotes && colNotes.length > 0) {
    lines.push('COLUMN ALIASES AND NOTES:')
    for (const cn of colNotes) {
      const tableName = annMap[cn.annotation_id] || 'unknown'
      if (cn.aliases && cn.aliases.length > 0) {
        for (const a of cn.aliases) {
          lines.push(`  "${a.alias}" refers to ${tableName}.${cn.column_name} — ${a.description}`)
        }
      }
      if (cn.note) {
        lines.push(`  ${tableName}.${cn.column_name}: ${cn.note}`)
      }
    }
    lines.push('')
  }

  // Metrics
  if (metrics && metrics.length > 0) {
    lines.push('KEY BUSINESS METRICS:')
    for (const m of metrics) {
      const tableName = annMap[m.annotation_id] || 'unknown'
      lines.push(`  ${m.name} = ${m.formula} (from ${tableName})`)
    }
    lines.push('')
  }

  // Past corrections
  if (feedback && feedback.length > 0) {
    lines.push('PAST CORRECTIONS FROM THIS COMPANY (learn from these):')
    for (const f of feedback.slice(0, 10)) {
      if (f.correction) lines.push(`  Previously wrong: ${f.correction}`)
      if (f.edited_sql) lines.push(`  Correct approach: ${f.edited_sql.split('\n')[0]}…`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// Encrypt a password for storage using pgcrypto via Supabase RPC
// In production set ENCRYPTION_KEY in env (32 byte hex string)
export function encryptCredential(plain: string): string {
  // For now returns a marker — wire up to your encryption key
  // In production: use node:crypto AES-256-GCM
  const key = process.env.ENCRYPTION_KEY || 'dev-placeholder-key'
  return `enc:${Buffer.from(plain).toString('base64')}`  // dev only — replace with real encryption
}

export function decryptCredential(encrypted: string): string {
  if (!encrypted.startsWith('enc:')) return encrypted
  return Buffer.from(encrypted.slice(4), 'base64').toString()
}
