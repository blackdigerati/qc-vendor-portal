import { getBillingRule } from '@/lib/billing-rules-db'
import { BillingRulesForm } from './form'

export const dynamic = 'force-dynamic'

export default async function BillingRulesPage() {
  const rule = getBillingRule()
  return (
    <div>
      <p className="text-sm text-slate-600 mb-4">
        Lines whose unit cost (COG) is below the threshold automatically incur a per-item handling charge at invoice time.
        Edit the values here; they apply to <em>future</em> invoices (existing invoices keep what they were issued with).
      </p>
      <BillingRulesForm
        initialThreshold={(rule.handlingThresholdCents / 100).toFixed(2)}
        initialPerItem={(rule.handlingPerItemCents / 100).toFixed(2)}
      />
    </div>
  )
}
