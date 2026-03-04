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
  rules: LoyaltyRule[];
}

interface ServiceOption {
  id: string;
  name: string;
}

interface StaffOption {
  id: string;
  name: string;
}

function emptyProgram(): LoyaltyProgram {
  return {
    is_active: true,
    points_per_booking: 10,
    points_per_dollar: 1,
    redemption_rate: 100,
    min_redemption_points: 100,
    points_expiry_days: 0,
    tiers: [],
    rules: [],
  };
}

export default function LoyaltyPage() {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Panel state
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<LoyaltyProgram>(emptyProgram());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      const prog: LoyaltyProgram = {
        id: p.id as string | undefined,
        is_active: (p.is_active as boolean) ?? false,
        points_per_booking: (p.points_per_booking as number) ?? 0,
        points_per_dollar: (p.points_per_currency_unit as number ?? p.points_per_dollar as number) ?? 0,
        redemption_rate: (p.redemption_rate as number) ?? 0,
        min_redemption_points: (p.min_redemption_points as number) ?? 0,
        points_expiry_days: (p.points_expiry_days as number) ?? 0,
        tiers: (p.tiers as LoyaltyTier[]) ?? [],
        rules: (loyaltyJson.data?.rules as LoyaltyRule[]) ?? [],
      };
      setPrograms([prog]);
    } else {
      setPrograms([]);
    }

    setServices((servicesJson.data ?? []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
    setStaffList((staffJson.data ?? []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openNew() {
    setEditingIndex(null);
    setForm(emptyProgram());
    resetRuleTierForms();
    setShowForm(true);
  }

  function openEdit(index: number) {
    const prog = programs[index];
    if (!prog) return;
    setEditingIndex(index);
    setForm({ ...prog });
    resetRuleTierForms();
    setShowForm(true);
  }

  function resetRuleTierForms() {
    setRuleType('service');
    setRuleTargetId('');
    setRulePoints('');
    setTierName('');
    setTierMinPoints('');
    setTierColor('#6366f1');
    setTierBenefits('');
    setError('');
  }

  function addRule() {
    if (!ruleTargetId || !rulePoints) return;
    setForm({
      ...form,
      rules: [...form.rules, { type: ruleType, target_id: ruleTargetId, points: Number(rulePoints) || 0 }],
    });
    setRuleTargetId('');
    setRulePoints('');
  }

  function removeRule(index: number) {
    setForm({ ...form, rules: form.rules.filter((_, i) => i !== index) });
  }

  function getRuleName(rule: LoyaltyRule): string {
    if (rule.type === 'service') {
      return services.find((s) => s.id === rule.target_id)?.name ?? 'Unknown Service';
    }
    return staffList.find((s) => s.id === rule.target_id)?.name ?? 'Unknown Staff';
  }

  function addTier() {
    if (!tierName.trim()) return;
    setForm({
      ...form,
      tiers: [...form.tiers, {
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
    setForm({ ...form, tiers: form.tiers.filter((_, i) => i !== index) });
  }

  async function handleDelete(index: number) {
    if (!confirm('Delete this loyalty program?')) return;
    const prog = programs[index];
    if (!prog) return;
    await fetch('/api/loyalty', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        is_active: false,
        points_per_booking: 0,
        points_per_dollar: 0,
        redemption_rate: 0,
        min_redemption_points: 0,
        points_expiry_days: 0,
        tiers: [],
        rules: [],
      }),
    });
    setPrograms([]);
  }

  async function handleToggleActive(index: number) {
    const prog = programs[index];
    if (!prog) return;
    const body = {
      is_active: !prog.is_active,
      points_per_booking: prog.points_per_booking,
      points_per_dollar: prog.points_per_dollar,
      redemption_rate: prog.redemption_rate,
      min_redemption_points: prog.min_redemption_points,
      points_expiry_days: prog.points_expiry_days,
      tiers: prog.tiers,
      rules: prog.rules.map((r) => ({ type: r.type, target_id: r.target_id, points: r.points })),
    };
    const res = await fetch('/api/loyalty', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) fetchData();
  }

  async function handleSave() {
    setError('');
    if (!form.points_per_booking && !form.points_per_dollar) {
      setError('Please set at least one earning rule.');
      return;
    }
    setSaving(true);

    const body = {
      is_active: form.is_active,
      points_per_booking: form.points_per_booking,
      points_per_dollar: form.points_per_dollar,
      redemption_rate: form.redemption_rate,
      min_redemption_points: form.min_redemption_points,
      points_expiry_days: form.points_expiry_days,
      tiers: form.tiers,
      rules: form.rules.map((r) => ({ type: r.type, target_id: r.target_id, points: r.points })),
    };

    const res = await fetch('/api/loyalty', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) { setError(json.error?.message ?? 'Failed to save'); setSaving(false); return; }
    setSaving(false);
    setShowForm(false);
    fetchData();
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Loyalty Programs</h1>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {programs.length}
          </span>
        </div>
        <button
          onClick={openNew}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Add Loyalty Program
        </button>
      </div>

      {/* List */}
      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {programs.length === 0 ? (
          <div className="p-16 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
            </svg>
            <p className="mt-3 text-sm text-gray-500">No loyalty programs yet</p>
            <button
              onClick={openNew}
              className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Create your first program
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Program</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Pts/Booking</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Redemption Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Tiers</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Expiry</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {programs.map((prog, i) => (
                <tr key={prog.id ?? i} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50">
                        <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">Loyalty Program</div>
                        <div className="text-xs text-gray-500">
                          {prog.points_per_dollar > 0 ? `${prog.points_per_dollar} pts/$` : ''}{prog.points_per_booking > 0 ? ` ${prog.points_per_booking} pts/booking` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(i)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        prog.is_active ? 'bg-brand-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          prog.is_active ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{prog.points_per_booking}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{prog.redemption_rate} pts = $1</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{prog.tiers.length}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {prog.points_expiry_days > 0 ? `${prog.points_expiry_days} days` : 'Never'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <button onClick={() => openEdit(i)} className="mr-3 text-brand-600 hover:text-brand-800">Edit</button>
                    <button onClick={() => handleDelete(i)} className="text-red-600 hover:text-red-800">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Slide-in Panel */}
      {showForm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="fixed right-0 top-0 z-50 flex h-full w-[480px] max-w-full flex-col bg-white shadow-2xl transition-transform duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingIndex !== null ? 'Edit Loyalty Program' : 'New Loyalty Program'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                {/* Active toggle */}
                <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Program Status</p>
                    <p className="text-xs text-gray-500">Enable or disable this program</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, is_active: !form.is_active })}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      form.is_active ? 'bg-brand-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        form.is_active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Points Earning */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">Points Earning</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Points per Booking</label>
                      <input
                        type="number"
                        min="0"
                        value={form.points_per_booking}
                        onChange={(e) => setForm({ ...form, points_per_booking: Number(e.target.value) || 0 })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Points per $1 Spent</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={form.points_per_dollar}
                        onChange={(e) => setForm({ ...form, points_per_dollar: Number(e.target.value) || 0 })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Bonus Rules */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">Bonus Rules (per Service/Staff)</h3>
                  <div className="flex gap-2">
                    <select
                      value={ruleType}
                      onChange={(e) => { setRuleType(e.target.value as 'service' | 'staff'); setRuleTargetId(''); }}
                      className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="service">Service</option>
                      <option value="staff">Staff</option>
                    </select>
                    <select
                      value={ruleTargetId}
                      onChange={(e) => setRuleTargetId(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="">Select...</option>
                      {(ruleType === 'service' ? services : staffList).map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={rulePoints}
                      onChange={(e) => setRulePoints(e.target.value)}
                      placeholder="Pts"
                      className="w-20 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <button
                      type="button"
                      onClick={addRule}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Add
                    </button>
                  </div>
                  {form.rules.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {form.rules.map((rule, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                          <span className="text-sm text-gray-700">
                            <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{rule.type}</span>
                            {' '}{getRuleName(rule)} — <strong>{rule.points} pts</strong>
                          </span>
                          <button onClick={() => removeRule(i)} className="text-xs text-red-600 hover:text-red-800">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Redemption */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">Redemption</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Conversion Rate (pts to $1)</label>
                      <input
                        type="number"
                        min="0"
                        value={form.redemption_rate}
                        onChange={(e) => setForm({ ...form, redemption_rate: Number(e.target.value) || 0 })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Min Redemption Threshold</label>
                      <input
                        type="number"
                        min="0"
                        value={form.min_redemption_points}
                        onChange={(e) => setForm({ ...form, min_redemption_points: Number(e.target.value) || 0 })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Tier System */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">Tier System</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      value={tierName}
                      onChange={(e) => setTierName(e.target.value)}
                      placeholder="Tier name"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <input
                      type="number"
                      min="0"
                      value={tierMinPoints}
                      onChange={(e) => setTierMinPoints(e.target.value)}
                      placeholder="Min pts"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={tierColor}
                        onChange={(e) => setTierColor(e.target.value)}
                        className="h-9 w-10 cursor-pointer rounded-lg border border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={addTier}
                        className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <div className="mt-1">
                    <textarea
                      rows={2}
                      value={tierBenefits}
                      onChange={(e) => setTierBenefits(e.target.value)}
                      placeholder="Benefits for this tier (optional)..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                  {form.tiers.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {form.tiers.map((tier, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full" style={{ backgroundColor: tier.color }} />
                            <div>
                              <span className="text-sm font-medium text-gray-900">{tier.name}</span>
                              <span className="ml-2 text-xs text-gray-500">{tier.min_points} pts</span>
                              {tier.benefits && <p className="text-xs text-gray-500">{tier.benefits}</p>}
                            </div>
                          </div>
                          <button onClick={() => removeTier(i)} className="text-xs text-red-600 hover:text-red-800">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expiry */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">Points Expiry</h3>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Expiry Days (0 = never)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.points_expiry_days}
                      onChange={(e) => setForm({ ...form, points_expiry_days: Number(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            </div>
            {/* Footer */}
            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingIndex !== null ? 'Update Program' : 'Create Program'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
