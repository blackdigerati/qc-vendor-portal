import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv() // also fall back to .env
import { google } from 'googleapis'

const credPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
const sheetId = process.env.GOOGLE_SHEET_ID
const tab = process.env.GOOGLE_SHEET_TAB || 'Orders'

if (!credPath || !sheetId) {
  console.error('Missing env: GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SHEET_ID')
  process.exit(1)
}

const auth = new google.auth.GoogleAuth({
  keyFile: credPath,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})

;(async () => {
  try {
    const sheets = google.sheets({ version: 'v4', auth })
    // First just see what tabs exist
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
    console.log('Sheet title:', meta.data.properties?.title)
    console.log('Tabs:', meta.data.sheets?.map(s => s.properties?.title).join(', '))
    // Now pull the configured tab
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: tab,
    })
    const rows = resp.data.values || []
    console.log(`Got ${rows.length} rows from "${tab}". First row:`, rows[0])
  } catch (e: unknown) {
    const err = e as { message?: string; code?: number; response?: { data?: unknown } }
    console.error('ERROR:', err.message)
    if (err.response?.data) console.error(err.response.data)
    process.exit(1)
  }
})()
