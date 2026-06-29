import { db, schema } from '@/db/client'
import { fromCents } from '@/lib/money'
import { OpeningBalanceForm } from './opening-balance-form'

export const dynamic = 'force-dynamic'

export default async function OpeningBalancePage() {
  const ob = (await db.select().from(schema.ledgerOpeningBalance))[0]
  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">
        One-time entry: the amount currently owed to the vendor before the portal went live. This becomes the seed value
        for the ledger.
      </p>
      {ob && (
        <p className="text-sm mb-4">
          Current: <span className="font-medium">{fromCents(ob.amountCents)}</span>
          <span className="text-slate-500 ml-2">as of {ob.asOf.toLocaleDateString()}</span>
        </p>
      )}
      <OpeningBalanceForm
        initialAmount={ob ? (ob.amountCents / 100).toFixed(2) : '0.00'}
        initialDate={ob ? ob.asOf.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)}
      />
    </div>
  )
}
