import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import {
  useCreateSaleOrder,
  useSaleOrders,
  useUpdateSaleOrder,
  type SaleOrder,
  type SaleOrderOrder,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Button, IconButton } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Loading } from '@/components/ui/feedback';
import { Field, NumberInput } from '@/components/ui/field';
import { Callout, DetailRow } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { useSyncedState } from '@/hooks/use-synced-state';
import { formatCurrency, formatNumber, refId, today } from '@/lib/format';
import { useTheme } from '@/theme';

interface Line {
  commodity_id: string;
  grade_id: string;
  bags: number;
  total_weight: number;
  rate: number;
}

const blankLine = (): Line => ({ commodity_id: '', grade_id: '', bags: 0, total_weight: 0, rate: 0 });

/**
 * Sale order — create and edit.
 *
 * Lines are composed in a sheet and then committed to the order, which keeps
 * the main screen a readable summary rather than a wall of inputs, and makes
 * "add another of the same" a two-field edit.
 */
export default function SaleOrderFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const lookups = useMasterLookups();
  const list = useSaleOrders();
  const create = useCreateSaleOrder();
  const update = useUpdateSaleOrder();

  const [draft, setDraft] = useState<Line | null>(null);
  const [draftIndex, setDraftIndex] = useState<number | null>(null);

  const editItem = useMemo(
    () => (isEdit ? (list.data ?? []).find((order) => order._id === id) : undefined),
    [isEdit, id, list.data]
  );

  const [order, setOrder] = useSyncedState<{
    date: string;
    deliveryBy: string;
    vendorId: string;
    lines: Line[];
  }>(isEdit ? (editItem?._id ?? null) : 'new', () => ({
    date: editItem?.date ? String(editItem.date).slice(0, 10) : today(),
    deliveryBy: editItem?.delivery_by_date ? String(editItem.delivery_by_date).slice(0, 10) : '',
    vendorId: refId(editItem?.vendor_id),
    lines: (editItem?.orders ?? []).map((line) => ({
      commodity_id: refId(line.commodity_id),
      grade_id: refId(line.grade_id),
      bags: line.bags,
      total_weight: line.total_weight,
      rate: line.rate,
    })),
  }));

  const { date, deliveryBy, vendorId, lines } = order;
  const setDate = (value: string) => setOrder((current) => ({ ...current, date: value }));
  const setDeliveryBy = (value: string) => setOrder((current) => ({ ...current, deliveryBy: value }));
  const setVendorId = (value: string) => setOrder((current) => ({ ...current, vendorId: value }));
  const setLines = (next: Line[] | ((current: Line[]) => Line[])) =>
    setOrder((current) => ({ ...current, lines: typeof next === 'function' ? next(current.lines) : next }));

  const totals = lines.reduce(
    (acc, line) => ({
      bags: acc.bags + line.bags,
      weight: acc.weight + line.total_weight,
      value: acc.value + line.total_weight * line.rate,
    }),
    { bags: 0, weight: 0, value: 0 }
  );

  const commitDraft = () => {
    if (!draft) return;
    if (!draft.commodity_id) return toast.error('Select a commodity');
    if (!draft.grade_id) return toast.error('Select a grade');
    if (!draft.bags || draft.bags <= 0) return toast.error('Enter a valid number of bags');
    if (!draft.total_weight || draft.total_weight <= 0) return toast.error('Enter a valid weight');
    if (!draft.rate || draft.rate <= 0) return toast.error('Enter a valid rate');

    setLines((current) =>
      draftIndex === null ? [...current, draft] : current.map((line, index) => (index === draftIndex ? draft : line))
    );
    setDraft(null);
    setDraftIndex(null);
  };

  const submit = async () => {
    if (!vendorId) return toast.error('Select a customer');
    if (lines.length === 0) return toast.error('Add at least one order line');

    const payload = {
      date,
      delivery_by_date: deliveryBy || undefined,
      vendor_id: vendorId,
      is_completed: editItem?.is_completed ?? false,
      orders: lines as unknown as SaleOrderOrder[],
    } as unknown as Omit<SaleOrder, '_id' | 'order_no' | 'createdAt' | 'updatedAt'>;

    try {
      if (editItem) {
        await update.mutateAsync({ id: editItem._id, data: payload });
        toast.success('Sale order updated');
      } else {
        await create.mutateAsync(payload);
        toast.success('Sale order created');
      }
      router.back();
    } catch (error) {
      toast.error(editItem ? 'Could not update the order' : 'Could not create the order', {
        description: getErrorMessage(error),
      });
    }
  };

  if (isEdit && list.isLoading) {
    return (
      <Screen>
        <Header title="Sale order" />
        <Loading label="Loading order…" />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <Header
        title={isEdit ? `Edit order ${editItem?.order_no ?? ''}` : 'New sale order'}
        subtitle="What the customer has committed to buy"
      />

      <Body>
        <Card>
          <SectionHeader title="Order" />
          <View style={{ gap: theme.spacing.lg }}>
            <Field label="Customer" required>
              <Select value={vendorId} options={lookups.vendorOptions} onChange={setVendorId} title="Customer" />
            </Field>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="Order date" required style={{ flex: 1 }}>
                <DateField value={date} onChange={setDate} />
              </Field>
              <Field label="Deliver by" style={{ flex: 1 }}>
                <DateField value={deliveryBy} onChange={setDeliveryBy} placeholder="Optional" clearable />
              </Field>
            </View>
          </View>
        </Card>

        <SectionHeader
          title="Order lines"
          caption={lines.length ? `${lines.length} line${lines.length === 1 ? '' : 's'}` : 'Nothing added yet'}
          action={
            <Button
              label="Add line"
              icon="add"
              size="sm"
              variant="outline"
              onPress={() => {
                setDraft(blankLine());
                setDraftIndex(null);
              }}
            />
          }
        />

        {lines.length === 0 && (
          <Callout tone="info" title="No lines yet" description="Add what the customer ordered, grade by grade." />
        )}

        <Animated.View layout={LinearTransition.duration(180)} style={{ gap: theme.spacing.md }}>
          {lines.map((line, index) => (
            <Animated.View key={index} entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)}>
              <Card
                onPress={() => {
                  setDraft(line);
                  setDraftIndex(index);
                }}
              >
                <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">
                      {lookups.commodityName(line.commodity_id)} · {lookups.gradeName(line.grade_id)}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {formatNumber(line.bags)} bags · {formatNumber(line.total_weight)} kg
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text variant="bodyStrong" tone="primary" numeric>
                      {formatCurrency(line.total_weight * line.rate)}
                    </Text>
                    <Text variant="caption" tone="faint" numeric>
                      @ {formatCurrency(line.rate)}/kg
                    </Text>
                  </View>
                  <IconButton
                    icon="trash-outline"
                    tone="danger"
                    accessibilityLabel={`Remove line ${index + 1}`}
                    onPress={() => setLines((current) => current.filter((_, i) => i !== index))}
                  />
                </View>
              </Card>
            </Animated.View>
          ))}
        </Animated.View>

        {lines.length > 0 && (
          <Card>
            <SectionHeader title="Totals" />
            <DetailRow label="Total bags" value={formatNumber(totals.bags)} />
            <DetailRow label="Total weight" value={`${formatNumber(totals.weight)} kg`} />
            <DetailRow label="Order value" value={formatCurrency(totals.value)} emphasis />
          </Card>
        )}
      </Body>

      <ActionBar>
        <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
        <Button
          label={isEdit ? 'Save changes' : 'Create order'}
          style={{ flex: 2 }}
          loading={create.isPending || update.isPending}
          onPress={submit}
        />
      </ActionBar>

      <Sheet
        open={draft !== null}
        onClose={() => {
          setDraft(null);
          setDraftIndex(null);
        }}
        title={draftIndex === null ? 'Add order line' : 'Edit order line'}
        footer={
          <>
            <Button
              label="Cancel"
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => {
                setDraft(null);
                setDraftIndex(null);
              }}
            />
            <Button label={draftIndex === null ? 'Add line' : 'Save line'} style={{ flex: 2 }} onPress={commitDraft} />
          </>
        }
      >
        {draft && (
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
            <Field label="Commodity" required>
              <Select
                value={draft.commodity_id}
                options={lookups.commodityOptions}
                onChange={(value) => setDraft({ ...draft, commodity_id: value, grade_id: '' })}
                title="Commodity"
              />
            </Field>
            <Field label="Grade" required>
              <Select
                value={draft.grade_id}
                options={lookups.gradeOptionsFor(draft.commodity_id)}
                onChange={(value) => setDraft({ ...draft, grade_id: value })}
                title="Grade"
                placeholder={draft.commodity_id ? 'Select grade' : 'Pick a commodity first'}
                disabled={!draft.commodity_id}
              />
            </Field>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="Bags" required style={{ flex: 1 }}>
                <NumberInput value={draft.bags || ''} onChangeValue={(value) => setDraft({ ...draft, bags: Number(value || 0) })} />
              </Field>
              <Field label="Total weight" required style={{ flex: 1 }}>
                <NumberInput
                  value={draft.total_weight || ''}
                  onChangeValue={(value) => setDraft({ ...draft, total_weight: Number(value || 0) })}
                  suffix="kg"
                />
              </Field>
            </View>
            <Field label="Rate" required hint="Per kilogram">
              <NumberInput value={draft.rate || ''} onChangeValue={(value) => setDraft({ ...draft, rate: Number(value || 0) })} suffix="₹/kg" />
            </Field>

            {draft.total_weight > 0 && draft.rate > 0 && (
              <Callout
                tone="success"
                icon="calculator-outline"
                title={`Line value ${formatCurrency(draft.total_weight * draft.rate)}`}
                description="Weight × rate"
              />
            )}
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
