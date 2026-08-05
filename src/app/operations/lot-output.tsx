import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { useCompleteLot, useLots, useUpdateLot, type Lot, type LotOutput } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Button, IconButton } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { EmptyState, ListSkeleton } from '@/components/ui/feedback';
import { Field, NumberInput } from '@/components/ui/field';
import { Callout, DetailRow, Segmented } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet, Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { useSyncedState } from '@/hooks/use-synced-state';
import { formatCurrency, formatNumber, formatWeight, refId, today } from '@/lib/format';
import { useTheme } from '@/theme';

const blankOutput = (): LotOutput => ({
  grade_id: '',
  bag_type_id: '',
  bags: 0,
  avg_weight_per_bag: 0,
  total_amount: 0,
  location_id: '',
  sub_location_id: '',
  date: today(),
});

/**
 * Lot output — what came out of a processing run.
 *
 * The screen is framed around one lot at a time: pick the run, then describe
 * its output grade by grade. The input-versus-output tally is always on screen
 * because the gap between them is the yield, and an unexplained gap is the
 * thing worth catching before the lot is closed.
 */
export default function LotOutputScreen() {
  const theme = useTheme();
  const lookups = useMasterLookups();
  const lots = useLots();
  const update = useUpdateLot();
  const complete = useCompleteLot();
  const { canUpdate } = useModulePermissions('lot');

  const [draft, setDraft] = useState<{ output: LotOutput; index: number | null } | null>(null);
  const [confirmComplete, setConfirmComplete] = useState(false);

  const openLots = useMemo(() => (lots.data ?? []).filter((lot) => !lot.is_complete), [lots.data]);

  // Default to the most recent open lot so the common case is zero taps. The
  // key seeds once the list arrives and never re-seeds, so a manual choice
  // survives a background refetch.
  const [chosenLotId, setChosenLotId] = useSyncedState<string>(openLots.length ? 'loaded' : null, () => openLots[0]?._id ?? '');
  const selected: Lot | undefined = (lots.data ?? []).find((lot) => lot._id === chosenLotId);
  const lotId = chosenLotId;

  const [entryState, setEntryState] = useSyncedState<{ outputs: LotOutput[]; wasteBags: number | '' }>(
    selected?._id ?? null,
    () => ({ outputs: selected?.outputs ?? [], wasteBags: selected?.waste_bags ?? 0 })
  );

  const { outputs, wasteBags } = entryState;
  const setOutputs = (next: LotOutput[] | ((current: LotOutput[]) => LotOutput[])) =>
    setEntryState((current) => ({
      ...current,
      outputs: typeof next === 'function' ? next(current.outputs) : next,
    }));
  const setWasteBags = (value: number | '') => setEntryState((current) => ({ ...current, wasteBags: value }));
  const setLotId = (value: string) => setChosenLotId(value);

  const totals = outputs.reduce(
    (acc, output) => ({
      bags: acc.bags + (output.bags || 0),
      weight: acc.weight + (output.bags || 0) * (output.avg_weight_per_bag || 0),
      amount: acc.amount + (output.total_amount || 0),
    }),
    { bags: 0, weight: 0, amount: 0 }
  );

  const inputBags = selected?.total_input_bags ?? 0;
  const accounted = totals.bags + Number(wasteBags || 0);
  const unaccounted = inputBags - accounted;

  const commitDraft = () => {
    if (!draft) return;
    const { output } = draft;
    if (!output.grade_id) return toast.error('Select a grade');
    if (!output.bag_type_id) return toast.error('Select a bag configuration');
    if (!output.bags || output.bags <= 0) return toast.error('Enter how many bags came out');
    if (!output.avg_weight_per_bag || output.avg_weight_per_bag <= 0) return toast.error('Enter the average bag weight');
    if (!output.location_id) return toast.error('Select where the output is stored');
    if (!output.sub_location_id) return toast.error('Select a sub-location');

    setOutputs((current) =>
      draft.index === null ? [...current, output] : current.map((row, index) => (index === draft.index ? output : row))
    );
    setDraft(null);
  };

  const save = async () => {
    if (!selected) return;
    try {
      await update.mutateAsync({
        id: selected._id,
        data: { outputs, waste_bags: Number(wasteBags || 0) },
      });
      toast.success('Output saved');
    } catch (error) {
      toast.error('Could not save the output', { description: getErrorMessage(error) });
    }
  };

  const doComplete = async () => {
    if (!selected) return;
    try {
      await update.mutateAsync({ id: selected._id, data: { outputs, waste_bags: Number(wasteBags || 0) } });
      await complete.mutateAsync(selected._id);
      toast.success(`Lot ${selected.lot_no} completed`, { description: 'Output is now available as stock.' });
      setConfirmComplete(false);
    } catch (error) {
      toast.error('Could not complete the lot', { description: getErrorMessage(error) });
    }
  };

  if (lots.isLoading) {
    return (
      <Screen>
        <Header title="Lot Output" />
        <ListSkeleton rows={3} />
      </Screen>
    );
  }

  if (openLots.length === 0) {
    return (
      <Screen>
        <Header title="Lot Output" />
        <EmptyState
          icon="cog-outline"
          title="No lots in progress"
          description="Create a lot and consume some input before recording what came out of it."
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <Header
        title="Lot Output"
        subtitle={selected ? `Lot ${selected.lot_no} · ${lookups.commodityName(refId(selected.commodity_id))}` : 'Pick a lot'}
      />

      <Body>
        <Field label="Lot">
          <Select
            value={lotId}
            options={openLots.map((lot) => ({
              value: lot._id,
              label: `Lot ${lot.lot_no}`,
              description: `${lookups.commodityName(refId(lot.commodity_id))} · ${formatNumber(lot.total_input_bags)} bags in`,
            }))}
            onChange={setLotId}
            title="Lot in progress"
          />
        </Field>

        {selected && (
          <>
            <Card>
              <SectionHeader title="Yield" caption="Input must equal output plus waste" />
              <DetailRow label="Input bags" value={formatNumber(inputBags)} />
              <DetailRow label="Input weight" value={formatWeight(selected.total_input_weight)} />
              <DetailRow label="Output bags" value={formatNumber(totals.bags)} emphasis />
              <DetailRow label="Output weight" value={formatWeight(totals.weight)} />
              <DetailRow label="Waste bags" value={formatNumber(Number(wasteBags || 0))} />
              <DetailRow
                label="Unaccounted"
                value={formatNumber(unaccounted)}
                tone={unaccounted === 0 ? 'success' : unaccounted < 0 ? 'danger' : 'warning'}
                emphasis
              />
            </Card>

            {unaccounted < 0 && (
              <Callout
                tone="danger"
                title="More out than in"
                description="Output plus waste exceeds the bags this lot consumed. Check the counts."
              />
            )}

            <SectionHeader
              title="Output lines"
              caption={outputs.length ? `${outputs.length} grades produced` : 'Nothing recorded yet'}
              action={
                <Button
                  label="Add"
                  icon="add"
                  size="sm"
                  variant="outline"
                  disabled={!canUpdate}
                  onPress={() => setDraft({ output: blankOutput(), index: null })}
                />
              }
            />

            <Animated.View layout={LinearTransition.duration(180)} style={{ gap: theme.spacing.md }}>
              {outputs.map((output, index) => (
                <Animated.View key={index} entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)}>
                  <Card onPress={canUpdate ? () => setDraft({ output, index }) : undefined}>
                    <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="bodyStrong">{lookups.gradeName(output.grade_id)}</Text>
                        <Text variant="caption" tone="muted">
                          {lookups.bagConfigName(output.bag_type_id)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 1 }}>
                        <Text variant="bodyStrong" tone="primary" numeric>
                          {formatNumber(output.bags)} bags
                        </Text>
                        <Text variant="caption" tone="faint" numeric>
                          {formatWeight((output.bags || 0) * (output.avg_weight_per_bag || 0))}
                        </Text>
                      </View>
                      <IconButton
                        icon="trash-outline"
                        tone="danger"
                        accessibilityLabel={`Remove output ${index + 1}`}
                        onPress={() => setOutputs((current) => current.filter((_, i) => i !== index))}
                      />
                    </View>
                    <DetailRow label="Stored at" value={lookups.locationName(output.location_id)} />
                    <DetailRow label="Value" value={formatCurrency(output.total_amount)} />
                  </Card>
                </Animated.View>
              ))}
            </Animated.View>

            {outputs.length === 0 && (
              <Callout tone="info" title="No output yet" description="Add a line for each grade this run produced." />
            )}

            <Field label="Waste bags" hint="Bags lost or unusable in this run">
              <NumberInput value={wasteBags} onChangeValue={setWasteBags} />
            </Field>
          </>
        )}
      </Body>

      <ActionBar>
        <Button label="Save" variant="outline" style={{ flex: 1 }} loading={update.isPending} disabled={!canUpdate} onPress={save} />
        <Button
          label="Complete lot"
          style={{ flex: 1.5 }}
          disabled={!canUpdate || outputs.length === 0}
          onPress={() => setConfirmComplete(true)}
        />
      </ActionBar>

      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.index === null ? 'Add output' : 'Edit output'}
        footer={
          <>
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setDraft(null)} />
            <Button label={draft?.index === null ? 'Add' : 'Save'} style={{ flex: 2 }} onPress={commitDraft} />
          </>
        }
      >
        {draft && (
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
            <Field label="Grade" required>
              <Select
                value={draft.output.grade_id}
                options={lookups.gradeOptionsFor(refId(selected?.commodity_id))}
                onChange={(grade_id) => setDraft({ ...draft, output: { ...draft.output, grade_id } })}
                title="Output grade"
              />
            </Field>

            <Field label="Bag configuration" required>
              <Select
                value={draft.output.bag_type_id}
                options={lookups.bagConfigOptions}
                onChange={(bag_type_id) => setDraft({ ...draft, output: { ...draft.output, bag_type_id } })}
                title="Bag configuration"
              />
            </Field>

            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="Bags" required style={{ flex: 1 }}>
                <NumberInput
                  value={draft.output.bags || ''}
                  onChangeValue={(bags) => setDraft({ ...draft, output: { ...draft.output, bags: Number(bags || 0) } })}
                />
              </Field>
              <Field label="Avg weight/bag" required style={{ flex: 1 }}>
                <NumberInput
                  value={draft.output.avg_weight_per_bag || ''}
                  onChangeValue={(value) =>
                    setDraft({ ...draft, output: { ...draft.output, avg_weight_per_bag: Number(value || 0) } })
                  }
                  suffix="kg"
                />
              </Field>
            </View>

            <Field label="Total value" hint="Value assigned to this output">
              <NumberInput
                value={draft.output.total_amount || ''}
                onChangeValue={(value) =>
                  setDraft({ ...draft, output: { ...draft.output, total_amount: Number(value || 0) } })
                }
                suffix="₹"
              />
            </Field>

            <Field label="Location" required>
              <Select
                value={draft.output.location_id}
                options={lookups.locationOptions}
                onChange={(location_id) =>
                  setDraft({ ...draft, output: { ...draft.output, location_id, sub_location_id: '' } })
                }
                title="Location"
              />
            </Field>

            <Field label="Sub-location" required>
              <Select
                value={draft.output.sub_location_id}
                options={lookups.subLocationOptionsFor(draft.output.location_id)}
                onChange={(sub_location_id) => setDraft({ ...draft, output: { ...draft.output, sub_location_id } })}
                title="Sub-location"
                placeholder={draft.output.location_id ? 'Select sub-location' : 'Pick a location first'}
                disabled={!draft.output.location_id}
              />
            </Field>

            <Field label="Date" required>
              <DateField
                value={draft.output.date}
                onChange={(date) => setDraft({ ...draft, output: { ...draft.output, date } })}
              />
            </Field>

            {draft.output.bags > 0 && draft.output.avg_weight_per_bag > 0 && (
              <Callout
                tone="success"
                icon="calculator-outline"
                title={`${formatWeight(draft.output.bags * draft.output.avg_weight_per_bag)} total`}
                description="Bags × average weight"
              />
            )}
          </ScrollView>
        )}
      </Sheet>

      <ConfirmSheet
        open={confirmComplete}
        onClose={() => setConfirmComplete(false)}
        onConfirm={doComplete}
        loading={complete.isPending || update.isPending}
        tone="primary"
        confirmLabel="Complete lot"
        title="Complete this lot?"
        description={
          unaccounted !== 0
            ? `${formatNumber(Math.abs(unaccounted))} bags are still unaccounted for. Completing anyway will book the output as it stands.`
            : 'The output will be booked into stock and the machine released. This cannot be undone.'
        }
      />
    </Screen>
  );
}
