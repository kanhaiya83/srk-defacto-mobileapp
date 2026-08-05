import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { useSaleOrder } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { ErrorState, Loading } from '@/components/ui/feedback';
import { DetailRow } from '@/components/ui/misc';
import { Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatCurrency, formatDate, formatDateTime, formatNumber, refId } from '@/lib/format';
import { useTheme } from '@/theme';

export default function SaleOrderDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lookups = useMasterLookups();
  const { data: order, isLoading, isError, error, refetch } = useSaleOrder(id);
  const { canUpdate } = useModulePermissions('saleorder');

  if (isLoading) {
    return (
      <Screen>
        <Header title="Sale order" />
        <Loading label="Loading order…" />
      </Screen>
    );
  }

  if (isError || !order) {
    return (
      <Screen>
        <Header title="Sale order" />
        <ErrorState message={error ? getErrorMessage(error) : undefined} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const totals = (order.orders ?? []).reduce(
    (acc, line) => ({
      bags: acc.bags + (line.bags || 0),
      weight: acc.weight + (line.total_weight || 0),
      value: acc.value + (line.total_weight || 0) * (line.rate || 0),
    }),
    { bags: 0, weight: 0, value: 0 }
  );

  return (
    <Screen edges={['top']}>
      <Header
        title={`Order ${order.order_no}`}
        subtitle={lookups.vendorName(refId(order.vendor_id))}
        right={
          canUpdate ? (
            <Button
              icon="create-outline"
              variant="outline"
              size="sm"
              accessibilityLabel="Edit order"
              onPress={() => router.push(`/operations/saleorder/form?id=${order._id}`)}
            />
          ) : undefined
        }
      />

      <Body>
        <Card>
          <View style={{ marginBottom: theme.spacing.md }}>
            <Badge label={order.is_completed ? 'Completed' : 'Open'} tone={order.is_completed ? 'success' : 'warning'} />
          </View>
          <DetailRow label="Order date" value={formatDate(order.date)} />
          <DetailRow label="Deliver by" value={order.delivery_by_date ? formatDate(order.delivery_by_date) : null} />
          <DetailRow label="Total bags" value={formatNumber(totals.bags)} />
          <DetailRow label="Total weight" value={`${formatNumber(totals.weight)} kg`} />
          <DetailRow label="Order value" value={formatCurrency(totals.value)} emphasis />
        </Card>

        <SectionHeader title="Order lines" caption={`${order.orders?.length ?? 0} lines`} />

        {(order.orders ?? []).map((line, index) => (
          <Card key={line._id ?? index}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">
                  {lookups.commodityName(refId(line.commodity_id))} · {lookups.gradeName(refId(line.grade_id))}
                </Text>
                <Text variant="caption" tone="muted">
                  {formatNumber(line.bags)} bags
                </Text>
              </View>
              <Text variant="bodyStrong" tone="primary" numeric>
                {formatCurrency((line.total_weight || 0) * (line.rate || 0))}
              </Text>
            </View>
            <DetailRow label="Weight" value={`${formatNumber(line.total_weight)} kg`} />
            <DetailRow label="Rate" value={`${formatCurrency(line.rate)}/kg`} />
          </Card>
        ))}

        <Text variant="caption" tone="faint" style={{ textAlign: 'center' }}>
          Created {formatDateTime(order.createdAt)} · Updated {formatDateTime(order.updatedAt)}
        </Text>
      </Body>
    </Screen>
  );
}
