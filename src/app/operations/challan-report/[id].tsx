import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useInwardEntries, useInwardWeighBridgeEntries } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { RecordCard } from '@/components/record-card';
import { Badge } from '@/components/ui/badge';
import { Card, SectionHeader } from '@/components/ui/card';
import { EmptyState, ErrorState, Loading } from '@/components/ui/feedback';
import { DetailRow } from '@/components/ui/misc';
import { Body, Header, Screen } from '@/components/ui/screen';
import { Sheet, SheetBody } from '@/components/ui/sheet';
import { inwardTotals, type InwardBill } from '@/features/operations/inward';
import { useMasterLookups } from '@/features/operations/lookups';
import { formatCurrency, formatDate, formatNumber, refId } from '@/lib/format';
import { useTheme } from '@/theme';

const perKg = (amount: number, weight: number) => (weight ? `${formatCurrency(amount / weight)}/kg` : null);

/**
 * One inward challan: what came in on this entry, what it cost, and how the
 * weigh bridge compares with the bills — the web challan report, laid out as
 * cards instead of wide tables.
 */
export default function ChallanDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lookups = useMasterLookups();
  const inwards = useInwardEntries();
  const wbis = useInwardWeighBridgeEntries();
  const [billFor, setBillFor] = useState<InwardBill | null>(null);

  const entry = (inwards.data ?? []).find((row) => row._id === id);
  const totals = useMemo(() => (entry ? inwardTotals(entry) : null), [entry]);

  if (inwards.isLoading) {
    return (
      <Screen>
        <Header title="Challan" />
        <Loading label="Loading challan…" />
      </Screen>
    );
  }
  if (inwards.isError) {
    return (
      <Screen>
        <Header title="Challan" />
        <ErrorState message={getErrorMessage(inwards.error)} onRetry={() => void inwards.refetch()} />
      </Screen>
    );
  }
  if (!entry || !totals) {
    return (
      <Screen>
        <Header title="Challan" />
        <EmptyState icon="receipt-outline" title="Challan not found" description="Open it from the challan report list." />
      </Screen>
    );
  }

  const grn = entry.grn;
  const item = entry.grn_entry_item_data;
  const wbi = (wbis.data ?? []).find((row) => row.wbi_id === grn?.wbi_id || row._id === grn?.wbi_id);
  const config = lookups.raw.bagTypeConfigs.find((row) => row._id === refId(item?.bag_type_id));

  // Weigh bridge against the bills, across the whole GRN (as the web shows it).
  const badaKata = (wbi?.weight_fully_loaded || 0) - (wbi?.empty_weight || 0);
  const lessBardana = (grn?.entries ?? []).reduce((sum, line) => {
    const lineConfig = lookups.raw.bagTypeConfigs.find((row) => row._id === refId(line.bag_type_id));
    return sum + (line.bags_used || 0) * (lineConfig?.bag_weight || 0);
  }, 0);
  const kataNet = badaKata - lessBardana;
  const grnBillWeight = [
    ...new Map(
      (inwards.data ?? [])
        .filter((row) => refId(row.grn_id) === grn?._id || row.grn?._id === grn?._id)
        .flatMap((row) => (row.bill_entry_ids ?? []) as unknown as { _id: string; bill_weight?: number }[])
        .filter((bill) => bill?._id)
        .map((bill) => [bill._id, bill])
    ).values(),
  ].reduce((sum, bill) => sum + (bill.bill_weight || 0), 0);
  const difference = kataNet - grnBillWeight;

  return (
    <Screen edges={['top']}>
      <Header
        title={`Challan ${entry.entry_no}`}
        subtitle={[`GRN ${grn?.grn_id ?? '—'}`, wbi?.vehicle_no, lookups.sourceLocationName(wbi?.source_location_id)]
          .filter(Boolean)
          .join(' · ')}
      />

      <Body>
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            <Badge label={lookups.commodityName(refId(item?.commodity_id))} tone="primary" />
            <Badge label={lookups.gradeName(refId(item?.grade_id))} tone="info" />
            <Badge label={`${totals.count} bill${totals.count === 1 ? '' : 's'}`} />
          </View>
          <DetailRow label="Company" value={lookups.companyName(totals.companyId)} />
          <DetailRow label="Bag" value={`${lookups.bagConfigName(refId(item?.bag_type_id))}${config?.bag_weight ? ` · tare ${config.bag_weight} kg` : ''}`} />
          <DetailRow
            label="Location"
            value={`${lookups.locationName(refId(item?.location_id))} / ${lookups.subLocationName(refId(item?.location_id), item?.sub_location_id)}`}
          />
          <DetailRow label="Created" value={formatDate(entry.createdAt)} />
        </Card>

        <Card>
          <SectionHeader title="Totals" />
          <DetailRow label="Bags" value={formatNumber(totals.bags)} emphasis />
          <DetailRow label="Weight" value={`${formatNumber(totals.weight, 2)} kg`} />
          <DetailRow label="Average weight" value={totals.bags ? `${formatNumber(totals.weight / totals.bags, 2)} kg/bag` : null} />
          <DetailRow label="Amount (before expenses)" value={formatCurrency(totals.amount)} />
          <DetailRow label="  Average rate" value={perKg(totals.amount, totals.weight)} tone="muted" />
          <DetailRow label="Total cost (before GST)" value={formatCurrency(totals.beforeGst)} />
          <DetailRow label="  Average rate" value={perKg(totals.beforeGst, totals.weight)} tone="muted" />
          <DetailRow label="After GST" value={formatCurrency(totals.afterGst)} />
          <DetailRow label="Discount" value={formatCurrency(totals.discount)} />
          <DetailRow label="Net amount" value={formatCurrency(totals.net)} emphasis />
        </Card>

        <Card>
          <SectionHeader title="Weigh bridge check" caption="Whole GRN" />
          <DetailRow label="Bada kata (loaded − empty)" value={`${formatNumber(badaKata, 2)} kg`} />
          <DetailRow label="Less bardana" value={`${formatNumber(lessBardana, 2)} kg`} />
          <DetailRow label="Kata net" value={`${formatNumber(kataNet, 2)} kg`} emphasis />
          <DetailRow label="Bill weight (all GRN bills)" value={`${formatNumber(grnBillWeight, 2)} kg`} />
          <DetailRow
            label="Difference"
            value={`${formatNumber(difference, 2)} kg`}
            tone={Math.abs(difference) < 0.5 ? 'success' : 'warning'}
            emphasis
          />
        </Card>

        <SectionHeader title="Bills" caption="This entry's share of each bill" />
        {totals.bills.map((bill) => (
          <RecordCard
            key={String(bill._id)}
            title={`Bill ${bill.bill_no ?? '—'}`}
            subtitle={[lookups.vendorName(refId(bill.party_id)), formatDate(bill.bill_date as unknown as string), bill.eway_no && `E-way ${bill.eway_no}`]
              .filter(Boolean)
              .join(' · ')}
            fields={[
              { label: 'Bags', value: formatNumber(bill.total_bags), emphasis: true },
              { label: 'Weight', value: `${formatNumber(bill.bill_weight, 2)} kg` },
              { label: 'Amount', value: formatCurrency(bill.amount) },
              { label: 'Rate', value: perKg(Number(bill.amount || 0), Number(bill.bill_weight || 0)) },
              { label: 'Before GST', value: formatCurrency(bill.amount_before_gst) },
              { label: 'Net', value: formatCurrency(bill.net_amount) },
            ]}
            onPress={() => setBillFor(bill)}
          />
        ))}
      </Body>

      <Sheet
        open={billFor !== null}
        onClose={() => setBillFor(null)}
        title={billFor ? `Bill ${billFor.bill_no ?? ''}` : undefined}
        subtitle="The whole bill, as entered"
      >
        {billFor && (
          <SheetBody style={{ gap: 0 }}>
            {(() => {
              const bill = billFor.fullBill;
              return (
                <>
                  <DetailRow label="Company" value={lookups.companyName(refId(bill.company_id))} />
                  <DetailRow label="Party" value={lookups.vendorName(refId(bill.party_id))} />
                  <DetailRow label="Bill date" value={formatDate(bill.bill_date as unknown as string)} />
                  <DetailRow label="E-way no" value={bill.eway_no} />
                  <DetailRow label="Bags" value={formatNumber(bill.total_bags)} />
                  <DetailRow label="Weight" value={`${formatNumber(bill.bill_weight, 2)} kg`} />
                  <DetailRow label="Amount" value={formatCurrency(bill.amount)} />
                  <DetailRow label="Adhat" value={formatCurrency(bill.adhat_exp)} />
                  <DetailRow label="Dalali" value={formatCurrency(bill.dalali)} />
                  <DetailRow label="KKC" value={formatCurrency(bill.kkc)} />
                  <DetailRow label="Mandi tax" value={formatCurrency(bill.mandi_tax)} />
                  <DetailRow label="Labour" value={formatCurrency(bill.labour_exp)} />
                  <DetailRow label="Transport" value={formatCurrency(bill.transport_amount)} />
                  <DetailRow label="Other" value={formatCurrency((bill.other_exp1 || 0) + (bill.other_exp2 || 0) + (bill.other_exp3 || 0))} />
                  <DetailRow label="Before GST" value={formatCurrency(bill.amount_before_gst)} />
                  <DetailRow label="CGST" value={formatCurrency(bill.cgst)} />
                  <DetailRow label="SGST" value={formatCurrency(bill.sgst)} />
                  <DetailRow label="IGST" value={formatCurrency(bill.igst)} />
                  <DetailRow label="After GST" value={formatCurrency(bill.amount_after_gst)} />
                  <DetailRow label="Discount" value={formatCurrency(bill.discount)} />
                  <DetailRow label="Net amount" value={formatCurrency(bill.net_amount)} emphasis />
                  <DetailRow label="Baradana" value={bill.baradana_type_id} />
                  <DetailRow label="Freight" value={bill.freight_type_id} />
                  <DetailRow label="Remarks" value={bill.remarks} />
                </>
              );
            })()}
          </SheetBody>
        )}
      </Sheet>
    </Screen>
  );
}
