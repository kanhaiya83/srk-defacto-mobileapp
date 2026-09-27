import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { useStockLedgerAll, useStockLedgerHistory, type StockLedgerEntry } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Badge } from '@/components/ui/badge';
import { Card, SectionHeader } from '@/components/ui/card';
import { EmptyState, ErrorState, Loading } from '@/components/ui/feedback';
import { Callout, DetailRow } from '@/components/ui/misc';
import { Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useMasterLookups } from '@/features/operations/lookups';
import { stockEntryTitle } from '@/features/operations/prelot';
import { availableValue, entryAgeDays, entryIssues, getStockBreakdown } from '@/features/operations/stock';
import { formatCurrency, formatDateTime, formatNumber, formatWeight, refId } from '@/lib/format';
import { useTheme } from '@/theme';

/** A movement into a bucket takes bags out of available stock; out of it, puts them back. */
const BUCKET_LABELS: Record<string, { taken: string; returned: string }> = {
  ALLOCATED: { taken: 'Pre-lot allocation', returned: 'Released from pre-lot' },
  CONSUMED: { taken: 'Used in a lot', returned: 'Returned from a lot' },
  OUTWARD_ALLOCATED: { taken: 'Pre-outward allocation', returned: 'Released from pre-outward' },
  OUTWARD: { taken: 'Dispatched', returned: 'Dispatch reversed' },
  TRANSFERRED: { taken: 'Transferred out', returned: 'Transfer reversed' },
};

const REFERENCE_LABELS: Record<string, string> = {
  PreLot: 'Pre-lot',
  Lot: 'Lot',
  PreOutward: 'Pre-outward',
  OutwardEntry: 'Outward',
  StockTransfer: 'Transfer',
  System: 'System',
};

/** Where the entry came from, from whatever the server populated. */
function sourceReference(entry: StockLedgerEntry): string | null {
  const pick = (value: unknown, ...fields: string[]) => {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    for (const field of fields) if (record[field] !== undefined && record[field] !== null) return String(record[field]);
    return null;
  };
  if (entry.source_type === 'INWARD') {
    const no = pick(entry.inward_id, 'entry_no', 'inward_no');
    return no ? `Inward ${no}` : null;
  }
  if (entry.source_type === 'LOT_OUTPUT') {
    const no = pick(entry.lot_id, 'lot_no');
    return no ? `Lot ${no}` : null;
  }
  if (entry.source_type === 'TRANSFER') {
    const no = pick(entry.transfer_from_id ?? entry.transfer_id, 'entry_no');
    return no ? `From ${no}` : 'Transfer';
  }
  return 'Opening stock';
}

