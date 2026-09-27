import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useLot, useUpdateLot, type Lot, type LotOutput } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { EmptyState, Loading } from '@/components/ui/feedback';
import { Field, NumberInput } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { dayOf, localDay, outputWeight, outputsByGrade, outputsPayload } from '@/features/operations/lot';
import { useMasterLookups } from '@/features/operations/lookups';
import { usePermissions } from '@/hooks/use-permissions';
import { useSyncedState } from '@/hooks/use-synced-state';
import { formatCurrency, formatDate, formatNumber, refId, today } from '@/lib/format';
import { useTheme } from '@/theme';

interface Draft {
  grade_id: string;
  base_bag_type_id: string;
  bag_type_id: string;
  bags: number | '';
  avg_weight_per_bag: number | '';
  rate: number | '';
  location_id: string;
  sub_location_id: string;
  date: string;
}

type DraftKey = keyof Draft;

/**
 * One output of a lot — add or change. Saved straight to the lot, as the web
 * does, so the lot's output screen always shows what the server holds.
 */
export default function LotOutputFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { lot: lotId, index } = useLocalSearchParams<{ lot: string; index?: string }>();
  const position = index !== undefined && index !== '' ? Number(index) : null;
  const lookups = useMasterLookups();
  const { can } = usePermissions();
  const { data: lot, isLoading } = useLot(lotId);
  const update = useUpdateLot();
  const [error, setError] = useState<{ key: DraftKey; message: string } | null>(null);

  const current: LotOutput | undefined = position !== null ? lot?.outputs?.[position] : undefined;
  const configs = lookups.raw.bagTypeConfigs;

  const [draft, setDraft] = useSyncedState<Draft>(
    lot && configs.length ? `${lot._id}:${position ?? 'new'}` : null,
    () => {
      if (current) {
        const weight = outputWeight(current);
        const bagTypeId = refId(current.bag_type_id);
        return {
          grade_id: refId(current.grade_id),
          base_bag_type_id: configs.find((config) => config._id === bagTypeId)?.bag_type_id ?? '',
          bag_type_id: bagTypeId,
          bags: current.bags,
          avg_weight_per_bag: current.avg_weight_per_bag,
          rate: weight && current.total_amount ? Number((current.total_amount / weight).toFixed(2)) : '',
          location_id: refId(current.location_id),
          sub_location_id: current.sub_location_id,
          date: dayOf(current.date) || today(),
        };
      }
      // A new output starts where the last one was stored — usually the same place.
      const last = lot?.outputs?.[lot.outputs.length - 1];
      const lotDay = dayOf(lot?.date);
      return {
        grade_id: '',
        base_bag_type_id: '',
        bag_type_id: '',
        bags: '',
        avg_weight_per_bag: '',
        rate: '',
        location_id: last ? refId(last.location_id) : '',
        sub_location_id: last?.sub_location_id ?? '',
        date: lotDay && lotDay > today() ? lotDay : today(),
      };
    }
  );

  const set = <K extends DraftKey>(key: K, value: Draft[K], patch: Partial<Draft> = {}) => {
    setDraft((state) => ({ ...state, [key]: value, ...patch }));
    if (error?.key === key) setError(null);
  };

  if (isLoading || (lot && !configs.length && lookups.isLoading)) {
    return (
      <Screen>
        <Header title="Output" />
        <Loading label="Loading lot…" />
      </Screen>
    );
  }
  if (!lot || (position !== null && !current)) {
    return (
      <Screen>
        <Header title="Output" />
        <EmptyState icon="alert-circle-outline" title="Output not found" description="Open it again from the lot's output screen." />
      </Screen>
    );
  }
  if (lot.is_complete) {
    return (
      <Screen>
        <Header title={`Lot ${lot.lot_no}`} />
        <EmptyState icon="lock-closed-outline" title="This lot is complete" description="Its output can no longer change." />
      </Screen>
    );
  }

  const commodityId = refId(lot.commodity_id);
  const weight = Number(draft.bags || 0) * Number(draft.avg_weight_per_bag || 0);
  const value = weight * Number(draft.rate || 0);
  const lotDay = dayOf(lot.date);
  const gradeRate = outputsByGrade((lot.outputs ?? []).filter((_, i) => i !== position)).find(
    (grade) => grade.gradeId === draft.grade_id
  )?.ratePerKg;
  const createMaster = (module: string) =>
    can(`${module}:create`) ? () => router.push(`/masters/${module}/new` as never) : undefined;
  const errorFor = (key: DraftKey) => (error?.key === key ? error.message : undefined);

  const validate = (): { key: DraftKey; message: string } | null => {
    if (!draft.grade_id) return { key: 'grade_id', message: 'Select a grade' };
    if (!draft.bag_type_id) return { key: 'bag_type_id', message: 'Select a bag configuration' };
    if (!(Number(draft.bags) > 0)) return { key: 'bags', message: 'Enter the number of bags' };
    if (!(Number(draft.avg_weight_per_bag) > 0)) return { key: 'avg_weight_per_bag', message: 'Enter the weight per bag' };
    if (Number(draft.rate || 0) < 0) return { key: 'rate', message: 'The rate cannot be negative' };
    if (!draft.location_id) return { key: 'location_id', message: 'Select a location' };
    if (!draft.sub_location_id) return { key: 'sub_location_id', message: 'Select a sub-location' };
    if (lotDay && draft.date < lotDay) return { key: 'date', message: `Not before the lot date (${formatDate(lotDay)})` };
    return null;
  };

  const save = async () => {
    const failure = validate();
    if (failure) {
      setError(failure);
      toast.error(failure.message);
      return;
    }
    const output: LotOutput = {
      ...(current?._id ? { _id: current._id } : {}),
      grade_id: draft.grade_id,
      bag_type_id: draft.bag_type_id,
      bags: Math.floor(Number(draft.bags)),
      avg_weight_per_bag: Number(draft.avg_weight_per_bag),
      total_amount: Number(value.toFixed(2)),
      location_id: draft.location_id,
      sub_location_id: draft.sub_location_id,
      date: draft.date,
    };
    const outputs = [...(lot.outputs ?? [])];
    if (position !== null) outputs[position] = output;
    else outputs.push(output);
    try {
      await update.mutateAsync({ id: lot._id, data: { outputs: outputsPayload(outputs) } as Partial<Lot> });
      toast.success(position !== null ? 'Output updated' : 'Output added');
      router.back();
    } catch (err) {
      toast.error('Could not save the output', { description: getErrorMessage(err) });
    }
  };

  return (
    <Screen edges={['top']}>
      <Header
        title={position !== null ? 'Edit output' : 'Add output'}
        subtitle={`Lot ${lot.lot_no} · ${lookups.commodityName(commodityId)}`}
      />

      <Body bottomOffset={120}>
        <Card>
          <SectionHeader title="What came out" />
          <View style={{ gap: theme.spacing.lg }}>
            <Field label="Grade" required error={errorFor('grade_id')}>
              <Select
                value={draft.grade_id}
                options={lookups.gradeOptionsFor(commodityId)}
                onChange={(grade_id) => set('grade_id', grade_id)}
                title="Grade"
                error={Boolean(errorFor('grade_id'))}
                onCreate={createMaster('grade')}
                createLabel="Add grade"
              />
            </Field>
            <Field label="Bag type" required>
              <Select
                value={draft.base_bag_type_id}
                options={lookups.bagTypeOptions}
                onChange={(base_bag_type_id) => set('base_bag_type_id', base_bag_type_id, { bag_type_id: '' })}
                title="Bag type"
                onCreate={createMaster('bag-type')}
                createLabel="Add bag type"
              />
            </Field>
            <Field label="Bag configuration" required error={errorFor('bag_type_id')}>
              <Select
                value={draft.bag_type_id}
                options={lookups.bagConfigOptionsFor(draft.base_bag_type_id)}
                onChange={(bag_type_id) => set('bag_type_id', bag_type_id)}
                title="Bag configuration"
                placeholder={draft.base_bag_type_id ? 'Select configuration' : 'Pick a bag type first'}
                disabled={!draft.base_bag_type_id}
                error={Boolean(errorFor('bag_type_id'))}
                onCreate={createMaster('bag-type-config')}
                createLabel="Add bag configuration"
              />
            </Field>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="Bags" required error={errorFor('bags')} style={{ flex: 1 }}>
                <NumberInput
                  value={draft.bags}
                  keyboardType="number-pad"
                  onChangeValue={(bags) => set('bags', bags === '' ? '' : Math.max(0, Math.floor(Number(bags))))}
                  error={Boolean(errorFor('bags'))}
                />
              </Field>
              <Field label="Weight per bag" required error={errorFor('avg_weight_per_bag')} style={{ flex: 1.2 }}>
                <NumberInput
                  value={draft.avg_weight_per_bag}
                  onChangeValue={(avg) => set('avg_weight_per_bag', avg)}
                  suffix="kg"
                  error={Boolean(errorFor('avg_weight_per_bag'))}
                />
              </Field>
            </View>
            <Text variant="caption" tone="muted" numeric>
              Total weight {formatNumber(weight, 2)} kg
            </Text>
          </View>
        </Card>

        <Card>
          <SectionHeader title="Value" caption="Can also be set per grade later" />
          <View style={{ gap: theme.spacing.md }}>
            <Field
              label="Rate"
              error={errorFor('rate')}
              hint={
                gradeRate
                  ? `Other outputs of this grade are at ${formatCurrency(gradeRate)}/kg`
                  : lot.avg_input_rate
                    ? `Input averaged ${formatCurrency(lot.avg_input_rate)}/kg`
                    : undefined
              }
            >
              <NumberInput value={draft.rate} onChangeValue={(rate) => set('rate', rate)} suffix="₹/kg" />
            </Field>
            {!!gradeRate && draft.rate === '' && (
              <Button
                label={`Use ${formatCurrency(gradeRate)}/kg`}
                variant="outline"
                icon="copy-outline"
                onPress={() => set('rate', Number(gradeRate.toFixed(2)))}
              />
            )}
            <Text variant="caption" tone="muted" numeric>
              Value {formatCurrency(value)}
            </Text>
          </View>
        </Card>

        <Card>
          <SectionHeader title="Stored at" />
          <View style={{ gap: theme.spacing.lg }}>
            <Field label="Location" required error={errorFor('location_id')}>
              <Select
                value={draft.location_id}
                options={lookups.locationOptions}
                onChange={(location_id) => set('location_id', location_id, { sub_location_id: '' })}
                title="Warehouse location"
                error={Boolean(errorFor('location_id'))}
                onCreate={createMaster('warehouse-location')}
                createLabel="Add warehouse"
              />
            </Field>
            <Field label="Sub-location" required error={errorFor('sub_location_id')}>
              <Select
                value={draft.sub_location_id}
                options={lookups.subLocationOptionsFor(draft.location_id)}
                onChange={(sub_location_id) => set('sub_location_id', sub_location_id)}
                title="Sub-location"
                placeholder={draft.location_id ? 'Select sub-location' : 'Pick a location first'}
                disabled={!draft.location_id}
                error={Boolean(errorFor('sub_location_id'))}
              />
            </Field>
            <Field label="Date" error={errorFor('date')} hint={lotDay ? `Not before ${formatDate(lotDay)}` : undefined}>
              <DateField
                value={draft.date}
                onChange={(date) => set('date', date)}
                minimumDate={localDay(lotDay)}
                error={Boolean(errorFor('date'))}
              />
            </Field>
          </View>
        </Card>
      </Body>

      <ActionBar>
        <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
        <Button
          label={position !== null ? 'Save output' : 'Add output'}
          style={{ flex: 2 }}
          loading={update.isPending}
          onPress={save}
        />
      </ActionBar>
    </Screen>
  );
}
