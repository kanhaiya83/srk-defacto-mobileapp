import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import type { StockLedgerEntry } from '@/api/operations-api';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, NumberInput } from '@/components/ui/field';
import { Callout, SearchBar } from '@/components/ui/misc';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { getStockBreakdown } from '@/features/operations/stock';
import { formatNumber, formatWeight, refId } from '@/lib/format';
import { useTheme } from '@/theme';

export interface Allocation {
  stock_ledger_id: string;
  bags_allocated: number;
  allocated_weight: number;
}

/**
 * Picking stock to reserve.
 *
 * Pre-lot and pre-outward both answer the same question — "which batches, and
 * how many bags from each?" — so they share this control. Availability is
 * recomputed against what is already in the basket, which is what stops someone
 * reserving the same 200 bags twice in one form.
 */
export function AllocationPicker({
  entries,
  allocations,
  onChange,
  /** Restricts the batch list, e.g. to one commodity for a pre-lot. */
  filter,
  emptyHint,
}: {
  entries: StockLedgerEntry[];
  allocations: Allocation[];
  onChange: (allocations: Allocation[]) => void;
  filter?: (entry: StockLedgerEntry) => boolean;
  emptyHint?: string;
}) {
  const theme = useTheme();
  const lookups = useMasterLookups();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<{ entry: StockLedgerEntry; bags: number | ''; weight: number | '' } | null>(null);

  const byId = useMemo(() => new Map(entries.map((entry) => [entry._id, entry])), [entries]);

  const available = useMemo(
    () =>
      entries
        .filter((entry) => (filter ? filter(entry) : true))
        .map((entry) => ({ entry, breakdown: getStockBreakdown(entry) }))
        .filter(({ entry, breakdown }) => {
          const taken = allocations.find((a) => a.stock_ledger_id === entry._id)?.bags_allocated ?? 0;
          return breakdown.available_bags - taken > 0;
        }),
    [entries, filter, allocations]
  );

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter(({ entry }) =>
      [entry.entry_no, lookups.commodityName(refId(entry.commodity_id)), lookups.gradeName(refId(entry.grade_id))]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [available, query, lookups]);

  const totals = allocations.reduce(
    (acc, allocation) => ({
      bags: acc.bags + allocation.bags_allocated,
      weight: acc.weight + allocation.allocated_weight,
    }),
    { bags: 0, weight: 0 }
  );

  const openDraft = (entry: StockLedgerEntry) => {
    const breakdown = getStockBreakdown(entry);
    const perBag = entry.weight_per_bag || (entry.original_bags ? entry.original_weight / entry.original_bags : 0);
    const taken = allocations.find((a) => a.stock_ledger_id === entry._id)?.bags_allocated ?? 0;
    const remaining = breakdown.available_bags - taken;
    setDraft({ entry, bags: remaining, weight: Number((remaining * perBag).toFixed(2)) });
    setPickerOpen(false);
  };

  const commitDraft = () => {
    if (!draft) return;
    const breakdown = getStockBreakdown(draft.entry);
    const existing = allocations.find((a) => a.stock_ledger_id === draft.entry._id);
    const otherBags = existing ? 0 : 0;
    const bags = Number(draft.bags || 0);

    if (bags <= 0) return toast.error('Enter how many bags to allocate');
    if (bags + otherBags > breakdown.available_bags) {
      return toast.error(`Only ${formatNumber(breakdown.available_bags)} bags are available in this batch`);
    }

    const next: Allocation = {
      stock_ledger_id: draft.entry._id,
      bags_allocated: bags,
      allocated_weight: Number(draft.weight || 0),
    };

    onChange(
      existing
        ? allocations.map((a) => (a.stock_ledger_id === next.stock_ledger_id ? next : a))
        : [...allocations, next]
    );
    setDraft(null);
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      {allocations.length === 0 && (
        <Callout
          tone="info"
          title="Nothing allocated yet"
          description={emptyHint ?? 'Pick the batches this should draw from.'}
        />
      )}

      <Animated.View layout={LinearTransition.duration(180)} style={{ gap: theme.spacing.sm }}>
        {allocations.map((allocation) => {
          const entry = byId.get(allocation.stock_ledger_id);
          return (
            <Animated.View key={allocation.stock_ledger_id} entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)}>
              <Card padded={false}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">{entry?.entry_no ?? 'Batch'}</Text>
                    <Text variant="caption" tone="muted">
                      {entry
                        ? `${lookups.commodityName(refId(entry.commodity_id))} · ${lookups.gradeName(refId(entry.grade_id))}`
                        : 'Unknown batch'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 1 }}>
                    <Text variant="bodyStrong" tone="primary" numeric>
                      {formatNumber(allocation.bags_allocated)} bags
                    </Text>
                    <Text variant="caption" tone="faint" numeric>
                      {formatWeight(allocation.allocated_weight)}
                    </Text>
                  </View>
                  <IconButton
                    icon="pencil-outline"
                    accessibilityLabel="Change allocation"
                    onPress={() =>
                      entry &&
                      setDraft({ entry, bags: allocation.bags_allocated, weight: allocation.allocated_weight })
                    }
                  />
                  <IconButton
                    icon="close"
                    tone="danger"
                    accessibilityLabel="Remove allocation"
                    onPress={() => onChange(allocations.filter((a) => a.stock_ledger_id !== allocation.stock_ledger_id))}
                  />
                </View>
              </Card>
            </Animated.View>
          );
        })}
      </Animated.View>

      {allocations.length > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: theme.spacing.xs }}>
          <Text variant="caption" tone="muted">
            {allocations.length} batch{allocations.length === 1 ? '' : 'es'}
          </Text>
          <Text variant="label" numeric>
            {formatNumber(totals.bags)} bags · {formatWeight(totals.weight)}
          </Text>
        </View>
      )}

      <Button
        label="Add stock"
        icon="add"
        variant="outline"
        fullWidth
        onPress={() => {
          setQuery('');
          setPickerOpen(true);
        }}
      />

      {/* ------------------------------------------------------ batch picker */}
      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Select a batch" subtitle="Only batches with bags left are listed">
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <SearchBar value={query} onChange={setQuery} placeholder="Search entry, commodity, grade…" />
        </View>
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
          {searched.length === 0 && (
            <Text tone="muted" style={{ textAlign: 'center', paddingVertical: theme.spacing.xl }}>
              No stock available to allocate.
            </Text>
          )}
          {searched.map(({ entry, breakdown }) => {
            const taken = allocations.find((a) => a.stock_ledger_id === entry._id)?.bags_allocated ?? 0;
            return (
              <Pressable
                key={entry._id}
                accessibilityRole="button"
                accessibilityLabel={`Allocate from ${entry.entry_no}`}
                onPress={() => openDraft(entry)}
                style={({ pressed }) => ({
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.md,
                  gap: 3,
                  backgroundColor: pressed ? theme.colors.surfaceActive : theme.colors.surfaceAlt,
                })}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}>
                  <Text variant="bodyStrong">{entry.entry_no}</Text>
                  <Text variant="bodyStrong" tone="primary" numeric>
                    {formatNumber(breakdown.available_bags - taken)} bags
                  </Text>
                </View>
                <Text variant="caption" tone="muted">
                  {lookups.commodityName(refId(entry.commodity_id))} · {lookups.gradeName(refId(entry.grade_id))} ·{' '}
                  {lookups.bagConfigName(refId(entry.bag_type_id))}
                </Text>
                <Text variant="caption" tone="faint">
                  {lookups.locationName(refId(entry.location_id))} ·{' '}
                  {lookups.subLocationName(refId(entry.location_id), entry.sub_location_id)} ·{' '}
                  {formatWeight(breakdown.available_weight)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>

      {/* ------------------------------------------------------ quantity form */}
      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.entry.entry_no}
        subtitle="How much of this batch?"
        footer={
          <>
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setDraft(null)} />
            <Button label="Allocate" style={{ flex: 2 }} onPress={commitDraft} />
          </>
        }
      >
        {draft && (
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
            {(() => {
              const breakdown = getStockBreakdown(draft.entry);
              const perBag =
                draft.entry.weight_per_bag ||
                (draft.entry.original_bags ? draft.entry.original_weight / draft.entry.original_bags : 0);
              const over = draft.bags !== '' && Number(draft.bags) > breakdown.available_bags;
              return (
                <>
                  <Callout
                    tone={over ? 'danger' : 'info'}
                    icon="cube-outline"
                    title={`${formatNumber(breakdown.available_bags)} bags available`}
                    description={`${formatWeight(breakdown.available_weight)} · ${formatNumber(perBag, 2)} kg per bag`}
                  />

                  <Field label="Bags" required error={over ? 'More than this batch holds' : undefined}>
                    <NumberInput
                      value={draft.bags}
                      onChangeValue={(bags) =>
                        setDraft({
                          ...draft,
                          bags,
                          // Keep weight in step unless it has been typed over.
                          weight: bags === '' ? '' : Number((Number(bags) * perBag).toFixed(2)),
                        })
                      }
                      error={over}
                      autoFocus
                    />
                  </Field>

                  <Field label="Weight" hint="Adjust if the physical weight differs">
                    <NumberInput
                      value={draft.weight}
                      onChangeValue={(weight) => setDraft({ ...draft, weight })}
                      suffix="kg"
                    />
                  </Field>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      setDraft({
                        ...draft,
                        bags: breakdown.available_bags,
                        weight: Number(breakdown.available_weight.toFixed(2)),
                      })
                    }
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' }}
                  >
                    <Ionicons name="flash-outline" size={15} color={theme.colors.primary} />
                    <Text variant="label" tone="primary">
                      Allocate everything
                    </Text>
                  </Pressable>
                </>
              );
            })()}
          </View>
        )}
      </Sheet>
    </View>
  );
}
