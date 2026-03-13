import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://balkina-ai.vercel.app';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
  breaks: { start: string; end: string }[];
}

type WeekSchedule = Record<string, DaySchedule>;

interface SpecialDay {
  date: string;
  start_time?: string;
  end_time?: string;
  is_day_off: boolean;
  breaks?: { start: string; end: string }[];
}

function defaultSchedule(): WeekSchedule {
  const schedule: WeekSchedule = {};
  for (const day of DAYS) {
    schedule[day] = {
      enabled: day !== 'saturday' && day !== 'sunday',
      start: '09:00',
      end: '17:00',
      breaks: [],
    };
  }
  return schedule;
}

export default function AvailabilityScreen() {
  const [schedule, setSchedule] = useState<WeekSchedule>(defaultSchedule());
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newBlockDate, setNewBlockDate] = useState('');

  const fetchAvailability = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(`${API_BASE}/api/staff/availability`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json() as { data: { schedule: WeekSchedule; special_days: SpecialDay[] } | null };
      if (json.data) {
        // Merge fetched schedule with defaults for any missing days
        const fetched = json.data.schedule ?? {};
        const merged = defaultSchedule();
        for (const day of DAYS) {
          if (fetched[day]) {
            merged[day] = {
              enabled: fetched[day].enabled ?? merged[day].enabled,
              start: fetched[day].start ?? merged[day].start,
              end: fetched[day].end ?? merged[day].end,
              breaks: fetched[day].breaks ?? [],
            };
          }
        }
        setSchedule(merged);
        setSpecialDays(
          (json.data.special_days ?? []).map((sd: Record<string, unknown>) => ({
            date: sd.date as string,
            start_time: (sd.start_time as string | undefined) ?? undefined,
            end_time: (sd.end_time as string | undefined) ?? undefined,
            is_day_off: (sd.is_day_off as boolean) ?? true,
          })),
        );
      }
    } catch {
      // Keep defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAvailability(); }, [fetchAvailability]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }

    try {
      const res = await fetch(`${API_BASE}/api/staff/availability`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ schedule, special_days: specialDays }),
      });
      const json = await res.json() as { error?: { message: string } | null };
      if (json.error) {
        Alert.alert('Error', json.error.message);
      } else {
        Alert.alert('Saved', 'Your availability has been updated.');
      }
    } catch {
      Alert.alert('Error', 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  }, [schedule, specialDays]);

  const toggleDay = (day: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
  };

  const updateTime = (day: string, field: 'start' | 'end', value: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const addBreak = (day: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        breaks: [...prev[day].breaks, { start: '12:00', end: '13:00' }],
      },
    }));
  };

  const removeBreak = (day: string, idx: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        breaks: prev[day].breaks.filter((_, i) => i !== idx),
      },
    }));
  };

  const addBlockDate = () => {
    if (!newBlockDate || !/^\d{4}-\d{2}-\d{2}$/.test(newBlockDate)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format');
      return;
    }
    setSpecialDays((prev) => [...prev, { date: newBlockDate, is_day_off: true }]);
    setNewBlockDate('');
  };

  const removeSpecialDay = (idx: number) => {
    setSpecialDays((prev) => prev.filter((_, i) => i !== idx));
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#6B7FC4" /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Weekly schedule */}
      <Text style={styles.sectionTitle}>Weekly Schedule</Text>
      {DAYS.map((day) => {
        const ds = schedule[day];
        return (
          <View key={day} style={styles.dayRow}>
            <View style={styles.dayHeader}>
              <Switch
                value={ds.enabled}
                onValueChange={() => toggleDay(day)}
                trackColor={{ false: '#e5e7eb', true: '#6B7FC4' }}
                thumbColor="#fff"
              />
              <Text style={[styles.dayLabel, !ds.enabled && styles.dayLabelDisabled]}>
                {DAY_LABELS[day]}
              </Text>
              {ds.enabled && (
                <View style={styles.timeInputs}>
                  <TextInput
                    style={styles.timeInput}
                    value={ds.start}
                    onChangeText={(v) => updateTime(day, 'start', v)}
                    placeholder="09:00"
                  />
                  <Text style={styles.timeSep}>-</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={ds.end}
                    onChangeText={(v) => updateTime(day, 'end', v)}
                    placeholder="17:00"
                  />
                </View>
              )}
            </View>

            {ds.enabled && (
              <View style={styles.breaksSection}>
                {ds.breaks.map((brk, idx) => (
                  <View key={idx} style={styles.breakRow}>
                    <Text style={styles.breakLabel}>Break:</Text>
                    <TextInput
                      style={styles.breakInput}
                      value={brk.start}
                      onChangeText={(v) => {
                        const updated = [...ds.breaks];
                        updated[idx] = { ...brk, start: v };
                        setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], breaks: updated } }));
                      }}
                    />
                    <Text style={styles.timeSep}>-</Text>
                    <TextInput
                      style={styles.breakInput}
                      value={brk.end}
                      onChangeText={(v) => {
                        const updated = [...ds.breaks];
                        updated[idx] = { ...brk, end: v };
                        setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], breaks: updated } }));
                      }}
                    />
                    <TouchableOpacity onPress={() => removeBreak(day, idx)}>
                      <Ionicons name="close-circle" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addBreakBtn} onPress={() => addBreak(day)}>
                  <Ionicons name="add" size={16} color="#6B7FC4" />
                  <Text style={styles.addBreakText}>Add break</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {/* Special days / blocked dates */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Blocked Dates</Text>
      <View style={styles.addBlockRow}>
        <TextInput
          style={styles.blockDateInput}
          value={newBlockDate}
          onChangeText={setNewBlockDate}
          placeholder="YYYY-MM-DD"
        />
        <TouchableOpacity style={styles.addBlockBtn} onPress={addBlockDate}>
          <Text style={styles.addBlockBtnText}>Block</Text>
        </TouchableOpacity>
      </View>

      {specialDays.map((sd, idx) => (
        <View key={idx} style={styles.specialDayRow}>
          <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
          <Text style={styles.specialDayText}>{sd.date} — Day off</Text>
          <TouchableOpacity onPress={() => removeSpecialDay(idx)}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ))}

      {/* Save button */}
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Save Changes</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },
  dayRow: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#f3f4f6' },
  dayHeader: { flexDirection: 'row', alignItems: 'center' },
  dayLabel: { fontSize: 15, fontWeight: '600', color: '#111827', marginLeft: 10, width: 40 },
  dayLabelDisabled: { color: '#9ca3af' },
  timeInputs: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  timeInput: { width: 60, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', textAlign: 'center', fontSize: 14, backgroundColor: '#f9fafb' },
  timeSep: { marginHorizontal: 6, color: '#9ca3af' },
  breaksSection: { marginTop: 8, paddingLeft: 52 },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  breakLabel: { fontSize: 12, color: '#6b7280', width: 40 },
  breakInput: { width: 55, height: 32, borderRadius: 6, borderWidth: 1, borderColor: '#e5e7eb', textAlign: 'center', fontSize: 13, backgroundColor: '#f9fafb' },
  addBreakBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  addBreakText: { fontSize: 13, color: '#6B7FC4', fontWeight: '500' },
  addBlockRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  blockDateInput: { flex: 1, height: 42, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 12, fontSize: 14, backgroundColor: '#fff' },
  addBlockBtn: { backgroundColor: '#6B7FC4', paddingHorizontal: 20, borderRadius: 8, justifyContent: 'center' },
  addBlockBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  specialDayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#f3f4f6' },
  specialDayText: { flex: 1, fontSize: 14, color: '#111827' },
  saveBtn: { backgroundColor: '#6B7FC4', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
