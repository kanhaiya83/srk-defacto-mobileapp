import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { useBagStockManualEntries, useBagStockSummary, type BagStockLedgerEntry } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Fab } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { DetailRow, Segmented, StatTile } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { Header, Screen } from '@/components/ui/screen';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatDate, formatNumber, refId } from '@/lib/format';
import { useTheme } from '@/theme';

type Tab = 'summary' | 'entries';
type Status = 'ALL' | 'FILLED' | 'EMPTY';

interface ConfigRef {
  _id?: string;
  bag_type_id?: unknown;
  bag_grade_id?: unknown;
  bag_size_kg?: number;
}

/**
 * Bag stock — filled and empty bags of each configuration, and the manual
 * corrections made to those counts.
 */
export default function BagStockScreen() {
  const theme = useTheme();
  const router = useRouter();
  const lookups = useMasterLookups();
  const summary = useBagStockSummary();
  const manual = useBagStockManualEntries();
  const { canCreate } = useModulePermissions('bag-stock');

  const [tab, setTab] = useState<Tab>('summary');
  const [bagType, setBagType] = useState('');
  const [bagGrade, setBagGrade] = useState('');
  const [size, setSize] = useState('');
  const [status, setStatus] = useState<Status>('ALL');

  const configOf = (row: { bag_type_config_id: unknown }) =>
    (row.bag_type_config_id && typeof row.bag_type_config_id === 'object' ? row.bag_type_config_id : null) as ConfigRef | null;

  const matches = (config: ConfigRef | null) => {
    if (!config) return false;
    if (bagType && refId(config.bag_type_id) !== bagType) return false;
    if (bagGrade && refId(config.bag_grade_id) !== bagGrade) return false;
    if (size && String(config.bag_size_kg) !== size) return false;
    return true;
  };

  const sizes = useMemo(() => {
    const all = new Set<number>();
    for (const row of [...(summary.data ?? []), ...(manual.data ?? [])]) {
      const kg = configOf(row)?.bag_size_kg;
      if (kg) all.add(kg);
    }
    return [...all].sort((a, b) => a - b).map((kg) => ({ value: String(kg), label: `${kg} kg` }));
  }, [summary.data, manual.data]);

  const rows = (summary.data ?? []).filter((row) => {
    if (!matches(configOf(row))) return false;
    if (status === 'FILLED' && row.filled_bags <= 0) return false;
    if (status === 'EMPTY' && row.empty_bags <= 0) return false;
    return true;
  });
  const entries = (manual.data ?? []).filter((row) => matches(configOf(row)) && (status === 'ALL' || row.status === status));

  const totals = rows.reduce(
    (acc, row) => ({ filled: acc.filled + (row.filled_bags || 0), empty: acc.empty + (row.empty_bags || 0) }),
    { filled: 0, empty: 0 }
  );
  const netAdjusted = entries.reduce((sum, row) => sum + (row.qty || 0), 0);

  const bagGradeOptions = lookups.raw.bagGrades
    .map((grade) => ({ value: grade._id, label: grade.title }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  const adjust = (row?: BagStockLedgerEntry) =>
    router.push((row ? `/operations/bag-stock/adjust?config=${refId(row.bag_type_config_id)}` : '/operations/bag-stock/adjust') as never);

  if (summary.isLoading) {
    return (
      <Screen>
        <Header title="Bag Stock" />
        <ListSkeleton rows={4} />
      </Screen>
    );
  }
  if (summary.isError) {
    return (
      <Screen>
        <Header title="Bag Stock" />
        <ErrorState message={getErrorMessage(summary.error)} onRetry={() => void summary.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Bag Stock" subtitle="Filled and empty bags on hand" />

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={summary.isRefetching || manual.isRefetching}
            onRefresh={() => {
              void summary.refetch();
              void manual.refetch();
            }}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <StatTile label="Filled" value={formatNumber(totals.filled)} icon="cube" tone="success" style={{ flex: 1, minWidth: 0 }} />
          <StatTile label="Empty" value={formatNumber(totals.empty)} icon="cube-outline" tone="neutral" style={{ flex: 1, minWidth: 0 }} />
          <StatTile label="Total" value={formatNumber(totals.filled + totals.empty)} icon="layers-outline" tone="info" style={{ flex: 1, minWidth: 0 }} />
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <Select value={bagType} options={lookups.bagTypeOptions} onChange={setBagType} title="Bag type" placeholder="Any type" clearable style={{ flex: 1 }} />
            <Select value={bagGrade} options={bagGradeOptions} onChange={setBagGrade} title="Bag grade" placeholder="Any grade" clearable style={{ flex: 1 }} />
          </View>
          <Select value={size} options={sizes} onChange={setSize} title="Bag size" placeholder="Any size" clearable />
          <Segmented<Status>
            value={status}
            onChange={setStatus}
            options={[
              { value: 'ALL', label: 'Filled and empty' },
              { value: 'FILLED', label: 'Filled' },
              { value: 'EMPTY', label: 'Empty' },
            ]}
          />
        </View>

        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'summary', label: 'By bag', count: rows.length },
            { value: 'entries', label: 'Adjustments', count: entries.length },
          ]}
        />

        {tab === 'summary' && rows.length === 0 && (
          <EmptyState icon="archive-outline" title="No bag stock" description="Bag counts build up as goods come in and go out." />
        )}
        {tab === 'summary' &&
          rows.map((row) => (
            <RecordCard
              key={row._id}
              title={lookups.bagConfigName(refId(row.bag_type_config_id))}
              icon="cube-outline"
              fields={[
                { label: 'Filled', value: formatNumber(row.filled_bags), emphasis: true },
                { label: 'Empty', value: formatNumber(row.empty_bags) },
                { label: 'Total', value: formatNumber((row.filled_bags || 0) + (row.empty_bags || 0)) },
              ]}
              onPress={canCreate ? () => adjust(row) : undefined}
            />
          ))}

        {tab === 'entries' && entries.length === 0 && (
          <EmptyState icon="create-outline" title="No adjustments" description="Record one when a physical count differs from the system." />
        )}
        {tab === 'entries' && entries.length > 0 && (
          <Card>
            <DetailRow
              label={`Net adjustment · ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`}
              value={`${netAdjusted > 0 ? '+' : netAdjusted < 0 ? '−' : ''}${formatNumber(Math.abs(netAdjusted))} bags`}
              tone={netAdjusted < 0 ? 'danger' : 'success'}
              emphasis
            />
          </Card>
        )}
        {tab === 'entries' &&
          entries.map((entry) => (
            <RecordCard
              key={entry._id}
              title={lookups.bagConfigName(refId(entry.bag_type_config_id))}
              subtitle={[formatDate(entry.date), entry.remarks].filter(Boolean).join(' · ')}
              badge={{ label: entry.status === 'FILLED' ? 'Filled' : 'Empty', tone: entry.status === 'FILLED' ? 'success' : 'neutral' }}
              fields={[{ label: entry.qty > 0 ? 'Added' : 'Removed', value: `${entry.qty > 0 ? '+' : '−'}${formatNumber(Math.abs(entry.qty))} bags`, emphasis: true }]}
            />
          ))}
      </ScrollView>

      {canCreate && <Fab icon="create-outline" label="Adjust" onPress={() => adjust()} />}
    </Screen>
  );
}
