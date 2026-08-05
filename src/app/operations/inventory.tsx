import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useStockLedgerAll, type StockLedgerEntry } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { DetailRow, SearchBar, Segmented, StatTile } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { Body, Header, Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { useMasterLookups } from '@/features/operations/lookups';
import {
  applyStockFilters,
  computeTotals,
  defaultStockFilters,
  getStockBreakdown,
  groupStock,
  type StatusFilter,
  type StockFilterState,
} from '@/features/operations/stock';
import { formatCurrency, formatNumber, formatWeight, refId } from '@/lib/format';
import { useTheme } from '@/theme';

type InventoryView = 'grouped' | 'batches' | 'locations';

/**
 * Inventory.
 *
 * Three readings of the same ledger: rolled up by commodity and grade (what do
 * we have?), by batch (which specific lot?), and by location (where is it?).
 * Filters apply across all three, so switching view never loses the question
 * the user was asking.
 */
export default function InventoryScreen() {
  const theme = useTheme();
  const lookups = useMasterLookups();
  const ledger = useStockLedgerAll();

  const [view, setView] = useState<InventoryView>('grouped');
  const [filters, setFilters] = useState<StockFilterState>(defaultStockFilters);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<StockLedgerEntry | null>(null);

  const entries = useMemo(() => ledger.data ?? [], [ledger.data]);
  const filtered = useMemo(() => applyStockFilters(entries, filters), [entries, filters]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((entry) =>
      [
        entry.entry_no,
        lookups.commodityName(refId(entry.commodity_id)),
        lookups.gradeName(refId(entry.grade_id)),
        lookups.locationName(refId(entry.location_id)),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [filtered, query, lookups]);

  const totals = useMemo(() => computeTotals(searched), [searched]);

  const commodityGroups = useMemo(
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

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'status') return value !== 'AVAILABLE';
    if (key === 'source') return value !== 'ALL';
    return Boolean(value);
  }).length;

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
      <Header title="Inventory" subtitle={`${formatNumber(searched.length)} batches in view`} />

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={ledger.isRefetching} onRefresh={() => void ledger.refetch()} tintColor={theme.colors.primary} />
        }
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          <StatTile label="Available bags" value={formatNumber(totals.available_bags)} icon="cube-outline" />
          <StatTile label="Available weight" value={formatWeight(totals.available_weight)} icon="scale-outline" tone="info" />
          <StatTile label="Reserved (pre-lot)" value={formatNumber(totals.prelot_bags)} icon="albums-outline" tone="warning" />
          <StatTile label="Reserved (dispatch)" value={formatNumber(totals.preoutward_bags)} icon="file-tray-full-outline" tone="warning" />
          <StatTile label="Consumed" value={formatNumber(totals.consumed_bags)} icon="cog-outline" tone="neutral" />
          <StatTile label="Dispatched" value={formatNumber(totals.dispatched_bags)} icon="cloud-upload-outline" tone="success" />
        </View>

        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search entry, commodity, grade…"
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
                borderColor: activeFilterCount > 0 ? theme.colors.primary : theme.colors.border,
                backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
              })}
            >
              <Ionicons
                name="options-outline"
                size={19}
                color={activeFilterCount > 0 ? theme.colors.primary : theme.colors.mutedText}
              />
            </Pressable>
          }
        />

        {activeFilterCount > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text variant="caption" tone="muted" style={{ flex: 1 }}>
              {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} applied
            </Text>
            <Button label="Reset" size="sm" variant="ghost" onPress={() => setFilters(defaultStockFilters)} />
          </View>
        )}

        <Segmented<InventoryView>
          value={view}
          onChange={setView}
          options={[
            { value: 'grouped', label: 'By grade', count: commodityGroups.length },
            { value: 'batches', label: 'Batches', count: searched.length },
            { value: 'locations', label: 'Locations', count: locationGroups.length },
          ]}
        />

        {searched.length === 0 && (
          <EmptyState
            icon="cube-outline"
            title="No stock matches"
            description="Try clearing a filter, or switch the status filter to “All”."
          />
        )}

        {view === 'grouped' &&
          commodityGroups.map((group, index) => (
            <Animated.View key={group.key} entering={index < 10 ? FadeInDown.delay(index * 20).duration(200) : undefined}>
              <Card>
                <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">{group.label}</Text>
                    <Text variant="caption" tone="muted">
                      {group.sublabel} · {group.entries.length} batch{group.entries.length === 1 ? '' : 'es'}
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
                <View style={{ marginTop: theme.spacing.sm }}>
                  <DetailRow label="Available weight" value={formatWeight(group.weight)} />
                  <DetailRow label="Approx. value" value={formatCurrency(group.value)} />
                </View>
              </Card>
            </Animated.View>
          ))}

        {view === 'locations' &&
          locationGroups.map((group, index) => (
            <Animated.View key={group.key} entering={index < 10 ? FadeInDown.delay(index * 20).duration(200) : undefined}>
              <Card>
                <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
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
                      {group.sublabel}
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
            </Animated.View>
          ))}

        {view === 'batches' &&
          searched.slice(0, 200).map((entry, index) => {
            const breakdown = getStockBreakdown(entry);
            return (
              <Animated.View key={entry._id} entering={index < 10 ? FadeInDown.delay(index * 20).duration(200) : undefined}>
                <Card onPress={() => setSelected(entry)}>
                  <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="bodyStrong">{entry.entry_no}</Text>
                      <Text variant="caption" tone="muted">
                        {lookups.commodityName(refId(entry.commodity_id))} · {lookups.gradeName(refId(entry.grade_id))}
                      </Text>
                    </View>
                    <Badge label={entry.source_type.replace('_', ' ')} tone={entry.source_type === 'INWARD' ? 'info' : 'neutral'} />
                  </View>
                  <DetailRow label="Available" value={`${formatNumber(breakdown.available_bags)} bags`} emphasis />
                  <DetailRow label="Weight" value={formatWeight(breakdown.available_weight)} />
                  <DetailRow
                    label="Location"
                    value={`${lookups.locationName(refId(entry.location_id))} · ${lookups.subLocationName(refId(entry.location_id), entry.sub_location_id)}`}
                  />
                </Card>
              </Animated.View>
            );
          })}

        {view === 'batches' && searched.length > 200 && (
          <Text variant="caption" tone="faint" style={{ textAlign: 'center' }}>
            Showing the first 200 batches. Narrow the filters to see the rest.
          </Text>
        )}
      </ScrollView>

      {/* ---------------------------------------------------------- filters */}
      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter stock"
        footer={
          <>
            <Button label="Reset" variant="outline" style={{ flex: 1 }} onPress={() => setFilters(defaultStockFilters)} />
            <Button label="Apply" style={{ flex: 2 }} onPress={() => setFiltersOpen(false)} />
          </>
        }
      >
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" tone="muted">
              STATUS
            </Text>
            <Segmented<StatusFilter>
              value={filters.status}
              onChange={(status) => setFilters((current) => ({ ...current, status }))}
              options={[
                { value: 'AVAILABLE', label: 'Available' },
                { value: 'PRELOT', label: 'In pre-lot' },
                { value: 'PREOUTWARD', label: 'Reserved' },
                { value: 'CONSUMED', label: 'Consumed' },
                { value: 'DISPATCHED', label: 'Dispatched' },
                { value: 'TRANSFERRED', label: 'Transferred' },
                { value: 'ALL', label: 'All' },
              ]}
            />
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" tone="muted">
              SOURCE
            </Text>
            <Segmented
              value={filters.source}
              onChange={(source) => setFilters((current) => ({ ...current, source }))}
              options={[
                { value: 'ALL', label: 'Any' },
                { value: 'INWARD', label: 'Inward' },
                { value: 'LOT_OUTPUT', label: 'Lot output' },
                { value: 'TRANSFER', label: 'Transfer' },
                { value: 'INITIAL_STOCK', label: 'Opening' },
              ]}
            />
          </View>

          <Select
            value={filters.companyGroup}
            options={lookups.companyGroupOptions}
            onChange={(companyGroup) => setFilters((current) => ({ ...current, companyGroup }))}
            title="Company group"
            placeholder="Any company group"
            clearable
          />
          <Select
            value={filters.commodity}
            options={lookups.commodityOptions}
            onChange={(commodity) => setFilters((current) => ({ ...current, commodity, grade: '' }))}
            title="Commodity"
            placeholder="Any commodity"
            clearable
          />
          <Select
            value={filters.grade}
            options={filters.commodity ? lookups.gradeOptionsFor(filters.commodity) : lookups.gradeOptions}
            onChange={(grade) => setFilters((current) => ({ ...current, grade }))}
            title="Grade"
            placeholder="Any grade"
            clearable
          />
          <Select
            value={filters.location}
            options={lookups.locationOptions}
            onChange={(location) => setFilters((current) => ({ ...current, location }))}
            title="Location"
            placeholder="Any location"
            clearable
          />
        </ScrollView>
      </Sheet>

      {/* ------------------------------------------------------ batch detail */}
      <Sheet open={selected !== null} onClose={() => setSelected(null)} title={selected?.entry_no} subtitle="Stock batch">
        {selected && (
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
            <SectionHeader title="Identity" />
            <DetailRow label="Source" value={selected.source_type.replace('_', ' ')} />
            <DetailRow label="Commodity" value={lookups.commodityName(refId(selected.commodity_id))} />
            <DetailRow label="Grade" value={lookups.gradeName(refId(selected.grade_id))} />
            <DetailRow label="Bag" value={lookups.bagConfigName(refId(selected.bag_type_id))} />
            <DetailRow label="Company group" value={lookups.companyGroupName(refId(selected.company_group_id))} />
            <DetailRow label="Location" value={lookups.locationName(refId(selected.location_id))} />
            <DetailRow label="Sub-location" value={lookups.subLocationName(refId(selected.location_id), selected.sub_location_id)} />

            <View style={{ height: theme.spacing.lg }} />
            <SectionHeader title="Bag breakdown" caption="Every bag is in exactly one of these states" />
            {(() => {
              const breakdown = getStockBreakdown(selected);
              return (
                <>
                  <DetailRow label="Original" value={formatNumber(selected.original_bags)} />
                  <DetailRow label="Available" value={formatNumber(breakdown.available_bags)} emphasis tone="success" />
                  <DetailRow label="Reserved for lots" value={formatNumber(breakdown.prelot_bags)} />
                  <DetailRow label="Reserved for dispatch" value={formatNumber(breakdown.preoutward_bags)} />
                  <DetailRow label="Consumed in lots" value={formatNumber(breakdown.consumed_bags)} />
                  <DetailRow label="Dispatched" value={formatNumber(breakdown.dispatched_bags)} />
                  <DetailRow label="Transferred out" value={formatNumber(breakdown.transferred_bags)} />
                </>
              );
            })()}

            <View style={{ height: theme.spacing.lg }} />
            <SectionHeader title="Weights and rate" />
            <DetailRow label="Original weight" value={formatWeight(selected.original_weight)} />
            <DetailRow label="Available weight" value={formatWeight(getStockBreakdown(selected).available_weight)} />
            <DetailRow label="Weight per bag" value={`${formatNumber(selected.weight_per_bag, 2)} kg`} />
            <DetailRow label="Rate per kg" value={formatCurrency(selected.rate_per_kg)} />
            <DetailRow label="Batch value" value={formatCurrency(selected.original_amount)} emphasis />
          </ScrollView>
        )}
      </Sheet>
    </Screen>
  );
}
