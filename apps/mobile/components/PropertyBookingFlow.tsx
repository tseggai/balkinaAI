import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPrice } from '@/lib/currency';

const IVORY = '#F7F4EF';
const INK = '#1A1A1A';
const MUTED = '#6B655C';
const HAIRLINE = '#E4DED4';

export interface BookingService {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  pricing_type: string | null;
  duration_minutes: number;
  service_type: string;
  capacity: number | null;
  deposit_enabled: boolean;
  hide_price: boolean;
  event_dates?: { date: string; start_time: string | null }[];
  timesheet?: Record<string, { enabled?: boolean; start?: string; end?: string }> | null;
}

interface Props {
  visible: boolean;
  apiBase: string;
  accent: string;
  tenantId: string;
  businessName: string;
  initialService?: BookingService | null;
  extras?: string[];
  packageName?: string;
  addOnTotal?: number;
  customer: { userId: string | null; name: string | null; phone: string | null; email: string | null };
  onClose: () => void;
}

type Step = 'services' | 'date' | 'time' | 'details' | 'done';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function to12h(t: string): string {
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr ?? '0', 10);
  const m = mStr ?? '00';
  const mer = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${mer}`;
}

function next14Days(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    out.push({ value, label });
  }
  return out;
}

function formatDateLabel(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

/** Generate 30-min table slots within the service's open hours for a given date. */
function tableTimes(service: BookingService, dateStr: string): string[] {
  const ts = service.timesheet;
  if (!ts) return [];
  const weekday = new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const day = ts[weekday];
  if (!day || day.enabled === false || !day.start || !day.end) return [];
  const [sh, sm] = day.start.split(':').map(Number);
  const [eh, em] = day.end.split(':').map(Number);
  const out: string[] = [];
  let cur = sh! * 60 + (sm ?? 0);
  const end = eh! * 60 + (em ?? 0);
  while (cur <= end) {
    out.push(to12h(`${Math.floor(cur / 60)}:${pad(cur % 60)}`));
    cur += 30;
  }
  return out;
}

export default function PropertyBookingFlow({
  visible, apiBase, accent, tenantId, businessName, initialService, extras, packageName, addOnTotal, customer, onClose,
}: Props) {
  const [services, setServices] = useState<BookingService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [selected, setSelected] = useState<BookingService | null>(null);
  const [step, setStep] = useState<Step>('services');

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [seatingTime, setSeatingTime] = useState<string | null>(null); // event start_time
  const [slots, setSlots] = useState<{ time: string; iso: string }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ time: string; iso: string } | null>(null);
  const [tableTime, setTableTime] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(2);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; total: number; currency: string; bookingType: string } | null>(null);

  const isEvent = selected?.service_type === 'event';
  const isTable = selected?.service_type === 'table';
  // Logged-in customers book with their saved profile; only guests are asked.
  const knownCustomer = !!(customer.userId && customer.name?.trim() && customer.phone?.trim());
  const dates = useMemo(() => next14Days(), []);

  // (Re)initialise whenever the modal opens.
  useEffect(() => {
    if (!visible) return;
    setError(null);
    setResult(null);
    setSelectedDate(null);
    setSeatingTime(null);
    setSelectedSlot(null);
    setTableTime(null);
    setPartySize(2);
    setName(customer.name ?? '');
    setPhone(customer.phone ?? '');
    setEmail(customer.email ?? '');
    if (initialService) {
      setSelected(initialService);
      setStep('date');
    } else {
      setSelected(null);
      setStep('services');
      void loadServices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function loadServices() {
    setServicesLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/booking/services?tenantId=${tenantId}`);
      const data = (await res.json()) as { services?: BookingService[] };
      setServices(data.services ?? []);
    } catch {
      setServices([]);
    } finally {
      setServicesLoading(false);
    }
  }

  async function loadSlots(svc: BookingService, date: string) {
    setSlotsLoading(true);
    setSlots([]);
    try {
      const res = await fetch(`${apiBase}/api/booking/staff-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, serviceId: svc.id, date, userId: customer.userId }),
      });
      const data = (await res.json()) as { anyone_slots?: { time: string; iso: string; available: boolean }[] };
      setSlots((data.anyone_slots ?? []).filter((s) => s.available).map((s) => ({ time: s.time, iso: s.iso })));
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  function pickService(svc: BookingService) {
    setSelected(svc);
    setSelectedDate(null);
    setStep('date');
  }

  function pickDate(date: string) {
    setSelectedDate(date);
    if (isEvent) {
      const seating = selected?.event_dates?.find((d) => d.date === date);
      setSeatingTime(seating?.start_time ?? '00:00');
      setStep('details');
    } else if (isTable) {
      setStep('time');
    } else {
      setStep('time');
      if (selected) void loadSlots(selected, date);
    }
  }

  async function submit() {
    if (!selected || !selectedDate) return;
    if (!name.trim() || !phone.trim()) {
      setError('Please enter your name and phone number.');
      return;
    }
    const timeSlot = isEvent
      ? to12h(seatingTime ?? '00:00')
      : isTable
        ? tableTime ?? ''
        : selectedSlot?.time ?? '';
    if (!timeSlot) {
      setError('Please choose a time.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/booking/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          serviceId: selected.id,
          date: selectedDate,
          timeSlot,
          timeSlotIso: !isEvent && !isTable ? selectedSlot?.iso : undefined,
          partySize: isEvent || isTable ? partySize : undefined,
          bookingType: isEvent ? 'event' : isTable ? 'table' : 'service',
          extras: extras && extras.length > 0 ? extras : undefined,
          packageName: packageName || undefined,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerEmail: email.trim() || undefined,
          userId: customer.userId ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not complete the booking. Please try again.');
        setSubmitting(false);
        return;
      }
      setResult({
        status: data.status,
        total: data.total ?? 0,
        currency: data.currency ?? 'USD',
        bookingType: data.booking_type ?? 'service',
      });
      setStep('done');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const priceLabel = (s: BookingService) =>
    s.hide_price ? '' : `${formatPrice(Number(s.price))}${s.pricing_type === 'per_person' ? ' / guest' : ''}`;

  const canBack = step !== 'done' && !(step === 'services');
  const goBack = () => {
    if (step === 'details') setStep(isEvent ? 'date' : isTable ? 'time' : 'time');
    else if (step === 'time') setStep('date');
    else if (step === 'date') {
      if (initialService) onClose();
      else setStep('services');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={canBack ? goBack : onClose} style={styles.headerBtn} hitSlop={10}>
            <Ionicons name={canBack ? 'arrow-back' : 'close'} size={24} color={INK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{selected?.name ?? businessName}</Text>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} hitSlop={10}>
            {step !== 'done' && canBack ? <Ionicons name="close" size={22} color={MUTED} /> : <View style={{ width: 22 }} />}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* STEP: services */}
          {step === 'services' && (
            servicesLoading ? (
              <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
            ) : services.length === 0 ? (
              <Text style={styles.empty}>No bookable services right now.</Text>
            ) : (
              <>
                <Text style={styles.stepTitle}>Choose a service</Text>
                {services.map((s) => (
                  <TouchableOpacity key={s.id} style={styles.row} activeOpacity={0.85} onPress={() => pickService(s)}>
                    {s.image_url ? (
                      <Image source={{ uri: s.image_url }} style={styles.rowThumb} />
                    ) : (
                      <View style={[styles.rowThumb, { backgroundColor: accent }]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{s.name}</Text>
                      <Text style={styles.rowMeta}>
                        {s.service_type === 'event' ? 'Experience' : s.service_type === 'table' ? 'Reservation' : `${s.duration_minutes} min`}
                        {priceLabel(s) ? ` · ${priceLabel(s)}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={MUTED} />
                  </TouchableOpacity>
                ))}
              </>
            )
          )}

          {/* STEP: date */}
          {step === 'date' && selected && (
            <>
              <Text style={styles.stepTitle}>{isEvent ? 'Choose a date' : 'Pick a day'}</Text>
              {isEvent ? (
                (selected.event_dates ?? []).length === 0 ? (
                  <Text style={styles.empty}>No upcoming dates for this experience.</Text>
                ) : (
                  (selected.event_dates ?? []).map((d) => (
                    <TouchableOpacity
                      key={`${d.date}-${d.start_time}`}
                      style={[styles.dateCard, selectedDate === d.date && { borderColor: accent, borderWidth: 2 }]}
                      activeOpacity={0.85}
                      onPress={() => pickDate(d.date)}
                    >
                      <View>
                        <Text style={styles.dateCardDay}>{formatDateLabel(d.date)}</Text>
                        {d.start_time ? <Text style={styles.rowMeta}>Seating at {to12h(d.start_time)}</Text> : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={MUTED} />
                    </TouchableOpacity>
                  ))
                )
              ) : (
                <View style={styles.chipWrap}>
                  {dates.map((d) => (
                    <TouchableOpacity
                      key={d.value}
                      style={[styles.chip, selectedDate === d.value && { backgroundColor: accent, borderColor: accent }]}
                      onPress={() => pickDate(d.value)}
                    >
                      <Text style={[styles.chipText, selectedDate === d.value && { color: '#fff' }]}>{d.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* STEP: time */}
          {step === 'time' && selected && selectedDate && (
            <>
              <Text style={styles.stepTitle}>Choose a time</Text>
              <Text style={styles.rowMeta}>{formatDateLabel(selectedDate)}</Text>
              {isTable ? (
                (() => {
                  const times = tableTimes(selected, selectedDate);
                  return times.length === 0 ? (
                    <Text style={styles.empty}>Closed that day — pick another.</Text>
                  ) : (
                    <View style={[styles.chipWrap, { marginTop: 14 }]}>
                      {times.map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.chip, tableTime === t && { backgroundColor: accent, borderColor: accent }]}
                          onPress={() => { setTableTime(t); setStep('details'); }}
                        >
                          <Text style={[styles.chipText, tableTime === t && { color: '#fff' }]}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })()
              ) : slotsLoading ? (
                <ActivityIndicator color={accent} style={{ marginTop: 24 }} />
              ) : slots.length === 0 ? (
                <Text style={styles.empty}>No times available — try another day.</Text>
              ) : (
                <View style={[styles.chipWrap, { marginTop: 14 }]}>
                  {slots.map((s) => (
                    <TouchableOpacity
                      key={s.iso}
                      style={[styles.chip, selectedSlot?.iso === s.iso && { backgroundColor: accent, borderColor: accent }]}
                      onPress={() => { setSelectedSlot(s); setStep('details'); }}
                    >
                      <Text style={[styles.chipText, selectedSlot?.iso === s.iso && { color: '#fff' }]}>{s.time}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* STEP: details */}
          {step === 'details' && selected && (
            <>
              <Text style={styles.stepTitle}>Your details</Text>
              <View style={styles.summary}>
                <Text style={styles.summaryName}>{selected.name}</Text>
                <Text style={styles.rowMeta}>{businessName}</Text>
                <Text style={styles.rowMeta}>
                  {selectedDate ? formatDateLabel(selectedDate) : ''}
                  {isEvent && seatingTime ? ` · ${to12h(seatingTime)}` : ''}
                  {isTable && tableTime ? ` · ${tableTime}` : ''}
                  {!isEvent && !isTable && selectedSlot ? ` · ${selectedSlot.time}` : ''}
                </Text>
              </View>

              {(isEvent || isTable) && (
                <View style={styles.partyRow}>
                  <Text style={styles.label}>{isTable ? 'Guests' : 'Seats'}</Text>
                  <View style={styles.stepper}>
                    <TouchableOpacity onPress={() => setPartySize((p) => Math.max(1, p - 1))} style={styles.stepperBtn}>
                      <Ionicons name="remove" size={18} color={INK} />
                    </TouchableOpacity>
                    <Text style={styles.stepperVal}>{partySize}</Text>
                    <TouchableOpacity onPress={() => setPartySize((p) => p + 1)} style={styles.stepperBtn}>
                      <Ionicons name="add" size={18} color={INK} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {knownCustomer ? (
                // Logged-in customer: use their profile, don't re-ask details.
                <View style={styles.bookingAs}>
                  <Ionicons name="person-circle-outline" size={22} color={accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookingAsName}>{name}</Text>
                    <Text style={styles.rowMeta}>{[phone, email].filter(Boolean).join(' · ')}</Text>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.label}>Name</Text>
                  <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#9ca3af" />
                  <Text style={styles.label}>Phone</Text>
                  <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone number" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />
                  <Text style={styles.label}>Email (optional)</Text>
                  <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#9ca3af" keyboardType="email-address" autoCapitalize="none" />
                </>
              )}

              {(packageName || (extras && extras.length > 0)) && (
                <View style={styles.addOnsRow}>
                  <Ionicons name="add-circle-outline" size={15} color={MUTED} />
                  <Text style={styles.addOnsText} numberOfLines={2}>
                    {[packageName, ...(extras ?? [])].filter(Boolean).join(', ')}
                  </Text>
                </View>
              )}

              {!selected.hide_price && (
                <View style={styles.totalRow}>
                  <Text style={styles.label}>Total</Text>
                  <Text style={styles.totalVal}>
                    {formatPrice(Number(selected.price) * (selected.pricing_type === 'per_person' ? partySize : 1) + (addOnTotal ?? 0))}
                  </Text>
                </View>
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.cta, { backgroundColor: accent }, submitting && { opacity: 0.6 }]}
                onPress={submit}
                disabled={submitting}
                activeOpacity={0.9}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.ctaText}>{isTable ? 'Request reservation' : 'Confirm booking'}</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* STEP: done */}
          {step === 'done' && result && (
            <View style={styles.doneWrap}>
              <View style={[styles.doneIcon, { backgroundColor: accent }]}>
                <Ionicons name={result.status === 'pending' ? 'time-outline' : 'checkmark'} size={36} color="#fff" />
              </View>
              <Text style={styles.doneTitle}>
                {result.status === 'pending' ? 'Reservation requested' : 'Booking confirmed'}
              </Text>
              <Text style={styles.doneSub}>
                {result.status === 'pending'
                  ? `${businessName} will confirm your reservation shortly.`
                  : `You're booked at ${businessName}.`}
              </Text>
              <Text style={styles.doneMeta}>
                {selected?.name} · {selectedDate ? formatDateLabel(selectedDate) : ''}
              </Text>
              <TouchableOpacity style={[styles.cta, { backgroundColor: accent, marginTop: 28 }]} onPress={onClose} activeOpacity={0.9}>
                <Text style={styles.ctaText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: IVORY },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: HAIRLINE,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: INK },
  body: { padding: 20, paddingBottom: 48 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: INK, marginBottom: 16, letterSpacing: 0.3 },
  empty: { fontSize: 14, color: MUTED, marginTop: 24, textAlign: 'center' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff',
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: HAIRLINE, marginBottom: 12,
  },
  rowThumb: { width: 52, height: 52, borderRadius: 10 },
  rowName: { fontSize: 16, fontWeight: '700', color: INK },
  rowMeta: { fontSize: 13, color: MUTED, marginTop: 3 },

  dateCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: HAIRLINE, marginBottom: 12,
  },
  dateCardDay: { fontSize: 16, fontWeight: '700', color: INK },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
    borderWidth: 1, borderColor: HAIRLINE, backgroundColor: '#fff',
  },
  chipText: { fontSize: 14, fontWeight: '600', color: INK },

  summary: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: HAIRLINE, marginBottom: 20 },
  bookingAs: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: HAIRLINE, marginTop: 8 },
  bookingAsName: { fontSize: 16, fontWeight: '700', color: INK },
  summaryName: { fontSize: 17, fontWeight: '700', color: INK },

  partyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stepperBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: HAIRLINE, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  stepperVal: { fontSize: 18, fontWeight: '700', color: INK, minWidth: 24, textAlign: 'center' },

  label: { fontSize: 13, fontWeight: '600', color: MUTED, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: HAIRLINE,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK,
  },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  totalVal: { fontSize: 20, fontWeight: '700', color: INK },
  addOnsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  addOnsText: { flex: 1, fontSize: 13, color: MUTED },
  error: { color: '#dc2626', fontSize: 13, marginTop: 14 },

  cta: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  doneWrap: { alignItems: 'center', paddingTop: 48 },
  doneIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  doneTitle: { fontSize: 24, fontWeight: '700', color: INK, textAlign: 'center' },
  doneSub: { fontSize: 15, color: MUTED, textAlign: 'center', marginTop: 10, lineHeight: 21, maxWidth: 300 },
  doneMeta: { fontSize: 14, color: INK, fontWeight: '600', marginTop: 16, textAlign: 'center' },
});
