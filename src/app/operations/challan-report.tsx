import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useInwardEntries, useInwardWeighBridgeEntries, type InwardEntry } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { Header, Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { useMasterLookups } from '@/features/operations/lookups';
import { formatCurrency, formatDate, formatNumber, formatWeight, refId } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * Inward challan report.
 *
 * A read-only ledger of what was received: each inward entry with the GRN line
 * and vehicle behind it. Filters are commodity and location, because those are
 * what a stock query in the yard actually starts from.
 */
export default function ChallanReportScreen() {
  const theme = useTheme();
  const lookups = useMasterLookups();
  const inwards = useInwardEntries();
  const wbis = useInwardWeighBridgeEntries();

  const [commodity, setCommodity] = useState('');
  const [location, setLocation] = useState('');
  const [selected, setSelected] = useState<InwardEntry | null>(null);

  const rows = useMemo(() => {
    return (inwards.data ?? []).filter((entry) => {
      const item = entry.grn_entry_item_data;
      if (commodity && refId(item?.commodity_id) !== commodity) return false;
      if (location && refId(item?.location_id) !== location) return false;
      return true;
    });
  }, [inwards.data, commodity, location]);

  const totals = rows.reduce(
    (acc, entry) => ({
      bags: acc.bags + (entry.total_bags ?? 0),
      weight: acc.weight + (entry.total_weight ?? 0),
    }),
    { bags: 0, weight: 0 }
  );

  const wbiFor = (entry: InwardEntry) =>
    (wbis.data ?? []).find((wbi) => wbi.wbi_id === entry.grn?.wbi_id);

  return (
    <Screen>
      <Header title="Challan Report" subtitle={`${rows.length} inward entries`} />

      <ListBody<InwardEntry>
        items={rows}
        isLoading={inwards.isLoading}
        isError={inwards.isError}
        errorMessage={inwards.error ? getErrorMessage(inwards.error) : undefined}
        onRefresh={() => void inwards.refetch()}
        refreshing={inwards.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={(item) => [
          item.entry_no,
          item.grn?.grn_id,
          lookups.commodityName(refId(item.grn_entry_item_data?.commodity_id)),
        ]}
        searchPlaceholder="Search entry or GRN…"
        emptyTitle="No inward entries"
        emptyDescription="Entries appear here once goods are billed and booked."
        header={
          <View style={{ gap: theme.spacing.md }}>
            <Card>
              <SectionHeader title="Totals in view" />
              <DetailRow label="Bags received" value={formatNumber(totals.bags)} emphasis />
              <DetailRow label="Weight received" value={formatWeight(totals.weight)} />
            </Card>

            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Select
                value={commodity}
                options={lookups.commodityOptions}
                onChange={setCommodity}
                title="Commodity"
                placeholder="Any commodity"
                clearable
                style={{ flex: 1 }}
              />
              <Select
                value={location}
                options={lookups.locationOptions}
                onChange={setLocation}
                title="Location"
                placeholder="Any location"
                clearable
                style={{ flex: 1 }}
              />
            </View>
          </View>
        }
        renderItem={(item) => {
          const detail = item.grn_entry_item_data;
          return (
            <RecordCard
              title={`Inward ${item.entry_no}`}
              subtitle={
                detail
                  ? `${lookups.commodityName(refId(detail.commodity_id))} · ${lookups.gradeName(refId(detail.grade_id))}`
                  : `GRN ${item.grn?.grn_id ?? ''}`
              }
              icon="receipt-outline"
              fields={[
                { label: 'Bags', value: formatNumber(item.total_bags), emphasis: true },
                { label: 'Available', value: formatNumber(item.available_bags) },
                { label: 'Weight', value: item.total_weight ? `${formatNumber(item.total_weight)} kg` : null },
                { label: 'Rate', value: item.inward_rate ? `${formatCurrency(item.inward_rate)}/kg` : null },
              ]}
              onPress={() => setSelected(item)}
            />
          );
        }}
      />

      <Sheet open={selected !== null} onClose={() => setSelected(null)} title={selected ? `Inward ${selected.entry_no}` : ''}>
        {selected && (
          <View style={{ padding: theme.spacing.lg }}>
            {(() => {
              const detail = selected.grn_entry_item_data;
              const wbi = wbiFor(selected);
              return (
                <>
                  <SectionHeader title="Goods" />
                  <DetailRow label="Commodity" value={lookups.commodityName(refId(detail?.commodity_id))} />
                  <DetailRow label="Grade" value={lookups.gradeName(refId(detail?.grade_id))} />
                  <DetailRow label="Bag" value={lookups.bagConfigName(refId(detail?.bag_type_id))} />
                  <DetailRow label="Location" value={lookups.locationName(refId(detail?.location_id))} />
                  <DetailRow
                    label="Sub-location"
                    value={lookups.subLocationName(refId(detail?.location_id), detail?.sub_location_id)}
                  />

                  <View style={{ height: theme.spacing.lg }} />
                  <SectionHeader title="Quantities" />
                  <DetailRow label="Total bags" value={formatNumber(selected.total_bags)} />
                  <DetailRow label="Allocated" value={formatNumber(selected.allocated_bags)} />
                  <DetailRow label="Available" value={formatNumber(selected.available_bags)} emphasis />
                  <DetailRow label="Total weight" value={formatWeight(selected.total_weight)} />
                  <DetailRow label="Inward rate" value={selected.inward_rate ? `${formatCurrency(selected.inward_rate)}/kg` : null} />

                  <View style={{ height: theme.spacing.lg }} />
                  <SectionHeader title="Origin" />
                  <DetailRow label="GRN" value={selected.grn?.grn_id} />
                  <DetailRow label="GRN date" value={selected.grn?.date ? formatDate(selected.grn.date) : null} />
                  <DetailRow label="WBI" value={wbi?.wbi_id} />
                  <DetailRow label="Vehicle" value={wbi?.vehicle_no} />
                  <DetailRow label="Driver" value={wbi?.driver_name} />
                  <DetailRow label="Source" value={lookups.sourceLocationName(wbi?.source_location_id)} />

                  <View style={{ height: theme.spacing.lg }} />
                  <Button label="Close" variant="outline" fullWidth onPress={() => setSelected(null)} />
                </>
              );
            })()}
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
