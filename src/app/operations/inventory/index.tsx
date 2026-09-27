import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useStockLedgerAll } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { RecordCard } from '@/components/record-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { Callout, SearchBar, Segmented, StatTile } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { Header, Screen } from '@/components/ui/screen';
import { Sheet, SheetBody } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { useMasterLookups } from '@/features/operations/lookups';
import { stockEntryTitle } from '@/features/operations/prelot';
import {
  activeFilterCount,
  applyStockFilters,
  availableValue,
  computeTotals,
  defaultStockFilters,
  entryIssues,
  getStockBreakdown,
  groupStock,
  type AgeFilter,
  type SourceFilter,
  type StatusFilter,
  type StockFilterState,
} from '@/features/operations/stock';
import { formatCurrency, formatNumber, formatWeight, refId } from '@/lib/format';
import { useTheme } from '@/theme';

type InventoryView = 'grouped' | 'batches' | 'locations';

const BATCH_LIMIT = 200;

/**
 * Inventory — the stock ledger, read three ways: by commodity and grade (what
 * do we have?), entry by entry, and by location (where is it?). Filters apply
 * to all three, and a group opens onto its entries.
 */
export default function InventoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const lookups = useMasterLookups();
  const ledger = useStockLedgerAll();

  const [view, setView] = useState<InventoryView>('grouped');
  const [filters, setFilters] = useState<StockFilterState>(defaultStockFilters);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const setFilter = <K extends keyof StockFilterState>(key: K, value: StockFilterState[K], patch: Partial<StockFilterState> = {}) =>
    setFilters((current) => ({ ...current, [key]: value, ...patch }));

  const entries = useMemo(() => ledger.data ?? [], [ledger.data]);
  const issueCount = useMemo(() => entries.filter((entry) => entryIssues(entry).length > 0).length, [entries]);
  const filtered = useMemo(() => applyStockFilters(entries, filters), [entries, filters]);

  const holderName = useMemo(
    () => (entry: (typeof entries)[number]) =>
      entry.source_type === 'INWARD'
        ? (entry.company_id?.company_name ?? lookups.companyName(refId(entry.company_id)))
        : (entry.company_group_id?.group_name ?? lookups.companyGroupName(refId(entry.company_group_id))),
    [lookups]
  );

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((entry) =>
      [
        entry.entry_no,
        lookups.commodityName(refId(entry.commodity_id)),
        lookups.gradeName(refId(entry.grade_id)),
        lookups.locationName(refId(entry.location_id)),
        lookups.subLocationName(refId(entry.location_id), entry.sub_location_id),
        lookups.bagConfigName(refId(entry.bag_type_id)),
        holderName(entry),
      ].some((value) => value && String(value).toLowerCase().includes(q))
    );
  }, [filtered, query, lookups, holderName]);

  const totals = useMemo(() => computeTotals(searched), [searched]);

  const gradeGroups = useMemo(
    () =>
      groupStock(searched, (entry) => {
        const commodityId = refId(entry.commodity_id);
        const gradeId = refId(entry.grade_id);
        const bagTypeId = refId(entry.bag_type_id);
        return {
          key: `${commodityId}|${gradeId}|${bagTypeId}`,
          label: `${lookups.commodityName(commodityId)} · ${lookups.gradeName(gradeId)}`,
          sublabel: lookups.bagConfigName(bagTypeId),
        };
      }),
    [searched, lookups]
  );

  const locationGroups = useMemo(
    () =>
      groupStock(searched, (entry) => {
        const locationId = refId(entry.location_id);
        return {
          key: `${locationId}|${entry.sub_location_id}`,
          label: lookups.locationName(locationId),
          sublabel: lookups.subLocationName(locationId, entry.sub_location_id),
        };
      }),
    [searched, lookups]
  );

  const filterCount = activeFilterCount(filters);
  const showStatus = (status: StatusFilter) => {
    setFilter('status', filters.status === status ? 'AVAILABLE' : status);
    setView('batches');
  };

  if (ledger.isLoading) {
    return (
      <Screen>
        <Header title="Inventory" />
        <ListSkeleton />
      </Screen>
    );
  }
  if (ledger.isError) {
    return (
      <Screen>
        <Header title="Inventory" />
        <ErrorState message={getErrorMessage(ledger.error)} onRetry={() => void ledger.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Inventory" subtitle={`${formatNumber(searched.length)} of ${formatNumber(entries.length)} entries`} />

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={ledger.isRefetching} onRefresh={() => void ledger.refetch()} tintColor={theme.colors.primary} />
        }
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          <StatTile
            label="Available"
            value={formatNumber(totals.available_bags)}
            hint={`${formatWeight(totals.available_weight)} · ${formatCurrency(totals.available_value)}`}
            icon="cube-outline"
            tone="success"
            onPress={() => showStatus('AVAILABLE')}
            style={{ flexBasis: '100%' }}
          />
          <StatTile label="In pre-lots" value={formatNumber(totals.prelot_bags)} hint={formatWeight(totals.prelot_weight)} icon="albums-outline" tone="warning" onPress={() => showStatus('PRELOT')} style={{ flex: 1, minWidth: 140 }} />
          <StatTile label="For dispatch" value={formatNumber(totals.preoutward_bags)} hint={formatWeight(totals.preoutward_weight)} icon="file-tray-full-outline" tone="warning" onPress={() => showStatus('PREOUTWARD')} style={{ flex: 1, minWidth: 140 }} />
          <StatTile label="Consumed" value={formatNumber(totals.consumed_bags)} hint={formatWeight(totals.consumed_weight)} icon="cog-outline" tone="neutral" onPress={() => showStatus('CONSUMED')} style={{ flex: 1, minWidth: 140 }} />
          <StatTile label="Dispatched" value={formatNumber(totals.dispatched_bags)} hint={formatWeight(totals.dispatched_weight)} icon="cloud-upload-outline" tone="info" onPress={() => showStatus('DISPATCHED')} style={{ flex: 1, minWidth: 140 }} />
        </View>

        {issueCount > 0 && (
          <Pressable accessibilityRole="button" onPress={() => { setFilter('issues', !filters.issues); setView('batches'); }}>
            <Callout
              tone="warning"
              icon="construct-outline"
              title={`${issueCount} entr${issueCount === 1 ? 'y needs' : 'ies need'} attention`}
              description={filters.issues ? 'Showing only these. Tap to show everything.' : 'Missing rate or sub-location, or more used than held. Tap to see them.'}
            />
          </Pressable>
        )}

        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search entry, grade, company, location…"
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Filters"
              onPress={() => setFiltersOpen(true)}
              style={({ pressed }) => ({
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: filterCount > 0 ? theme.colors.primary : theme.colors.border,
                backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
              })}
            >
              <Ionicons name="options-outline" size={19} color={filterCount > 0 ? theme.colors.primary : theme.colors.mutedText} />
            </Pressable>
          }
        />

        {filterCount > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text variant="caption" tone="muted" style={{ flex: 1 }}>
              {filterCount} filter{filterCount === 1 ? '' : 's'} applied
              {filters.status !== 'AVAILABLE' ? ` · ${STATUS_LABELS[filters.status]}` : ''}
            </Text>
            <Button label="Reset" size="sm" variant="ghost" onPress={() => setFilters(defaultStockFilters)} />
          </View>
        )}

        <Segmented<InventoryView>
          value={view}
          onChange={setView}
          options={[
            { value: 'grouped', label: 'By grade', count: gradeGroups.length },
            { value: 'batches', label: 'Entries', count: searched.length },
            { value: 'locations', label: 'Locations', count: locationGroups.length },
          ]}
        />

        {searched.length === 0 && (
          <EmptyState
            icon="cube-outline"
            title="No stock matches"
            description={filterCount > 0 ? 'Try clearing a filter.' : 'Stock appears here once inward entries are created.'}
          />
        )}

        {view === 'grouped' &&
          gradeGroups.map((group) => (
            <Card
              key={group.key}
              onPress={() => {
                const [commodity, grade, bagType] = group.key.split('|');
                setFilters((current) => ({ ...current, commodity, grade, bagType }));
                setView('batches');
              }}
            >
              <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{group.label}</Text>
                  <Text variant="caption" tone="muted">
                    {group.sublabel} · {group.entries.length} entr{group.entries.length === 1 ? 'y' : 'ies'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 1 }}>
                  <Text variant="title" tone="primary" numeric>
                    {formatNumber(group.bags)}
                  </Text>
                  <Text variant="micro" tone="faint">
                    BAGS
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.sm }}>
                <Text variant="caption" tone="muted" numeric>
                  {formatWeight(group.weight)}
                </Text>
                <Text variant="caption" tone="muted" numeric>
                  {formatCurrency(group.value)}
                </Text>
              </View>
            </Card>
          ))}

        {view === 'locations' &&
          locationGroups.map((group) => (
            <Card
              key={group.key}
              onPress={() => {
                const [location, subLocation] = group.key.split('|');
                setFilters((current) => ({ ...current, location, subLocation }));
                setView('batches');
              }}
            >
              <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: theme.radius.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.infoSoft,
                  }}
                >
                  <Ionicons name="location-outline" size={18} color={theme.colors.info} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{group.label}</Text>
                  <Text variant="caption" tone="muted">
                    {group.sublabel} · {group.entries.length} entr{group.entries.length === 1 ? 'y' : 'ies'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 1 }}>
                  <Text variant="bodyStrong" numeric>
                    {formatNumber(group.bags)} bags
                  </Text>
                  <Text variant="caption" tone="muted" numeric>
                    {formatWeight(group.weight)}
                  </Text>
                </View>
              </View>
            </Card>
          ))}

        {view === 'batches' &&
          searched.slice(0, BATCH_LIMIT).map((entry) => {
            const breakdown = getStockBreakdown(entry);
            const issues = entryIssues(entry);
            return (
              <RecordCard
                key={entry._id}
                title={stockEntryTitle(entry.entry_no, entry.source_type)}
                subtitle={[
                  lookups.commodityName(refId(entry.commodity_id)),
                  lookups.gradeName(refId(entry.grade_id)),
                  lookups.bagConfigName(refId(entry.bag_type_id)),
                  holderName(entry),
                ]
                  .filter((part) => part && part !== '—')
                  .join(' · ')}
                badge={issues.length ? { label: issues[0], tone: 'warning' } : breakdown.available_bags <= 0 ? { label: 'Used up', tone: 'neutral' } : undefined}
                fields={[
                  { label: 'Available', value: `${formatNumber(breakdown.available_bags)} of ${formatNumber(entry.original_bags)} bags`, emphasis: true },
                  { label: 'Weight', value: formatWeight(breakdown.available_weight) },
                  {
                    label: 'Location',
                    value: `${lookups.locationName(refId(entry.location_id))} / ${lookups.subLocationName(refId(entry.location_id), entry.sub_location_id)}`,
                  },
                  { label: 'Value', value: formatCurrency(availableValue(entry)) },
                ]}
                onPress={() => router.push(`/operations/inventory/${entry._id}` as never)}
              />
            );
          })}

        {view === 'batches' && searched.length > BATCH_LIMIT && (
          <Text variant="caption" tone="faint" style={{ textAlign: 'center' }}>
            Showing the first {BATCH_LIMIT} entries. Search or filter to find the rest.
          </Text>
        )}
      </ScrollView>

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter stock"
        footer={
          <>
            <Button label="Reset" variant="outline" style={{ flex: 1 }} onPress={() => setFilters(defaultStockFilters)} />
            <Button label="Show stock" style={{ flex: 2 }} onPress={() => setFiltersOpen(false)} />
          </>
        }
      >
        <SheetBody>
          <FilterLabel>Status</FilterLabel>
          <Segmented<StatusFilter>
            value={filters.status}
            onChange={(status) => setFilter('status', status)}
            options={(Object.keys(STATUS_LABELS) as StatusFilter[]).map((value) => ({ value, label: STATUS_LABELS[value] }))}
          />
          <FilterLabel>Source</FilterLabel>
          <Segmented<SourceFilter>
            value={filters.source}
            onChange={(source) => setFilter('source', source)}
            options={[
              { value: 'ALL', label: 'Any' },
              { value: 'INWARD', label: 'Inward' },
              { value: 'LOT_OUTPUT', label: 'Lot output' },
              { value: 'TRANSFER', label: 'Transfer' },
              { value: 'INITIAL_STOCK', label: 'Opening' },
            ]}
          />
          <FilterLabel>Age</FilterLabel>
          <Segmented<AgeFilter>
            value={filters.age}
            onChange={(age) => setFilter('age', age)}
            options={[
              { value: 'ALL', label: 'Any' },
              { value: '0-30', label: '0–30 d' },
              { value: '31-60', label: '31–60 d' },
              { value: '61-90', label: '61–90 d' },
              { value: '90+', label: '90+ d' },
            ]}
          />
          <Select value={filters.commodity} options={lookups.commodityOptions} onChange={(commodity) => setFilter('commodity', commodity, { grade: '' })} title="Commodity" placeholder="Any commodity" clearable />
          <Select
            value={filters.grade}
            options={filters.commodity ? lookups.gradeOptionsFor(filters.commodity) : lookups.gradeOptions}
            onChange={(grade) => setFilter('grade', grade)}
            title="Grade"
            placeholder="Any grade"
            clearable
          />
          <Select value={filters.company} options={lookups.companyOptions} onChange={(company) => setFilter('company', company)} title="Company" placeholder="Any company" clearable />
          <Select value={filters.companyGroup} options={lookups.companyGroupOptions} onChange={(companyGroup) => setFilter('companyGroup', companyGroup)} title="Company group" placeholder="Any company group" clearable />
          <Select value={filters.bagType} options={lookups.bagConfigOptions} onChange={(bagType) => setFilter('bagType', bagType)} title="Bag" placeholder="Any bag" clearable />
          <Select value={filters.location} options={lookups.locationOptions} onChange={(location) => setFilter('location', location, { subLocation: '' })} title="Location" placeholder="Any location" clearable />
          {!!filters.location && (
            <Select
              value={filters.subLocation}
              options={lookups.subLocationOptionsFor(filters.location)}
              onChange={(subLocation) => setFilter('subLocation', subLocation)}
              title="Sub-location"
              placeholder="Any sub-location"
              clearable
            />
          )}
        </SheetBody>
      </Sheet>
    </Screen>
  );
}

const STATUS_LABELS: Record<StatusFilter, string> = {
  AVAILABLE: 'Available',
  PRELOT: 'In pre-lots',
  PREOUTWARD: 'For dispatch',
  CONSUMED: 'Consumed',
  DISPATCHED: 'Dispatched',
  TRANSFERRED: 'Transferred',
  ALL: 'All',
};

function FilterLabel({ children }: { children: string }) {
  return (
    <Text variant="label" tone="muted" style={{ marginBottom: -6 }}>
      {children.toUpperCase()}
    </Text>
  );
}
