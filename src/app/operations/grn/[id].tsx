import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { useGenerateGrnEntry, useInwardWeighBridgeEntries } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { ErrorState, Loading } from '@/components/ui/feedback';
import { DetailRow } from '@/components/ui/misc';
import { Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { useTheme } from '@/theme';

export default function GrnDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lookups = useMasterLookups();
  const { data: grn, isLoading, isError, error, refetch } = useGenerateGrnEntry(id);
  const { data: wbis } = useInwardWeighBridgeEntries();
  const { canUpdate } = useModulePermissions('grn');

  if (isLoading) {
    return (
      <Screen>
        <Header title="GRN" />
        <Loading label="Loading GRN…" />
      </Screen>
    );
  }

  if (isError || !grn) {
    return (
      <Screen>
        <Header title="GRN" />
        <ErrorState message={error ? getErrorMessage(error) : undefined} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const wbi = (wbis ?? []).find((entry) => entry.wbi_id === grn.wbi_id);
  const bagsUsed = grn.entries?.reduce((sum, entry) => sum + (entry.bags_used || 0), 0) ?? 0;
  const short = (grn.total_bags || 0) - bagsUsed;

  const edit = () => {
    if (!grn.is_mutable) {
      toast.error('This GRN is used in an inward entry and cannot be edited');
      return;
    }
    router.push(`/operations/grn/form?id=${grn._id}`);
  };

  return (
    <Screen edges={['top']}>
      <Header
        title={`GRN ${grn.grn_id}`}
        subtitle={`WBI ${grn.wbi_id} · ${formatDate(grn.date)}`}
        right={
          canUpdate ? (
            <Button icon="create-outline" variant="outline" size="sm" accessibilityLabel="Edit GRN" onPress={edit} />
          ) : undefined
        }
      />

      <Body>
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            <Badge
              label={short > 0 ? `${formatNumber(short)} bags short` : 'Complete'}
              tone={short > 0 ? 'warning' : 'success'}
            />
            {!grn.is_mutable && <Badge label="Used in inward entry" tone="info" />}
          </View>

          <DetailRow label="Total bags on WBI" value={formatNumber(grn.total_bags)} />
          <DetailRow label="Bags booked" value={formatNumber(bagsUsed)} emphasis />
          <DetailRow label="Unaccounted" value={formatNumber(short)} tone={short > 0 ? 'warning' : 'success'} />
          <DetailRow label="Vehicle" value={wbi?.vehicle_no} />
          <DetailRow label="Source" value={lookups.sourceLocationName(wbi?.source_location_id)} />
          <DetailRow label="Net weight" value={wbi ? `${formatNumber(wbi.net_weight)} kg` : null} />
        </Card>

        <SectionHeader title="Line items" caption={`${grn.entries?.length ?? 0} entries`} />

        {(grn.entries ?? []).map((entry, index) => (
          <Card key={entry._id || index}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">
                  {lookups.commodityName(entry.commodity_id)} · {lookups.gradeName(entry.grade_id)}
                </Text>
                <Text variant="caption" tone="muted">
                  {lookups.bagConfigName(entry.bag_type_id)}
                </Text>
              </View>
              <Text variant="title" tone="primary" numeric>
                {formatNumber(entry.bags_used)}
              </Text>
            </View>

            <DetailRow label="Location" value={lookups.locationName(entry.location_id)} />
            <DetailRow label="Sub-location" value={lookups.subLocationName(entry.location_id, entry.sub_location_id)} />
            <DetailRow label="Sample">
              <Badge
                label={entry.sample_collected ? 'Collected' : 'Not collected'}
                tone={entry.sample_collected ? 'success' : 'warning'}
              />
            </DetailRow>
            {!entry.sample_collected && !!entry.sample_not_collected_reason && (
              <DetailRow label="Reason" value={entry.sample_not_collected_reason} />
            )}
            {!!entry.remarks && <DetailRow label="Remarks" value={entry.remarks} />}
          </Card>
        ))}

        <Text variant="caption" tone="faint" style={{ textAlign: 'center' }}>
          Created {formatDateTime(grn.createdAt)} · Updated {formatDateTime(grn.updatedAt)}
        </Text>
      </Body>
    </Screen>
  );
}
