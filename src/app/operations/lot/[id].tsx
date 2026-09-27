import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { useLot } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { RecordCard } from '@/components/record-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { ErrorState, Loading } from '@/components/ui/feedback';
import { Callout, DetailRow, StatTile } from '@/components/ui/misc';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { LotBalanceCard } from '@/features/operations/lot-balance';
import { lotBalance, outputWeight } from '@/features/operations/lot';
import { useMasterLookups } from '@/features/operations/lookups';
import { stockEntryTitle } from '@/features/operations/prelot';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatCurrency, formatDate, formatNumber, refId } from '@/lib/format';
import { useTheme } from '@/theme';

/** One lot: what went in, what came out, and whether the two agree. */
export default function LotDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lookups = useMasterLookups();
  const { canUpdate } = useModulePermissions('lot');
  const { data: lot, isLoading, isError, error, refetch } = useLot(id);

  if (isLoading) {
    return (
      <Screen>
        <Header title="Lot" />
        <Loading label="Loading lot…" />
      </Screen>
    );
  }
  if (isError || !lot) {
    return (
      <Screen>
        <Header title="Lot" />
        <ErrorState message={error ? getErrorMessage(error) : 'Lot not found'} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const balance = lotBalance(lot);
  const preLot = lot.prelot_id as unknown as { _id?: string; prelot_no?: number } | string;
  const preLotNo = typeof preLot === 'object' ? preLot?.prelot_no : undefined;

  return (
    <Screen edges={['top']}>
      <Header
        title={`Lot ${lot.lot_no}`}
        subtitle={[lookups.commodityName(refId(lot.commodity_id)), lookups.machineName(refId(lot.machine_id)), formatDate(lot.date)]
          .filter((part) => part && part !== '—')
          .join(' · ')}
      />

      <Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <Badge label={lot.is_complete ? 'Complete' : 'In progress'} tone={lot.is_complete ? 'success' : 'warning'} />
          {preLotNo !== undefined && <Badge label={`Pre-lot ${preLotNo}`} tone="info" />}
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <StatTile label="Input bags" value={formatNumber(balance.inputBags)} hint={`${formatNumber(balance.inputWeight, 2)} kg`} icon="enter-outline" tone="info" style={{ flex: 1 }} />
          <StatTile label="Output bags" value={formatNumber(balance.outputBags)} hint={`${formatNumber(balance.outputWeight, 2)} kg`} icon="exit-outline" style={{ flex: 1 }} />
        </View>

        <LotBalanceCard balance={balance} complete={lot.is_complete} />

        <SectionHeader title="Inputs" caption={`${lot.inputs?.length ?? 0}`} />
        {(lot.inputs ?? []).map((input, index) => {
          const stock = input.stock_ledger_id as { entry_no?: string; source_type?: string; rate_per_kg?: number } | string;
          const entry = typeof stock === 'object' ? stock : undefined;
          return (
            <RecordCard
              key={input._id ?? index}
              title={stockEntryTitle(entry?.entry_no, entry?.source_type)}
              subtitle={formatDate(input.date)}
              fields={[
                { label: 'Bags', value: formatNumber(input.bags_consumed), emphasis: true },
                { label: 'Weight', value: `${formatNumber(input.consumed_weight, 2)} kg` },
                { label: 'Rate', value: entry?.rate_per_kg ? `${formatCurrency(entry.rate_per_kg)}/kg` : null },
                { label: 'Value', value: entry?.rate_per_kg ? formatCurrency(entry.rate_per_kg * (input.consumed_weight || 0)) : null },
              ]}
            />
          );
        })}

        <SectionHeader title="Outputs" caption={lot.outputs?.length ? `${lot.outputs.length}` : 'None yet'} />
        {(lot.outputs ?? []).length === 0 && (
          <Text variant="caption" tone="muted">
            Nothing recorded yet. Open the output screen when the run is done.
          </Text>
        )}
        {(lot.outputs ?? []).map((output, index) => {
          const weight = outputWeight(output);
          return (
            <RecordCard
              key={output._id ?? index}
              title={lookups.gradeName(refId(output.grade_id))}
              subtitle={[
                lookups.bagConfigName(refId(output.bag_type_id)),
                `${lookups.locationName(refId(output.location_id))} / ${lookups.subLocationName(refId(output.location_id), output.sub_location_id)}`,
                formatDate(output.date),
              ].join(' · ')}
              fields={[
                { label: 'Bags', value: formatNumber(output.bags), emphasis: true },
                { label: 'Weight', value: `${formatNumber(weight, 2)} kg` },
                { label: 'Value', value: formatCurrency(output.total_amount) },
                { label: 'Rate', value: weight ? `${formatCurrency((output.total_amount || 0) / weight)}/kg` : null },
              ]}
            />
          );
        })}
        {balance.wasteBags > 0 && (
          <Card>
            <DetailRow label="Waste bags" value={formatNumber(balance.wasteBags)} />
          </Card>
        )}
        {!!lot.remarks && <Callout tone="info" icon="chatbox-ellipses-outline" title="Remarks" description={lot.remarks} />}
      </Body>

      {canUpdate && (
        <ActionBar>
          {!lot.is_complete && (
            <Button
              label="Edit inputs"
              icon="create-outline"
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => router.push(`/operations/lot/form?id=${lot._id}` as never)}
            />
          )}
          <Button
            label={lot.is_complete ? 'View output' : 'Output'}
            icon="exit-outline"
            style={{ flex: lot.is_complete ? 1 : 2 }}
            onPress={() => router.push(`/operations/lot-output/${lot._id}` as never)}
          />
        </ActionBar>
      )}
    </Screen>
  );
}
