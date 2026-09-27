import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useLots, type Lot } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import type { BadgeTone } from '@/components/ui/badge';
import { Header, Screen } from '@/components/ui/screen';
import { lotBalance } from '@/features/operations/lot';
import { useMasterLookups } from '@/features/operations/lookups';
import { formatCurrency, formatDate, formatNumber, refId } from '@/lib/format';

type Filter = 'open' | 'complete' | 'all';

/**
 * Lot output — pick a lot to record what its run produced. Each open lot says
 * what it still needs before it can be completed.
 */
export default function LotOutputListScreen() {
  const router = useRouter();
  const lookups = useMasterLookups();
  const list = useLots();
  const [filter, setFilter] = useState<Filter>('open');

  const rows = useMemo(() => (list.data ?? []).map((lot) => ({ lot, balance: lotBalance(lot) })), [list.data]);
  type Row = (typeof rows)[number];
  const openCount = rows.filter(({ lot }) => !lot.is_complete).length;
  const filtered = useMemo(
    () => (filter === 'all' ? rows : rows.filter(({ lot }) => (filter === 'complete' ? lot.is_complete : !lot.is_complete))),
    [rows, filter]
  );

  const search = useCallback(
    ({ lot }: Row) => [lot.lot_no, lookups.commodityName(refId(lot.commodity_id)), lookups.machineName(refId(lot.machine_id))],
    [lookups]
  );

  const status = (lot: Lot, blocker: string | null): { label: string; tone: BadgeTone } => {
    if (lot.is_complete) return { label: 'Complete', tone: 'success' };
    if (!lot.outputs?.length) return { label: 'No output', tone: 'warning' };
    if (blocker) return { label: 'Off balance', tone: 'danger' };
    return { label: 'Ready', tone: 'primary' };
  };

  return (
    <Screen>
      <Header title="Lot Output" subtitle={`${openCount} lot${openCount === 1 ? '' : 's'} to finish`} />

      <ListBody<Row, Filter>
        items={filtered}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={({ lot }) => lot._id}
        searchFields={search}
        searchPlaceholder="Search lot, commodity, machine…"
        filters={[
          { value: 'open', label: 'In progress', count: openCount },
          { value: 'complete', label: 'Complete', count: rows.length - openCount },
          { value: 'all', label: 'All', count: rows.length },
        ]}
        filterValue={filter}
        onFilterChange={setFilter}
        emptyTitle={filter === 'complete' ? 'No completed lots' : 'No lots in progress'}
        emptyDescription="Lots are created on the Lot Input screen."
        renderItem={({ lot, balance }) => (
          <RecordCard
            title={`Lot ${lot.lot_no}`}
            subtitle={[lookups.commodityName(refId(lot.commodity_id)), lookups.machineName(refId(lot.machine_id)), formatDate(lot.date)]
              .filter((part) => part && part !== '—')
              .join(' · ')}
            icon="exit-outline"
            badge={status(lot, balance.blocker)}
            fields={[
              { label: 'Output', value: `${formatNumber(balance.outputBags)} bags`, emphasis: true },
              { label: 'Input', value: `${formatNumber(balance.inputBags)} bags` },
              {
                label: 'Weight',
                value: `${formatNumber(balance.outputWeight, 2)} / ${formatNumber(balance.inputWeight, 2)} kg`,
              },
              { label: 'Value gap', value: lot.outputs?.length ? formatCurrency(balance.amountGap) : null },
            ]}
            onPress={() => router.push(`/operations/lot-output/${lot._id}` as never)}
          />
        )}
      />
    </Screen>
  );
}
