import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/** A published place near the user, from GET /api/places. */
export interface NearbyPlace {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  photo_url: string | null;
  distance_km: number | null;
  inside: boolean;
  businesses: number;
}

interface Props {
  places: NearbyPlace[];
  onSelect: (place: NearbyPlace) => void;
}

const CARD_COLORS = ['#6B7FC4', '#4F9D8E', '#C4826B', '#8A6BC4', '#5B8FC4', '#C46B9A'];

/**
 * The strip of place cards on the home screen, between the headline and the category chips.
 * Renders nothing when no place is published nearby, so the home screen stays as it was.
 * A fixed height keeps the category chips on the first screen.
 */
export default function PlaceStrip({ places, onSelect }: Props) {
  if (places.length === 0) return null;
  const here = places.find((p) => p.inside);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{here ? `You're in ${here.name}. Book anything here.` : 'Book anything in'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {places.map((p, i) => (
          <TouchableOpacity key={p.id} style={[styles.card, { backgroundColor: CARD_COLORS[i % CARD_COLORS.length] }]} activeOpacity={0.85} onPress={() => onSelect(p)} accessibilityRole="button" accessibilityLabel={`Book anything in ${p.name}`}>
            {p.photo_url ? <Image source={{ uri: p.photo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
            <View style={styles.scrim} />
            <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {p.inside ? "You're here" : p.distance_km !== null ? `${p.distance_km < 10 ? p.distance_km.toFixed(1) : Math.round(p.distance_km)} km away` : `${p.businesses} to book`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginBottom: 20 },
  title: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 8, textAlign: 'center' },
  row: { gap: 10, paddingHorizontal: 2 },
  card: { width: 150, height: 92, borderRadius: 14, overflow: 'hidden', justifyContent: 'flex-end', padding: 10 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  name: { color: '#fff', fontSize: 16, fontWeight: '700' },
  meta: { color: 'rgba(255,255,255,0.92)', fontSize: 11.5, fontWeight: '500', marginTop: 1 },
});
