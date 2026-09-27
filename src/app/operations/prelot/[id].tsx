import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { useLots, usePreLot } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { RecordCard } from '@/components/record-card';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { ErrorState, Loading } from '@/components/ui/feedback';
import { DetailRow, ProgressBar, StatTile } from '@/components/ui/misc';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useMasterLookups } from '@/features/operations/lookups';
import { lotsOf, preLotTotals } from '@/features/operations/prelot';
import { useModulePermissions, usePermissions } from '@/hooks/use-permissions';
import { formatCurrency, formatDate, formatNumber, refId } from '@/lib/format';
import { useTheme } from '@/theme';

/** One pre-lot: what it holds, per stock entry, and how much the lots have used. */
export default function PreLotDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lookups = useMasterLookups();
  const { can } = usePermissions();
  const { canUpdate } = useModulePermissions('prelot');
  const { data: preLot, isLoading, isError, error, refetch } = usePreLot(id);
  const lots = useLots();

  if (isLoading) {
    return (
      <Screen>
        <Header title="Pre-lot" />
        <Loading label="Loading pre-lot…" />
      </Screen>
    );
  }
  if (isError || !preLot) {
    return (
      <Screen>
        <Header title="Pre-lot" />
        <ErrorState message={error ? getErrorMessage(error) : 'Pre-lot not found'} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const totals = preLotTotals(preLot);
  const itsLots = lotsOf(preLot, lots.data ?? []);
  const usedShare = totals.bags ? totals.consumedBags / totals.bags : 0;
  const canCreateLot = can('lot:create') && totals.remainingBags > 0;

  return (
    <Screen edges={['top']}>
      <Header
        title={`Pre-lot ${preLot.prelot_no}`}
        subtitle={[
          lookups.commodityName(refId(preLot.commodity_id)),
          preLot.company_group?.group_name ?? lookups.companyGroupName(refId(preLot.company_group_id)),
          formatDate(preLot.date),
        ]
          .filter((part) => part && part !== '—')
          .join(' · ')}
      />

      <Body>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <StatTile label="Free for lots" value={formatNumber(totals.remainingBags)} hint={`${formatNumber(totals.remainingWeight, 2)} kg`} icon="cube-outline" style={{ flex: 1 }} />
          <StatTile label="Reserved" value={formatNumber(totals.bags)} hint={`${formatNumber(totals.weight, 2)} kg`} icon="albums-outline" tone="info" style={{ flex: 1 }} />
        </View>

        <Card>
          <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="label" tone="muted">
                Used by lots
              </Text>
              <Text variant="label" numeric>
                {formatNumber(totals.consumedBags)} of {formatNumber(totals.bags)} bags
              </Text>
            </View>
            <ProgressBar value={usedShare} tone={usedShare >= 1 ? 'success' : 'primary'} />
          </View>
          <DetailRow label="Average rate" value={totals.ratePerKg ? `${formatCurrency(totals.ratePerKg)}/kg` : null} emphasis />
          <DetailRow label="Stock value" value={formatCurrency(totals.weight * totals.ratePerKg)} />
          <DetailRow label="Used weight" value={`${formatNumber(totals.consumedWeight, 2)} kg`} />
          <DetailRow label="Remarks" value={preLot.remarks} />
        </Card>

        <SectionHeader title="Stock reserved" caption={`${totals.entries.length} entr${totals.entries.length === 1 ? 'y' : 'ies'}`} />
        {totals.entries.map((entry) => (
          <RecordCard
            key={entry.stockId}
            title={`${entry.sourceType === 'LOT_OUTPUT' ? 'Lot output' : 'Inward'} ${entry.entryNo}`}
            subtitle={entry.rows.map((row) => `${formatNumber(row.bags_allocated)} bags on ${formatDate(row.date)}`).join(' · ')}
            badge={entry.remainingBags <= 0 ? { label: 'Used up', tone: 'neutral' } : undefined}
            fields={[
              { label: 'Free for lots', value: `${formatNumber(entry.remainingBags)} bags`, emphasis: true },
              { label: 'Reserved', value: `${formatNumber(entry.bags)} bags` },
              { label: 'Weight', value: `${formatNumber(entry.weight, 2)} kg` },
              { label: 'Used by lots', value: `${formatNumber(entry.consumedBags)} bags` },
              { label: 'Rate', value: entry.ratePerKg ? `${formatCurrency(entry.ratePerKg)}/kg` : null },
            ]}
          />
        ))}

        <SectionHeader title="Lots" caption={itsLots.length ? `${itsLots.length}` : 'None yet'} />
        {itsLots.length === 0 && (
          <Text tone="muted" variant="caption">
            No lot has drawn on this pre-lot yet.
          </Text>
        )}
        {itsLots.map((lot) => (
          <RecordCard
            key={lot._id}
            title={`Lot ${lot.lot_no}`}
            subtitle={[formatDate(lot.date), lookups.machineName(refId(lot.machine_id))].filter((part) => part && part !== '—').join(' · ')}
            icon="cube-outline"
            badge={lot.is_complete ? { label: 'Complete', tone: 'success' } : { label: 'Open', tone: 'warning' }}
            fields={[
              { label: 'Input', value: `${formatNumber(lot.total_input_bags ?? lot.inputs.reduce((sum, input) => sum + (input.bags_consumed || 0), 0))} bags`, emphasis: true },
              { label: 'Output', value: `${formatNumber(lot.total_output_bags ?? 0)} bags` },
            ]}
            onPress={() => router.push(`/operations/lot/${lot._id}` as never)}
          />
        ))}
      </Body>

      {(canUpdate || can('lot:create')) && (
        <ActionBar>
          {canUpdate && (
            <Button
              label="Edit"
              icon="create-outline"
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => router.push(`/operations/prelot/form?id=${preLot._id}` as never)}
            />
          )}
          {can('lot:create') && (
            <Button
              label="Create lot"
              icon="cube-outline"
              style={{ flex: 2 }}
              disabled={!canCreateLot}
              onPress={() => router.push(`/operations/lot?prelot=${preLot._id}` as never)}
            />
          )}
        </ActionBar>
      )}
    </Screen>
  );
}
