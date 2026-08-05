import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useOutwardBillEntries, useOutwards, type OutwardEntry } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { Header, Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { useMasterLookups } from '@/features/operations/lookups';
import { formatCurrency, formatDate, formatNumber, formatWeight, refId, refLabel } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * Outward challan report — what left the yard, with the bills raised against it.
 */
export default function OutwardChallanReportScreen() {
  const theme = useTheme();
  const lookups = useMasterLookups();
  const outwards = useOutwards();
  const bills = useOutwardBillEntries();

  const [vendor, setVendor] = useState('');
  const [group, setGroup] = useState('');
  const [selected, setSelected] = useState<OutwardEntry | null>(null);

  const rows = useMemo(
    () =>
      (outwards.data ?? []).filter((entry) => {
        if (vendor && refId(entry.vendor_id) !== vendor) return false;
        if (group && refId(entry.company_group_id) !== group) return false;
        return true;
      }),
    [outwards.data, vendor, group]
  );

  const totals = rows.reduce(
    (acc, entry) => ({ bags: acc.bags + (entry.total_bags ?? 0), weight: acc.weight + (entry.total_weight ?? 0) }),
    { bags: 0, weight: 0 }
  );

  const billsFor = (outwardId: string) => (bills.data ?? []).filter((bill) => bill.outward_id === outwardId);

  return (
    <Screen>
      <Header title="Outward Challan" subtitle={`${rows.length} dispatches`} />

      <ListBody<OutwardEntry>
        items={rows}
        isLoading={outwards.isLoading}
        isError={outwards.isError}
        errorMessage={outwards.error ? getErrorMessage(outwards.error) : undefined}
        onRefresh={() => void outwards.refetch()}
        refreshing={outwards.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={(item) => [item.outward_no, lookups.vendorName(refId(item.vendor_id))]}
        searchPlaceholder="Search outward or customer…"
        emptyTitle="No dispatches"
        emptyDescription="Dispatches appear here once stock leaves the yard."
        header={
          <View style={{ gap: theme.spacing.md }}>
            <Card>
              <SectionHeader title="Totals in view" />
              <DetailRow label="Bags dispatched" value={formatNumber(totals.bags)} emphasis />
              <DetailRow label="Weight dispatched" value={formatWeight(totals.weight)} />
            </Card>

            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Select
                value={vendor}
                options={lookups.vendorOptions}
                onChange={setVendor}
                title="Customer"
                placeholder="Any customer"
                clearable
                style={{ flex: 1 }}
              />
              <Select
                value={group}
                options={lookups.companyGroupOptions}
                onChange={setGroup}
                title="Company group"
                placeholder="Any group"
                clearable
                style={{ flex: 1 }}
              />
            </View>
          </View>
        }
        renderItem={(item) => (
          <RecordCard
            title={`Outward ${item.outward_no}`}
            subtitle={`${lookups.vendorName(refId(item.vendor_id))} · ${formatDate(item.date)}`}
            icon="receipt-outline"
            fields={[
              { label: 'Bags', value: formatNumber(item.total_bags), emphasis: true },
              { label: 'Weight', value: formatWeight(item.total_weight) },
              { label: 'Bills', value: billsFor(item._id).length },
              { label: 'Batches', value: item.dispatches?.length ?? 0 },
            ]}
            onPress={() => setSelected(item)}
          />
        )}
      />

      <Sheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `Outward ${selected.outward_no}` : ''}
        subtitle={selected ? lookups.vendorName(refId(selected.vendor_id)) : undefined}
      >
        {selected && (
          <View style={{ padding: theme.spacing.lg }}>
            <SectionHeader title="Dispatch" />
            <DetailRow label="Date" value={formatDate(selected.date)} />
            <DetailRow label="Company group" value={lookups.companyGroupName(refId(selected.company_group_id))} />
            <DetailRow label="Total bags" value={formatNumber(selected.total_bags)} emphasis />
            <DetailRow label="Total weight" value={formatWeight(selected.total_weight)} />
            <DetailRow
              label="Commodities"
              value={(selected.commodities ?? []).map((commodity) => commodity.commodity_name).join(', ')}
            />

            <View style={{ height: theme.spacing.lg }} />
            <SectionHeader title="Bills" caption={`${billsFor(selected._id).length} raised`} />
            {billsFor(selected._id).map((bill) => (
              <View key={bill._id} style={{ paddingVertical: theme.spacing.sm }}>
                <DetailRow label={`Bill ${bill.bill_no || bill.bill_number}`} value={formatCurrency(bill.net_amount)} emphasis />
                <DetailRow label="Party" value={refLabel(bill.party_id, 'vendor_name')} />
                <DetailRow label="Weight" value={formatWeight(bill.bill_weight)} />
              </View>
            ))}

            <View style={{ height: theme.spacing.lg }} />
            <Button label="Close" variant="outline" fullWidth onPress={() => setSelected(null)} />
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
