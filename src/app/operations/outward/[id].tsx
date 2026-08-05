import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useOutward, useOutwardBillEntries } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Card, SectionHeader } from '@/components/ui/card';
import { EmptyState, ErrorState, Loading } from '@/components/ui/feedback';
import { DetailRow, Segmented } from '@/components/ui/misc';
import { Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useMasterLookups } from '@/features/operations/lookups';
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatWeight, refId, refLabel } from '@/lib/format';
import { useTheme } from '@/theme';

type Tab = 'dispatch' | 'bills';

export default function OutwardDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const lookups = useMasterLookups();

  const { data: outward, isLoading, isError, error, refetch } = useOutward(id);
  const bills = useOutwardBillEntries(id);
  const [tab, setTab] = useState<Tab>(initialTab === 'bills' ? 'bills' : 'dispatch');

  if (isLoading) {
    return (
      <Screen>
        <Header title="Outward" />
        <Loading label="Loading dispatch…" />
      </Screen>
    );
  }

  if (isError || !outward) {
    return (
      <Screen>
        <Header title="Outward" />
        <ErrorState message={error ? getErrorMessage(error) : undefined} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <Header title={`Outward ${outward.outward_no}`} subtitle={lookups.vendorName(refId(outward.vendor_id))} />

      <Body>
        <Card>
          <DetailRow label="Date" value={formatDate(outward.date)} />
          <DetailRow label="Company group" value={lookups.companyGroupName(refId(outward.company_group_id))} />
          <DetailRow label="Total bags" value={formatNumber(outward.total_bags)} emphasis />
          <DetailRow label="Total weight" value={formatWeight(outward.total_weight)} />
          <DetailRow
            label="Commodities"
            value={(outward.commodities ?? []).map((commodity) => commodity.commodity_name).join(', ')}
          />
          {!!outward.remarks && <DetailRow label="Remarks" value={outward.remarks} />}
        </Card>

        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'dispatch', label: 'Dispatched stock', count: outward.dispatches?.length ?? 0 },
            { value: 'bills', label: 'Bills', count: bills.data?.length ?? 0 },
          ]}
        />

        {tab === 'dispatch' &&
          (outward.dispatches ?? []).map((dispatch, index) => (
            <Card key={dispatch._id ?? index}>
              <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{dispatch.entry_no ?? 'Batch'}</Text>
                  <Text variant="caption" tone="muted">
                    {dispatch.source_type?.replace('_', ' ') ?? 'Stock'}
                  </Text>
                </View>
                <Text variant="bodyStrong" tone="primary" numeric>
                  {formatNumber(dispatch.bags_dispatched)} bags
                </Text>
              </View>
              <DetailRow label="Weight" value={formatWeight(dispatch.dispatched_weight)} />
              <DetailRow label="Rate" value={dispatch.rate_per_kg ? `${formatCurrency(dispatch.rate_per_kg)}/kg` : null} />
              <DetailRow label="Company" value={refLabel(dispatch.company_id, 'company_name')} />
            </Card>
          ))}

        {tab === 'bills' && (bills.data ?? []).length === 0 && (
          <EmptyState
            icon="receipt-outline"
            title="No bills raised"
            description="Sales bills for this dispatch will appear here once they are created."
            compact
          />
        )}

        {tab === 'bills' &&
          (bills.data ?? []).map((bill) => (
            <Card key={bill._id}>
              <SectionHeader title={`Bill ${bill.bill_no || bill.bill_number}`} caption={formatDate(bill.bill_date)} />
              <DetailRow label="Company" value={refLabel(bill.company_id, 'company_name')} />
              <DetailRow label="Party" value={refLabel(bill.party_id, 'vendor_name')} />
              <DetailRow label="Bags" value={formatNumber(bill.total_bags)} />
              <DetailRow label="Bill weight" value={formatWeight(bill.bill_weight)} />
              <DetailRow label="Rate" value={`${formatCurrency(bill.rate)}/kg`} />
              <DetailRow label="Amount" value={formatCurrency(bill.amount)} />
              <DetailRow label="GST" value={formatCurrency((bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0))} />
              <DetailRow label="Net amount" value={formatCurrency(bill.net_amount)} emphasis />
            </Card>
          ))}

        <Text variant="caption" tone="faint" style={{ textAlign: 'center' }}>
          Created {formatDateTime(outward.createdAt)} · Updated {formatDateTime(outward.updatedAt)}
        </Text>
      </Body>
    </Screen>
  );
}
