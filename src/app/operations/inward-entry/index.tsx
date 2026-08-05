import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  useBillEntries,
  useGenerateGrnEntries,
  useInwardEntries,
  useInwardWeighBridgeEntries,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { RecordCard } from '@/components/record-card';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { DetailRow, Segmented, StatTile } from '@/components/ui/misc';
import { Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useMasterLookups } from '@/features/operations/lookups';
import { formatCurrency, formatDate, formatNumber, refId } from '@/lib/format';
import { useTheme } from '@/theme';

type Tab = 'pending' | 'bills' | 'created';

/**
 * Inward entry — turning received goods into billed, booked stock.
 *
 * Three views of one pipeline: GRN lines still waiting for a bill, the bills
 * themselves, and the inward entries that have made it into the ledger. The
 * pending count is the backlog, which is why it leads.
 */
export default function InwardEntryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const lookups = useMasterLookups();

  const grns = useGenerateGrnEntries();
  const bills = useBillEntries();
  const inwards = useInwardEntries();
  const wbis = useInwardWeighBridgeEntries();

  const [tab, setTab] = useState<Tab>('pending');

  /** GRN lines with no inward entry booked against them yet. */
  const pending = useMemo(() => {
    const booked = new Set((inwards.data ?? []).map((entry) => refId(entry.grn_entry_item_id)));
    return (grns.data ?? []).flatMap((grn) =>
      (grn.entries ?? [])
        .filter((item) => !booked.has(item._id))
        .map((item) => ({ grn, item }))
    );
  }, [grns.data, inwards.data]);

  const billed = bills.data ?? [];
  const created = inwards.data ?? [];

  const totals = useMemo(
    () => ({
      pendingBags: pending.reduce((sum, row) => sum + (row.item.bags_used || 0), 0),
      billValue: billed.reduce((sum, bill) => sum + (bill.net_amount || 0), 0),
    }),
    [pending, billed]
  );

  if (grns.isLoading || inwards.isLoading) {
    return (
      <Screen>
        <Header title="Inward Entry" />
        <ListSkeleton />
      </Screen>
    );
  }

  if (grns.isError) {
    return (
      <Screen>
        <Header title="Inward Entry" />
        <ErrorState message={getErrorMessage(grns.error)} onRetry={() => void grns.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="Inward Entry"
        subtitle={pending.length > 0 ? `${pending.length} GRN lines awaiting billing` : 'Everything is billed'}
      />

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={grns.isRefetching || bills.isRefetching || inwards.isRefetching}
            onRefresh={() => {
              void grns.refetch();
              void bills.refetch();
              void inwards.refetch();
            }}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <StatTile
            label="Bags awaiting bill"
            value={formatNumber(totals.pendingBags)}
            icon="hourglass-outline"
            tone={pending.length > 0 ? 'warning' : 'success'}
          />
          <StatTile label="Billed value" value={formatCurrency(totals.billValue, 0)} icon="cash-outline" tone="info" />
        </View>

        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pending', label: 'Pending', count: pending.length },
            { value: 'bills', label: 'Bills', count: billed.length },
            { value: 'created', label: 'Booked', count: created.length },
          ]}
        />

        {tab === 'pending' && pending.length === 0 && (
          <EmptyState
            icon="checkmark-done-outline"
            title="Nothing pending"
            description="Every GRN line has an inward entry against it."
          />
        )}

        {tab === 'pending' &&
          pending.map(({ grn, item }, index) => {
            const wbi = (wbis.data ?? []).find((entry) => entry.wbi_id === grn.wbi_id);
            return (
              <Animated.View key={item._id} entering={index < 10 ? FadeInDown.delay(index * 20).duration(200) : undefined}>
                <RecordCard
                  title={`${lookups.commodityName(item.commodity_id)} · ${lookups.gradeName(item.grade_id)}`}
                  subtitle={`GRN ${grn.grn_id} · ${wbi?.vehicle_no ?? 'No vehicle'} · ${formatDate(grn.date)}`}
                  icon="hourglass-outline"
                  accent="warning"
                  fields={[
                    { label: 'Bags', value: formatNumber(item.bags_used), emphasis: true },
                    { label: 'Bag type', value: lookups.bagConfigName(item.bag_type_id) },
                    { label: 'Location', value: lookups.locationName(item.location_id) },
                    { label: 'Sub-location', value: lookups.subLocationName(item.location_id, item.sub_location_id) },
                  ]}
                  onPress={() =>
                    router.push(`/operations/inward-entry/bill?grn=${grn._id}&item=${item._id}` as never)
                  }
                />
              </Animated.View>
            );
          })}

        {tab === 'bills' && billed.length === 0 && (
          <EmptyState icon="receipt-outline" title="No bills yet" description="Bills raised against GRN lines appear here." />
        )}

        {tab === 'bills' &&
          billed.map((bill, index) => (
            <Animated.View key={bill._id} entering={index < 10 ? FadeInDown.delay(index * 20).duration(200) : undefined}>
              <Card>
                <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">Bill {bill.bill_no || bill.bill_number}</Text>
                    <Text variant="caption" tone="muted">
                      {lookups.vendorName(refId(bill.party_id))} · {formatDate(bill.bill_date as unknown as string)}
                    </Text>
                  </View>
                  <Text variant="bodyStrong" tone="primary" numeric>
                    {formatCurrency(bill.net_amount)}
                  </Text>
                </View>
                <DetailRow label="Bags" value={formatNumber(bill.total_bags)} />
                <DetailRow label="Bill weight" value={`${formatNumber(bill.bill_weight)} kg`} />
                <DetailRow label="Rate" value={`${formatCurrency(bill.rate)}/kg`} />
                <DetailRow label="Before GST" value={formatCurrency(bill.amount_before_gst)} />
                <DetailRow
                  label="GST"
                  value={formatCurrency((bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0))}
                />
              </Card>
            </Animated.View>
          ))}

        {tab === 'created' && created.length === 0 && (
          <EmptyState icon="cube-outline" title="Nothing booked yet" description="Booked inward entries appear here once billed." />
        )}

        {tab === 'created' &&
          created.map((entry, index) => (
            <Animated.View key={entry._id} entering={index < 10 ? FadeInDown.delay(index * 20).duration(200) : undefined}>
              <RecordCard
                title={`Inward ${entry.entry_no}`}
                subtitle={`GRN ${entry.grn?.grn_id ?? refId(entry.grn_id)}`}
                icon="download-outline"
                fields={[
                  { label: 'Total bags', value: formatNumber(entry.total_bags), emphasis: true },
                  { label: 'Available', value: formatNumber(entry.available_bags) },
                  { label: 'Weight', value: entry.total_weight ? `${formatNumber(entry.total_weight)} kg` : null },
                  { label: 'Rate', value: entry.inward_rate ? `${formatCurrency(entry.inward_rate)}/kg` : null },
                ]}
              />
            </Animated.View>
          ))}
      </ScrollView>
    </Screen>
  );
}
