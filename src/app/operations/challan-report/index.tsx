import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { useInwardEntries, useInwardWeighBridgeEntries, type InwardEntry } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Select } from '@/components/ui/select';
import { StatTile } from '@/components/ui/misc';
import { Header, Screen } from '@/components/ui/screen';
import { inwardTotals } from '@/features/operations/inward';
import { useMasterLookups } from '@/features/operations/lookups';
import { formatCurrency, formatDate, formatNumber, refId } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * Inward challan report — one row per inward entry, as on the web.
 *
 * Totals come from each entry's own share of its bills (a bill can be split
 * across entries), never from the whole bills. Tap an entry for its challan.
 */
export default function ChallanReportScreen() {
  const theme = useTheme();
  const router = useRouter();
  const lookups = useMasterLookups();
  const inwards = useInwardEntries();
  const wbis = useInwardWeighBridgeEntries();

  const [company, setCompany] = useState('');
  const [commodity, setCommodity] = useState('');
  const [location, setLocation] = useState('');

  const rows = useMemo(
    () =>
      (inwards.data ?? []).map((entry) => ({ entry, totals: inwardTotals(entry) })).filter(({ entry, totals }) => {
        const item = entry.grn_entry_item_data;
        if (company && totals.companyId !== company) return false;
        if (commodity && refId(item?.commodity_id) !== commodity) return false;
        if (location && refId(item?.location_id) !== location) return false;
        return true;
      }),
    [inwards.data, company, commodity, location]
  );

  const sums = rows.reduce(
    (acc, { totals }) => ({ bags: acc.bags + totals.bags, weight: acc.weight + totals.weight, amount: acc.amount + totals.amount }),
    { bags: 0, weight: 0, amount: 0 }
  );

  const vehicleFor = useCallback(
    (entry: InwardEntry) => (wbis.data ?? []).find((wbi) => wbi.wbi_id === entry.grn?.wbi_id)?.vehicle_no,
    [wbis.data]
  );

  type Row = (typeof rows)[number];
  const search = useCallback(
    ({ entry, totals }: Row) => {
      const item = entry.grn_entry_item_data;
      return [
        entry.entry_no,
        entry.grn?.grn_id,
        vehicleFor(entry),
        lookups.companyName(totals.companyId),
        lookups.commodityName(refId(item?.commodity_id)),
        lookups.gradeName(refId(item?.grade_id)),
        ...totals.bills.map((bill) => bill.bill_no),
      ];
    },
    [vehicleFor, lookups]
  );

  return (
    <Screen>
      <Header title="Challan Report" subtitle={`${rows.length} inward ${rows.length === 1 ? 'entry' : 'entries'}`} />

      <ListBody<Row>
        items={rows}
        isLoading={inwards.isLoading}
        isError={inwards.isError}
        errorMessage={inwards.error ? getErrorMessage(inwards.error) : undefined}
        onRefresh={() => void inwards.refetch()}
        refreshing={inwards.isRefetching}
        keyExtractor={({ entry }) => entry._id}
        searchFields={search}
        searchPlaceholder="Search inward, GRN, bill, company…"
        emptyTitle="No inward entries"
        emptyDescription="Entries appear here once a GRN's inward is created."
        header={
          <View style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <StatTile label="Bags" value={formatNumber(sums.bags)} icon="cube-outline" style={{ flex: 1 }} />
              <StatTile label="Weight" value={`${formatNumber(sums.weight / 1000, 2)} t`} icon="scale-outline" tone="info" style={{ flex: 1 }} />
            </View>
            <Select value={company} options={lookups.companyOptions} onChange={setCompany} title="Company" placeholder="Any company" clearable />
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Select value={commodity} options={lookups.commodityOptions} onChange={setCommodity} title="Commodity" placeholder="Any commodity" clearable style={{ flex: 1 }} />
              <Select value={location} options={lookups.locationOptions} onChange={setLocation} title="Location" placeholder="Any location" clearable style={{ flex: 1 }} />
            </View>
          </View>
        }
        renderItem={({ entry, totals }) => {
          const item = entry.grn_entry_item_data;
          return (
            <RecordCard
              title={`Inward ${entry.entry_no}`}
              subtitle={[
                lookups.companyName(totals.companyId),
                `GRN ${entry.grn?.grn_id ?? '—'}`,
                vehicleFor(entry),
                formatDate(entry.createdAt),
              ]
                .filter(Boolean)
                .join(' · ')}
              icon="receipt-outline"
              fields={[
                {
                  label: 'Commodity',
                  value: `${lookups.commodityName(refId(item?.commodity_id))} · ${lookups.gradeName(refId(item?.grade_id))}`,
                },
                { label: 'Bills', value: formatNumber(totals.count) },
                { label: 'Bags', value: formatNumber(totals.bags), emphasis: true },
                { label: 'Weight', value: `${formatNumber(totals.weight, 2)} kg` },
                { label: 'Amount', value: formatCurrency(totals.amount) },
                { label: 'Net', value: formatCurrency(totals.net) },
              ]}
              onPress={() => router.push(`/operations/challan-report/${entry._id}` as never)}
            />
          );
        }}
      />
    </Screen>
  );
}
