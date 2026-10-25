import { supabaseAdmin } from './supabaseAdmin'

/** Fire-and-forget audit trail writer (M9) */
export async function logAudit(profile, action, tableName, recordId, newData = null, oldData = null, req = null) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      company_id: profile.company_id || null,
      user_id: profile.id,
      action,
      table_name: tableName || null,
      record_id: recordId || null,
      new_data: newData || null,
      old_data: oldData || null,
      ip_address: req?.headers?.get('x-forwarded-for') || null,
    })
  } catch (e) {
    console.error('audit_log_failed', e?.message)
  }
}
