import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import {
  useCreateGenerateGrnEntry,
  useGenerateGrnEntries,
  useInwardWeighBridgeEntries,
  useUpdateGenerateGrnEntry,
  type GenerateGrnEntry,
  type GenerateGrnEntryItem,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Button, IconButton } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Loading } from '@/components/ui/feedback';
import { Field, Input, NumberInput } from '@/components/ui/field';
import { Callout, CheckboxRow } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { useSyncedState } from '@/hooks/use-synced-state';
import { formatDate, formatNumber, today } from '@/lib/format';
import { objectId } from '@/lib/object-id';
import { useTheme } from '@/theme';

type EntryItem = GenerateGrnEntryItem;

const blankEntry = (commodityId = ''): EntryItem => ({
  _id: objectId(),
  commodity_id: commodityId,
  grade_id: '',
  bag_type_id: '',
  base_bag_type_id: '',
  bags_used: 0,
  sample_collected: false,
  sample_not_collected_reason: '',
  location_id: '',
  sub_location_id: '',
  remarks: '',
  vehicle_photo: '',
});

/** Rows are unique on commodity + grade + location + sub-location. */
const duplicateIdsIn = (entries: EntryItem[]): string[] => {
  const keyOf = (entry: EntryItem) =>
    `${entry.commodity_id}-${entry.grade_id}-${entry.location_id}-${entry.sub_location_id}`;
  return entries.reduce<string[]>((duplicates, entry, index, all) => {
    const first = all.findIndex((other) => keyOf(other) === keyOf(entry));
    if (first !== index && first !== -1) duplicates.push(entry._id);
    return duplicates;
  }, []);
};

/**
 * GRN entry — create and edit.
 *
 * The unload is described one line at a time: which grade went where, in what
 * bag, how many bags. The running bag tally is pinned above the action bar
 * because "have I accounted for every bag on the truck?" is the question the
 * operator is actually answering, and scrolling to add it up defeats the point.
 */