/** One stock entry: where every bag of it is now, and how it got there. */
export default function StockEntryScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lookups = useMasterLookups();
  const ledger = useStockLedgerAll();
  const history = useStockLedgerHistory(id);

  const entry = (ledger.data ?? []).find((row) => row._id === id);

  if (ledger.isLoading) {
    return (
      <Screen>
        <Header title="Stock entry" />
        <Loading label="Loading stock…" />
      </Screen>
    );
  }
  if (ledger.isError) {
    return (
      <Screen>
        <Header title="Stock entry" />
        <ErrorState message={getErrorMessage(ledger.error)} onRetry={() => void ledger.refetch()} />
      </Screen>
    );
  }
  if (!entry) {
    return (
      <Screen>
        <Header title="Stock entry" />
        <EmptyState icon="cube-outline" title="Entry not found" description="Open it again from the inventory." />
      </Screen>
    );
  }

  const breakdown = getStockBreakdown(entry);
  const total = entry.original_bags || 1;
  const age = entryAgeDays(entry);
  const issues = entryIssues(entry);
  const locationId = refId(entry.location_id);
  const config = lookups.raw.bagTypeConfigs.find((row) => row._id === refId(entry.bag_type_id));

  const states = [
    { label: 'Available', bags: breakdown.available_bags, weight: breakdown.available_weight, color: theme.colors.success },
    { label: 'In pre-lots', bags: breakdown.prelot_bags, weight: breakdown.prelot_weight, color: theme.colors.warning },
    { label: 'Reserved for dispatch', bags: breakdown.preoutward_bags, weight: breakdown.preoutward_weight, color: theme.colors.info },
    { label: 'Used in lots', bags: breakdown.consumed_bags, weight: breakdown.consumed_weight, color: theme.colors.danger },
    { label: 'Dispatched', bags: breakdown.dispatched_bags, weight: breakdown.dispatched_weight, color: theme.colors.mutedText },
    { label: 'Transferred out', bags: breakdown.transferred_bags, weight: breakdown.transferred_weight, color: theme.colors.primary },
  ];

  return (
    <Screen edges={['top']}>
      <Header
        title={stockEntryTitle(entry.entry_no, entry.source_type)}
        subtitle={`${lookups.commodityName(refId(entry.commodity_id))} · ${lookups.gradeName(refId(entry.grade_id))}`}
      />

      <Body>
        {issues.length > 0 && <Callout tone="warning" title="Check this entry" description={issues.join(' · ')} />}

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: theme.spacing.md }}>
            <View style={{ gap: 2 }}>
              <Text variant="label" tone="muted">
                Available now
              </Text>
              <Text variant="title" tone="success" numeric>
                {formatNumber(breakdown.available_bags)} bags
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text variant="bodyStrong" numeric>
                {formatWeight(breakdown.available_weight)}
              </Text>
              <Text variant="caption" tone="muted" numeric>
                {formatCurrency(availableValue(entry))}
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              height: 10,
              borderRadius: 5,
              overflow: 'hidden',
              backgroundColor: theme.colors.surfaceAlt,
              marginVertical: theme.spacing.md,
            }}
          >
            {states
              .filter((state) => state.bags > 0)
              .map((state) => (
                <View key={state.label} style={{ width: `${(state.bags / total) * 100}%`, backgroundColor: state.color }} />
              ))}
          </View>

          {states.map((state) => (
            <View key={state.label} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: 5 }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: state.color }} />
              <Text variant="body" style={{ flex: 1 }}>
                {state.label}
              </Text>
              <Text variant="bodyStrong" numeric>
                {formatNumber(state.bags)}
              </Text>
              <Text variant="caption" tone="muted" numeric style={{ width: 92, textAlign: 'right' }}>
                {formatWeight(state.weight)}
              </Text>
            </View>
          ))}
        </Card>

        <Card>
          <SectionHeader title="Entry" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
            <Badge label={stockEntryTitle('', entry.source_type).trim()} tone="info" />
            {!!sourceReference(entry) && <Badge label={sourceReference(entry)!} />}
          </View>
          <DetailRow
            label={entry.source_type === 'INWARD' ? 'Company' : 'Company group'}
            value={
              entry.source_type === 'INWARD'
                ? (entry.company_id?.company_name ?? lookups.companyName(refId(entry.company_id)))
                : (entry.company_group_id?.group_name ?? lookups.companyGroupName(refId(entry.company_group_id)))
            }
          />
          <DetailRow label="Bag" value={`${lookups.bagConfigName(refId(entry.bag_type_id))}${config?.bag_weight ? ` · tare ${config.bag_weight} kg` : ''}`} />
          <DetailRow label="Location" value={`${lookups.locationName(locationId)} / ${lookups.subLocationName(locationId, entry.sub_location_id)}`} />
          <DetailRow label="Original" value={`${formatNumber(entry.original_bags)} bags · ${formatWeight(entry.original_weight)}`} />
          <DetailRow label="Weight per bag" value={entry.weight_per_bag ? `${formatNumber(entry.weight_per_bag, 2)} kg` : null} />
          <DetailRow label="Rate" value={entry.rate_per_kg ? `${formatCurrency(entry.rate_per_kg)}/kg` : null} />
          <DetailRow label="Original value" value={formatCurrency(entry.original_amount)} emphasis />
          <DetailRow label="Age" value={age === null ? null : `${age} day${age === 1 ? '' : 's'}`} />
        </Card>

        <SectionHeader title="Movements" caption="Available stock, newest first" />
        {history.isLoading && <Loading label="Loading movements…" />}
        {!history.isLoading && (history.data ?? []).length === 0 && (
          <Text variant="caption" tone="muted">
            Nothing has been drawn from this entry yet.
          </Text>
        )}
        {[...(history.data ?? [])].reverse().map((txn) => {
          const taken = txn.bags >= 0;
          const labels = BUCKET_LABELS[txn.bucket];
          return (
            <Card key={txn._id}>
              <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                <Ionicons
                  name={taken ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                  size={20}
                  color={taken ? theme.colors.warning : theme.colors.success}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}>
                    <Text variant="bodyStrong" style={{ flex: 1 }}>
                      {labels ? (taken ? labels.taken : labels.returned) : txn.bucket}
                    </Text>
                    <Text variant="bodyStrong" tone={taken ? 'warning' : 'success'} numeric>
                      {taken ? '−' : '+'}
                      {formatNumber(Math.abs(txn.bags))} bags
                    </Text>
                  </View>
                  <Text variant="caption" tone="muted" numeric>
                    {[
                      `${formatNumber(Math.abs(txn.weight), 2)} kg`,
                      REFERENCE_LABELS[txn.reference?.model] ?? txn.reference?.model,
                      formatDateTime(txn.date),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {!!txn.remarks && (
                    <Text variant="caption" tone="faint">
                      {txn.remarks}
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          );
        })}
      </Body>
    </Screen>
  );
}
