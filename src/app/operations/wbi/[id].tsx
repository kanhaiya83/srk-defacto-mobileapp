import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { useInwardWeighBridgeEntry } from '@/api/operations-api';
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
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { useTheme } from '@/theme';

export default function WbiDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lookups = useMasterLookups();
  const { data: entry, isLoading, isError, error, refetch } = useInwardWeighBridgeEntry(id);
  const { canUpdate } = useModulePermissions('wbi');

  if (isLoading) {
    return (
      <Screen>
        <Header title="Weigh bridge entry" />
        <Loading label="Loading entry…" />
      </Screen>
    );
  }

  if (isError || !entry) {
    return (
      <Screen>
        <Header title="Weigh bridge entry" />
        <ErrorState message={error ? getErrorMessage(error) : undefined} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const weighed = entry.empty_weight > 0;
  const canEdit = canUpdate && (entry.is_mutable || !weighed);

  return (
    <Screen edges={['top']}>
      <Header
        title={`WBI ${entry.wbi_id}`}
        subtitle={entry.vehicle_no || 'No vehicle recorded'}
        right={
          canEdit ? (
            <Button
              icon="create-outline"
              variant="outline"
              size="sm"
              accessibilityLabel="Edit entry"
              onPress={() => router.push(`/operations/wbi/form?mode=initial&id=${entry._id}`)}
            />
          ) : undefined
        }
      />

      <Body>
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            <Badge label={weighed ? 'Closed' : 'Awaiting empty weight'} tone={weighed ? 'success' : 'warning'} />
            {!entry.is_mutable && <Badge label="Used in GRN" tone="info" />}
          </View>

          <SectionHeader title="Weights" />
          <DetailRow label="Loaded" value={`${formatNumber(entry.weight_fully_loaded)} kg`} />
          <DetailRow label="Empty" value={weighed ? `${formatNumber(entry.empty_weight)} kg` : null} />
          <DetailRow label="Net" value={weighed ? `${formatNumber(entry.net_weight)} kg` : null} emphasis />
          <DetailRow label="Total bags" value={formatNumber(entry.total_bags)} />
        </Card>

        <Card>
          <SectionHeader title="Gate" />
          <DetailRow label="Date" value={formatDate(entry.date)} />
          <DetailRow label="Source location" value={lookups.sourceLocationName(entry.source_location_id)} />
          <DetailRow label="Weigh bridge" value={lookups.weighBridgeName(entry.weigh_bridge_id)} />
          <DetailRow label="Slip number" value={entry.slip_number} />
          <DetailRow
            label="Commodities"
            value={(entry.commodity_ids ?? []).map((cid) => lookups.commodityName(cid)).join(', ')}
          />
        </Card>

        <Card>
          <SectionHeader title="Vehicle" />
          <DetailRow label="Vehicle no" value={entry.vehicle_no} />
          <DetailRow label="Driver" value={entry.driver_name} />
          <DetailRow label="Mobile" value={entry.mobile_no} />
          <DetailRow label="License no" value={entry.drivers_license_no} />
          <DetailRow label="RC copy no" value={entry.rc_copy_no} />
        </Card>

        <Text variant="caption" tone="faint" style={{ textAlign: 'center' }}>
          Created {formatDateTime(entry.createdAt)} · Updated {formatDateTime(entry.updatedAt)}
        </Text>

        {!weighed && canUpdate && (
          <Button
            label="Record empty weight"
            icon="speedometer-outline"
            fullWidth
            size="lg"
            onPress={() => router.push('/operations/wbi-final')}
            style={{ marginBottom: theme.spacing.lg }}
          />
        )}
      </Body>
    </Screen>
  );
}
