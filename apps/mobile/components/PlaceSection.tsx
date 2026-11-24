import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PropertyStorefront, { type StorefrontProperty, type StorefrontTenant } from './PropertyStorefront';
import PropertyBusinessPage, { type BusinessSummary } from './PropertyBusinessPage';
import PropertyBookingFlow, { type BookingService } from './PropertyBookingFlow';
import type { NearbyPlace } from './PlaceStrip';

// A place is shown in Balkina's own colours, never in a property owner's branding.
const BALKINA = '#6B7FC4';

interface Props {
  place: NearbyPlace;
  apiBase: string;
  customer: { userId: string | null; name: string | null; phone: string | null; email: string | null };
  onBack: () => void;
  /** The chat input bar of the screen; a message sent from here is scoped to the place. */
  inputBar: React.ReactNode;
}

const summaryOf = (t: StorefrontTenant): BusinessSummary => ({
  id: t.id, name: t.name, cover_image_url: t.cover_image_url, logo_url: t.logo_url,
  category: t.category, subcategory: t.subcategory, description: t.description,
  avg_rating: t.avg_rating, review_count: t.review_count,
});

/**
 * "Book anything in <place>": the white-label storefront flow scoped to a place (docs/PLACES.md).
 * The businesses are the claimed ones located there; there is no owner, so no campaigns, membership
 * or account drawer, and the page says the businesses are independent.
 */
export default function PlaceSection({ place, apiBase, customer, onBack, inputBar }: Props) {
  const [data, setData] = useState<{ storefront: StorefrontProperty; notice: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [businessTarget, setBusinessTarget] = useState<{ summary: BusinessSummary; initialServiceId?: string } | null>(null);
  const [bookingTarget, setBookingTarget] = useState<{ tenantId: string; businessName: string; service: BookingService | null; extras?: string[]; packageName?: string; addOnTotal?: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null); setFailed(false);
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/places/${encodeURIComponent(place.slug)}`);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { place: { id: string; name: string; tagline: string | null; photo_url: string | null }; tenants: StorefrontTenant[]; notice?: string };
        if (cancelled) return;
        setData({
          storefront: {
            id: body.place.id,
            name: body.place.name,
            logo_url: null,
            cover_image_url: body.place.photo_url,
            welcome_message: body.place.tagline ?? 'Book anything here.',
            primary_color: BALKINA,
            tenants: body.tenants ?? [],
            campaigns: [],
          },
          notice: body.notice ?? 'Independent businesses. Not affiliated with the property owner.',
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [apiBase, place.slug]);

  if (!data) {
    return (
      <View style={styles.center}>
        {failed ? (
          <>
            <Text style={styles.failed}>{`Could not load ${place.name}. Please try again.`}</Text>
            <TouchableOpacity style={styles.backLink} onPress={onBack} accessibilityRole="button">
              <Ionicons name="chevron-back" size={16} color={BALKINA} />
              <Text style={styles.backLinkText}>Back</Text>
            </TouchableOpacity>
          </>
        ) : <ActivityIndicator size="small" color={BALKINA} />}
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.flex}>
        <PropertyStorefront
          property={data.storefront}
          apiBase={apiBase}
          isLoggedIn={!!customer.userId}
          customer={customer}
          onBack={onBack}
          footerNote={data.notice}
          onSelectBusiness={(t) => setBusinessTarget({ summary: summaryOf(t) })}
          onSelectEvent={(ev, tenantName) => {
            const t = data.storefront.tenants.find((x) => x.id === ev.tenant_id);
            setBusinessTarget({
              summary: t ? { ...summaryOf(t), cover_image_url: t.cover_image_url ?? ev.image_url ?? null } : {
                id: ev.tenant_id, name: tenantName || place.name, cover_image_url: ev.image_url ?? null, logo_url: null,
                category: null, subcategory: null, description: null, avg_rating: null, review_count: null,
              },
              initialServiceId: ev.id,
            });
          }}
        />
      </View>
      {inputBar}
      <PropertyBusinessPage
        visible={!!businessTarget}
        apiBase={apiBase}
        accent={BALKINA}
        business={businessTarget?.summary ?? null}
        initialServiceId={businessTarget?.initialServiceId ?? null}
        onClose={() => setBusinessTarget(null)}
        onBook={(service, selection) => {
          // Dismiss the full-screen business page first: iOS cannot present the booking modal on top of it.
          const biz = businessTarget?.summary;
          setBusinessTarget(null);
          setTimeout(
            () => setBookingTarget({
              tenantId: biz?.id ?? '', businessName: biz?.name ?? '', service,
              extras: selection.extras, packageName: selection.packageName, addOnTotal: selection.addOnTotal,
            }),
            320,
          );
        }}
      />
      <PropertyBookingFlow
        visible={!!bookingTarget}
        apiBase={apiBase}
        accent={BALKINA}
        tenantId={bookingTarget?.tenantId ?? ''}
        businessName={bookingTarget?.businessName ?? ''}
        initialService={bookingTarget?.service ?? null}
        extras={bookingTarget?.extras}
        packageName={bookingTarget?.packageName}
        addOnTotal={bookingTarget?.addOnTotal}
        customer={customer}
        onClose={() => setBookingTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F8F6F2' },
  failed: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 14 },
  backLinkText: { fontSize: 15, fontWeight: '600', color: BALKINA },
});