export default function GrnFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const lookups = useMasterLookups();
  const grns = useGenerateGrnEntries();
  const wbis = useInwardWeighBridgeEntries();
  const create = useCreateGenerateGrnEntry();
  const update = useUpdateGenerateGrnEntry();

  const editItem = useMemo(
    () => (isEdit ? (grns.data ?? []).find((grn) => grn._id === id) : undefined),
    [isEdit, id, grns.data]
  );

  const [draft, setDraft] = useSyncedState<{
    grnId: string;
    wbiId: string;
    date: string;
    totalBags: number;
    entries: EntryItem[];
    expanded: string | null;
    pickerOpen: boolean;
  }>(
    isEdit ? (editItem?._id ?? null) : grns.data ? 'new' : null,
    () => {
      if (editItem) {
        return {
          grnId: editItem.grn_id,
          wbiId: editItem.wbi_id,
          date: editItem.date ? String(editItem.date).slice(0, 10) : today(),
          totalBags: editItem.total_bags ?? 0,
          entries: editItem.entries ?? [],
          expanded: editItem.entries?.[0]?._id ?? null,
          // Editing never re-picks the weigh-in; it is fixed by then.
          pickerOpen: false,
        };
      }
      const maxId = (grns.data ?? []).reduce((max, grn) => {
        const parsed = parseInt(grn.grn_id || '0', 10);
        return !Number.isNaN(parsed) && parsed > max ? parsed : max;
      }, 1);
      const first = blankEntry();
      return {
        grnId: String(maxId + 1),
        wbiId: '',
        date: today(),
        totalBags: 0,
        entries: [first],
        expanded: first._id,
        // A GRN cannot exist without a weigh-in, so ask for it first.
        pickerOpen: Boolean(grns.data),
      };
    }
  );

  const { grnId, wbiId, date, totalBags, entries, expanded, pickerOpen: wbiPickerOpen } = draft;
  const setEntries = (next: EntryItem[] | ((current: EntryItem[]) => EntryItem[])) =>
    setDraft((current) => ({
      ...current,
      entries: typeof next === 'function' ? next(current.entries) : next,
    }));
  const setExpanded = (value: string | null) => setDraft((current) => ({ ...current, expanded: value }));
  const setDate = (value: string) => setDraft((current) => ({ ...current, date: value }));
  const setWbiPickerOpen = (value: boolean) => setDraft((current) => ({ ...current, pickerOpen: value }));

  const selectedWbi = (wbis.data ?? []).find((wbi) => wbi.wbi_id === wbiId);
  const wbiCommodityIds = selectedWbi?.commodity_ids ?? [];
  const lockCommodity = wbiCommodityIds.length === 1;

  /** Weigh-ins that carry goods and are not already booked to another GRN. */
  const availableWbis = useMemo(
    () =>
      (wbis.data ?? [])
        .filter((wbi) => wbi.wbi_id === wbiId || !(grns.data ?? []).some((grn) => grn.wbi_id === wbi.wbi_id))
        .filter((wbi) => (wbi.commodity_ids?.length ?? 0) > 0),
    [wbis.data, grns.data, wbiId]
  );

  const usedBags = entries.reduce((sum, entry) => sum + (entry.bags_used || 0), 0);
  const remaining = totalBags - usedBags;
  const duplicates = duplicateIdsIn(entries);

  const selectWbi = (wbiKey: string) => {
    const wbi = (wbis.data ?? []).find((entry) => entry._id === wbiKey);
    if (!wbi?.wbi_id) {
      toast.error('That weigh-in has no WBI ID');
      return;
    }
    const ids = wbi.commodity_ids ?? [];
    setDraft((current) => ({
      ...current,
      wbiId: wbi.wbi_id,
      totalBags: wbi.total_bags,
      // Keep a commodity only if the new weigh-in actually carries it.
      entries: current.entries.map((entry) => ({
        ...entry,
        commodity_id: ids.length === 1 ? ids[0] : ids.includes(entry.commodity_id) ? entry.commodity_id : '',
      })),
      pickerOpen: false,
    }));
  };

  const updateEntry = (entryId: string, patch: Partial<EntryItem>) =>
    setEntries((current) => current.map((entry) => (entry._id === entryId ? { ...entry, ...patch } : entry)));

  const addEntry = () => {
    const next = blankEntry(lockCommodity ? wbiCommodityIds[0] : (entries[0]?.commodity_id ?? ''));
    setEntries((current) => [...current, next]);
    setExpanded(next._id);
  };

  /** First failing rule, in the same order as the web form. */
  const validate = (): string | null => {
    if (!grnId) return 'GRN ID is required';
    if (!wbiId) return 'Please select a WBI';
    if (entries.length === 0) return 'At least one entry is required';
    if (remaining < 0) return 'Bags used cannot exceed total bags';
    if (duplicates.length > 0) return 'Entries must be unique on commodity, grade, location and sub-location';

    if (selectedWbi?.date && new Date(date) < new Date(String(selectedWbi.date).slice(0, 10))) {
      return `GRN date cannot be before the WBI date (${formatDate(selectedWbi.date)})`;
    }

    for (const entry of entries) {
      if (!entry.commodity_id) return 'Commodity is required for all entries';
      if (!entry.grade_id) return 'Grade is required for all entries';
      if (!entry.bag_type_id) return 'Bag type config is required for all entries';
      if (!entry.bags_used || entry.bags_used <= 0) return 'Number of bags is required for all entries';
      if (!entry.location_id) return 'Location is required for all entries';
      if (!entry.sub_location_id) return 'Sub-location is required for all entries';
      if (!entry.sample_collected && !entry.sample_not_collected_reason) {
        return 'Give a reason when a sample was not collected';
      }
    }

    if (wbiCommodityIds.length > 1) {
      const entered = entries.map((entry) => entry.commodity_id);
      const missing = wbiCommodityIds.filter((commodityId) => !entered.includes(commodityId));
      if (missing.length > 0) {
        return `Add at least one entry per commodity. Missing: ${missing.map((cid) => lookups.commodityName(cid)).join(', ')}`;
      }
    }
    return null;
  };

  const submit = async () => {
    const failure = validate();
    if (failure) {
      toast.error(failure);
      return;
    }

    const payload = {
      grn_id: grnId,
      wbi_id: wbiId,
      date,
      total_bags: totalBags,
      entries,
      is_mutable: editItem ? editItem.is_mutable : true,
      is_deletable: editItem ? editItem.is_deletable : true,
    } as unknown as GenerateGrnEntry;

    try {
      if (editItem) {
        await update.mutateAsync({ id: editItem._id, data: payload });
        toast.success('GRN updated');
      } else {
        await create.mutateAsync(payload);
        toast.success('GRN created', { description: `GRN ${grnId}` });
      }
      router.back();
    } catch (error) {
      toast.error(editItem ? 'Could not update the GRN' : 'Could not create the GRN', {
        description: getErrorMessage(error),
      });
    }
  };

  if (isEdit && grns.isLoading) {
    return (
      <Screen>
        <Header title="GRN entry" />
        <Loading label="Loading GRN…" />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <Header title={isEdit ? `Edit GRN ${grnId}` : 'New GRN'} subtitle={wbiId ? `Against WBI ${wbiId}` : 'Select a weigh-in to begin'} />

      <Body>
        {!wbiId && (
          <Callout
            tone="warning"
            title="Select a WBI to continue"
            description="A GRN records what came off a specific weighed-in vehicle."
          />
        )}

        <Card>
          <SectionHeader
            title="Details"
            action={
              !isEdit ? (
                <Button label={wbiId ? 'Change WBI' : 'Select WBI'} size="sm" variant="outline" onPress={() => setWbiPickerOpen(true)} />
              ) : undefined
            }
          />
          <View style={{ gap: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="GRN ID" style={{ flex: 1 }}>
                <Input value={grnId} readOnly />
              </Field>
              <Field label="Date" required style={{ flex: 1.4 }}>
                <DateField value={date} onChange={setDate} />
              </Field>
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="WBI" style={{ flex: 1 }}>
                <Input value={wbiId || 'Not selected'} readOnly />
              </Field>
              <Field label="Total bags (from WBI)" style={{ flex: 1 }}>
                <Input value={totalBags ? String(totalBags) : ''} readOnly />
              </Field>
            </View>
          </View>
        </Card>

        {duplicates.length > 0 && (
          <Callout
            tone="danger"
            title="Duplicate entries"
            description="Two entries share the same commodity, grade, location and sub-location. Merge or change them."
          />
        )}

        <SectionHeader
          title="Entries"
          caption={`${entries.length} line item${entries.length === 1 ? '' : 's'}`}
          action={<Button label="Add" icon="add" size="sm" variant="outline" onPress={addEntry} />}
        />

        <Animated.View layout={LinearTransition.duration(180)} style={{ gap: theme.spacing.md }}>
          {entries.map((entry, index) => (
            <EntryCard
              key={entry._id}
              index={index}
              entry={entry}
              expanded={expanded === entry._id}
              duplicate={duplicates.includes(entry._id)}
              lookups={lookups}
              commodityOptions={
                wbiId
                  ? lookups.commodityOptions.filter((option) => wbiCommodityIds.includes(option.value))
                  : lookups.commodityOptions
              }
              lockCommodity={Boolean(wbiId) && lockCommodity}
              onToggle={() => setExpanded(expanded === entry._id ? null : entry._id)}
              onChange={(patch) => updateEntry(entry._id, patch)}
              onRemove={() => setEntries((current) => current.filter((row) => row._id !== entry._id))}
            />
          ))}
        </Animated.View>

        {entries.length === 0 && (
          <Callout tone="info" title="No entries yet" description="Add a line for each grade unloaded." />
        )}
      </Body>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          paddingVertical: theme.spacing.sm,
          backgroundColor: theme.colors.surfaceAlt,
        }}
      >
        <Tally label="On WBI" value={formatNumber(totalBags)} />
        <Tally label="Used" value={formatNumber(usedBags)} />
        <Tally
          label="Remaining"
          value={formatNumber(remaining)}
          tone={remaining < 0 ? 'danger' : remaining === 0 ? 'success' : 'warning'}
        />
      </View>

      <ActionBar>
        <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
        <Button
          label={isEdit ? 'Save changes' : 'Create GRN'}
          style={{ flex: 2 }}
          loading={create.isPending || update.isPending}
          onPress={submit}
        />
      </ActionBar>

      <Sheet open={wbiPickerOpen} onClose={() => setWbiPickerOpen(false)} title="Select a WBI" subtitle="Weigh-ins not yet booked to a GRN">
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
          {availableWbis.length === 0 && (
            <Text tone="muted" style={{ textAlign: 'center', paddingVertical: theme.spacing.xl }}>
              Every weigh-in already has a GRN.
            </Text>
          )}
          {availableWbis.map((wbi) => (
            <Pressable
              key={wbi._id}
              accessibilityRole="button"
              accessibilityLabel={`WBI ${wbi.wbi_id}, ${wbi.vehicle_no}`}
              onPress={() => selectWbi(wbi._id)}
              style={({ pressed }) => ({
                padding: theme.spacing.md,
                borderRadius: theme.radius.md,
                gap: 3,
                backgroundColor: pressed ? theme.colors.surfaceActive : theme.colors.surfaceAlt,
              })}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}>
                <Text variant="bodyStrong">WBI {wbi.wbi_id}</Text>
                <Text variant="bodyStrong" tone="primary" numeric>
                  {formatNumber(wbi.total_bags)} bags
                </Text>
              </View>
              <Text variant="caption" tone="muted">
                {[wbi.vehicle_no, lookups.sourceLocationName(wbi.source_location_id), formatDate(wbi.date)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Text variant="caption" tone="faint">
                {(wbi.commodity_ids ?? []).map((cid) => lookups.commodityName(cid)).join(', ')} · Net{' '}
                {formatNumber(wbi.net_weight)} kg
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </Screen>
  );
}

function Tally({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  return (
    <View style={{ alignItems: 'center', gap: 1 }}>
      <Text variant="bodyStrong" tone={tone === 'default' ? 'default' : tone} numeric>
        {value}
      </Text>
      <Text variant="micro" tone="faint">
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function EntryCard({
  index,
  entry,
  expanded,
  duplicate,
  lookups,
  commodityOptions,
  lockCommodity,
  onToggle,
  onChange,
  onRemove,
}: {
  index: number;
  entry: EntryItem;
  expanded: boolean;
  duplicate: boolean;
  lookups: ReturnType<typeof useMasterLookups>;
  commodityOptions: { value: string; label: string }[];
  lockCommodity: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<EntryItem>) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();

  const baseBagTypeId =
    entry.base_bag_type_id ||
    lookups.raw.bagTypeConfigs.find((config) => config._id === entry.bag_type_id)?.bag_type_id ||
    '';

  const summary = [
    lookups.commodityName(entry.commodity_id),
    lookups.gradeName(entry.grade_id),
    entry.bags_used ? `${formatNumber(entry.bags_used)} bags` : null,
  ]
    .filter((part) => part && part !== '—')
    .join(' · ');

  return (
    <Card padded={false} style={duplicate ? { borderColor: theme.colors.danger, borderWidth: 1.5 } : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: theme.spacing.lg,
          backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent',
        })}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: duplicate ? theme.colors.dangerSoft : theme.colors.primarySoft,
          }}
        >
          <Text variant="micro" style={{ color: duplicate ? theme.colors.danger : theme.colors.primary }}>
            {index + 1}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="bodyStrong">{summary || 'New entry'}</Text>
          <Text variant="caption" tone={duplicate ? 'danger' : 'muted'}>
            {duplicate
              ? 'Duplicate of another entry'
              : entry.location_id
                ? `${lookups.locationName(entry.location_id)} · ${lookups.subLocationName(entry.location_id, entry.sub_location_id)}`
                : 'Location not set'}
          </Text>
        </View>
        <IconButton icon="trash-outline" tone="danger" accessibilityLabel={`Remove entry ${index + 1}`} onPress={onRemove} />
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.faintText} />
      </Pressable>

      {expanded && (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg, gap: theme.spacing.lg }}
        >
          <Field label="Commodity" required>
            <Select
              value={entry.commodity_id}
              options={commodityOptions}
              onChange={(value) => onChange({ commodity_id: value, grade_id: '' })}
              title="Commodity"
              disabled={lockCommodity}
            />
          </Field>

          <Field label="Grade" required>
            <Select
              value={entry.grade_id}
              options={lookups.gradeOptionsFor(entry.commodity_id)}
              onChange={(value) => onChange({ grade_id: value })}
              title="Grade"
              placeholder={entry.commodity_id ? 'Select grade' : 'Pick a commodity first'}
              disabled={!entry.commodity_id}
            />
          </Field>

          <Field label="Bag type" required>
            <Select
              value={baseBagTypeId}
              options={lookups.bagTypeOptions}
              onChange={(value) => onChange({ base_bag_type_id: value, bag_type_id: '' })}
              title="Bag type"
            />
          </Field>

          <Field label="Bag configuration" required hint="Size and tare weight used for this line">
            <Select
              value={entry.bag_type_id}
              options={lookups.bagConfigOptionsFor(baseBagTypeId)}
              onChange={(value) => onChange({ bag_type_id: value })}
              title="Bag configuration"
              placeholder={baseBagTypeId ? 'Select configuration' : 'Pick a bag type first'}
              disabled={!baseBagTypeId}
            />
          </Field>

          <Field label="Number of bags" required>
            <NumberInput value={entry.bags_used || ''} onChangeValue={(value) => onChange({ bags_used: Number(value || 0) })} />
          </Field>

          <Field label="Location" required>
            <Select
              value={entry.location_id}
              options={lookups.locationOptions}
              onChange={(value) => onChange({ location_id: value, sub_location_id: '' })}
              title="Warehouse location"
            />
          </Field>

          <Field label="Sub-location" required>
            <Select
              value={entry.sub_location_id}
              options={lookups.subLocationOptionsFor(entry.location_id)}
              onChange={(value) => onChange({ sub_location_id: value })}
              title="Sub-location"
              placeholder={entry.location_id ? 'Select sub-location' : 'Pick a location first'}
              disabled={!entry.location_id}
            />
          </Field>

          <CheckboxRow
            label="Sample collected"
            checked={entry.sample_collected}
            onChange={(checked) => onChange({ sample_collected: checked, sample_not_collected_reason: checked ? '' : entry.sample_not_collected_reason })}
          />

          {!entry.sample_collected && (
            <Field label="Reason sample was not collected" required>
              <Input
                value={entry.sample_not_collected_reason ?? ''}
                onChangeText={(value) => onChange({ sample_not_collected_reason: value })}
                placeholder="e.g. sampling machine down"
              />
            </Field>
          )}

          <Field label="Remarks">
            <Input value={entry.remarks ?? ''} onChangeText={(value) => onChange({ remarks: value })} />
          </Field>
        </Animated.View>
      )}
    </Card>
  );
}
