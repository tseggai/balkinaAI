'use client';

import { useEffect, useState, useCallback } from 'react';

interface LoyaltyTier {
  name: string;
  min_points: number;
  color: string;
  benefits: string;
}

interface LoyaltyRule {
  id?: string;
  type: string;
  target_id: string | null;
  points: number;
}

interface LoyaltyProgram {
  id?: string;
  is_active: boolean;
  points_per_booking: number;
  points_per_dollar: number;
  redemption_rate: number;
  min_redemption_points: number;
  points_expiry_days: number;
  tiers: LoyaltyTier[];
}

interface ServiceOption {
  id: string;
  name: string;
}

interface StaffOption {
  id: string;
  name: string;
}

export default function LoyaltyPage() {
  const [program, setProgram] = useState<LoyaltyProgram>({
    is_active: false,
    points_per_booking: 0,
    points_per_dollar: 0,
    redemption_rate: 0,
    min_redemption_points: 0,
    points_expiry_days: 0,
    tiers: [],
  });
  const [rules, setRules] = useState<LoyaltyRule[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Rule form
  const [ruleType, setRuleType] = useState<'service' | 'staff'>('service');
  const [ruleTargetId, setRuleTargetId] = useState('');
  const [rulePoints, setRulePoints] = useState('');

  // Tier form
  const [tierName, setTierName] = useState('');
  const [tierMinPoints, setTierMinPoints] = useState('');
  const [tierColor, setTierColor] = useState('#6366f1');
  const [tierBenefits, setTierBenefits] = useState('');

  const fetchData = useCallback(async () => {
    const [loyaltyRes, servicesRes, staffRes] = await Promise.all([
      fetch('/api/loyalty'),
      fetch('/api/services'),
      fetch('/api/staff'),
    ]);
    const loyaltyJson = await loyaltyRes.json();
    const servicesJson = await servicesRes.json();
    const staffJson = await staffRes.json();

    if (loyaltyJson.data?.program) {
      const p = loyaltyJson.data.program as Record<string, unknown>;
      setProgram({
        id: p.id as string | undefined,
        is_active: (p.is_active as boolean) ?? false,
        points_per_booking: (p.points_per_booking as number) ?? 0,
        points_per_dollar: (p.points_per_dollar as number) ?? 0,
        redemption_rate: (p.redemption_rate as number) ?? 0,
        min_redemption_points: (p.min_redemption_points as number) ?? 0,
        points_expiry_days: (p.points_expiry_days as number) ?? 0,
        tiers: (p.tiers as LoyaltyTier[]) ?? [],
      });
    }
    setRules(loyaltyJson.data?.rules ?? []);
    setServices((servicesJson.data ?? []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
    setStaffList((staffJson.data ?? []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function addRule() {
    if (!ruleTargetId || !rulePoints) return;
    setRules([...rules, { type: ruleType, target_id: ruleTargetId, points: Number(rulePoints) || 0 }]);
    setRuleTargetId('');
    setRulePoints('');
  }

  function removeRule(index: number) {
    setRules(rules.filter((_, i) => i !== index));
  }

  function getRuleName(rule: LoyaltyRule): string {
    if (rule.type === 'service') {
      return services.find((s) => s.id === rule.target_id)?.name ?? 'Unknown Service';
    }
    return staffList.find((s) => s.id === rule.target_id)?.name ?? 'Unknown Staff';
  }

  function addTier() {
    if (!tierName.trim()) return;
    setProgram({
      ...program,
      tiers: [...program.tiers, {
        name: tierName,
        min_points: Number(tierMinPoints) || 0,
        color: tierColor,
        benefits: tierBenefits,
      }],
    });
    setTierName('');
    setTierMinPoints('');
    setTierColor('#6366f1');
    setTierBenefits('');
  }

  function removeTier(index: number) {
    setProgram({
      ...program,
      tiers: program.tiers.filter((_, i) => i !== index),
    });
  }

  async function handleSave() {
    setError('');
    setSuccess('');
    setSaving(true);

    const body = {
      is_active: program.is_active,
      points_per_booking: program.points_per_booking,
      points_per_dollar: program.points_per_dollar,
      redemption_rate: program.redemption_rate,
      min_redemption_points: program.min_redemption_points,
      points_expiry_days: program.points_expiry_days,
      tiers: program.tiers,
      rules: rules.map((r) => ({
        type: r.type,
        target_id: r.target_id,
        points: r.points,
      })),
    };

    const res = await fetch('/api/loyalty', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) { setError(json.error?.message ?? 'Failed to save'); setSaving(false); return; }
    setSuccess('Loyalty program saved successfully.');
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="p-12 text-center text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Loyalty Program</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {success && <p className="mb-4 text-sm text-green-600">{success}</p>}

      <div className="max-w-3xl space-y-8">
        {/* Program Toggle */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Program Status</h2>
              <p className="mt-1 text-sm text-gray-500">Enable or disable the loyalty program for your customers.</p>
            </div>
            <button
              onClick={() => setProgram({ ...program, is_active: !program.is_active })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                program.is_active ? 'bg-brand-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  program.is_active ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Points Earning */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Points Earning</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Points per Booking</label>
              <input
                type="number"
                min="0"
                value={program.points_per_booking}
                onChange={(e) => setProgram({ ...program, points_per_booking: Number(e.target.value) || 0 })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Points per Dollar Spent</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={program.points_per_dollar}
                onChange={(e) => setProgram({ ...program, points_per_dollar: Number(e.target.value) || 0 })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Bonus Rules */}
          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">Bonus Rules</label>
            <div className="flex gap-2">
              <select
                value={ruleType}
                onChange={(e) => { setRuleType(e.target.value as 'service' | 'staff'); setRuleTargetId(''); }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="service">Service</option>
                <option value="staff">Staff</option>
              </select>
              <select
                value={ruleTargetId}
                onChange={(e) => setRuleTargetId(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Select {ruleType}...</option>
                {(ruleType === 'service' ? services : staffList).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={rulePoints}
                onChange={(e) => setRulePoints(e.target.value)}
                placeholder="Points"
                className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="button"
                onClick={addRule}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Add
              </button>
            </div>
            {rules.length > 0 && (
              <div className="mt-3 space-y-2">
                {rules.map((rule, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                    <span className="text-sm text-gray-700">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{rule.type}</span>
                      {' '}{getRuleName(rule)} — <strong>{rule.points} pts</strong>
                    </span>
                    <button onClick={() => removeRule(i)} className="text-sm text-red-600 hover:text-red-800">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Points Redemption */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Points Redemption</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Conversion Rate (points to $1)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={program.redemption_rate}
                onChange={(e) => setProgram({ ...program, redemption_rate: Number(e.target.value) || 0 })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Minimum Redemption Threshold</label>
              <input
                type="number"
                min="0"
                value={program.min_redemption_points}
                onChange={(e) => setProgram({ ...program, min_redemption_points: Number(e.target.value) || 0 })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Tier System */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Tier System</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tier Name</label>
              <input
                value={tierName}
                onChange={(e) => setTierName(e.target.value)}
                placeholder="Gold"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Min Points</label>
              <input
                type="number"
                min="0"
                value={tierMinPoints}
                onChange={(e) => setTierMinPoints(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Color</label>
              <input
                type="color"
                value={tierColor}
                onChange={(e) => setTierColor(e.target.value)}
                className="h-9 w-full cursor-pointer rounded-lg border border-gray-300"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={addTier}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Add Tier
              </button>
            </div>
          </div>
          <div className="mt-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Benefits</label>
            <textarea
              rows={2}
              value={tierBenefits}
              onChange={(e) => setTierBenefits(e.target.value)}
              placeholder="List of benefits for this tier..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          {program.tiers.length > 0 && (
            <div className="mt-4 space-y-2">
              {program.tiers.map((tier, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: tier.color }} />
                    <div>
                      <span className="text-sm font-medium text-gray-900">{tier.name}</span>
                      <span className="ml-2 text-xs text-gray-500">{tier.min_points} pts minimum</span>
                      {tier.benefits && <p className="mt-0.5 text-xs text-gray-500">{tier.benefits}</p>}
                    </div>
                  </div>
                  <button onClick={() => removeTier(i)} className="text-sm text-red-600 hover:text-red-800">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expiry */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Points Expiry</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Expiry Days (0 = never expire)</label>
            <input
              type="number"
              min="0"
              value={program.points_expiry_days}
              onChange={(e) => setProgram({ ...program, points_expiry_days: Number(e.target.value) || 0 })}
              className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
