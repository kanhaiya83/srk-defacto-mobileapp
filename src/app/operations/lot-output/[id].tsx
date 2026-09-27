import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useCompleteLot, useLot, useUpdateLot, type Lot, type LotOutput } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ActionSheet } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { ErrorState, Loading } from '@/components/ui/feedback';
import { Field, NumberInput } from '@/components/ui/field';
import { Callout, DetailRow } from '@/components/ui/misc';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet, Sheet, SheetBody } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import {
  balanceOutputs,
  lotBalance,
  outputWeight,
  outputsByGrade,
  outputsPayload,
  priceGrade,
} from '@/features/operations/lot';
import { LotBalanceCard } from '@/features/operations/lot-balance';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatCurrency, formatDate, formatNumber, refId } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * A lot's output — what the run produced, priced so its value matches the
 * input, then completed. Every change is saved as it is made, as on the web.
 */
export default function LotOutputScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lookups = useMasterLookups();
  const { canUpdate } = useModulePermissions('lot');
  const { data: lot, isLoading, isError, error, refetch } = useLot(id);
  const update = useUpdateLot();
  const complete = useCompleteLot();

  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [deleteFor, setDeleteFor] = useState<number | null>(null);
  const [rateFor, setRateFor] = useState<{ gradeId: string; rate: number | '' } | null>(null);
  const [waste, setWaste] = useState<number | '' | null>(null);
  const [balancing, setBalancing] = useState(false);
  const [completing, setCompleting] = useState(false);

  if (isLoading) {
    return (
      <Screen>
        <Header title="Lot output" />
        <Loading label="Loading lot…" />
      </Screen>
    );
  }
  if (isError || !lot) {
    return (
      <Screen>
        <Header title="Lot output" />
        <ErrorState message={error ? getErrorMessage(error) : 'Lot not found'} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const outputs = lot.outputs ?? [];
  const balance = lotBalance(lot);
  const grades = outputsByGrade(outputs);
  const editable = canUpdate && !lot.is_complete;
  const balanced = balanceOutputs(outputs, balance.inputAmount);
  const heaviest = grades.reduce<(typeof grades)[number] | null>((best, grade) => (!best || grade.weight > best.weight ? grade : best), null);

  const save = async (next: LotOutput[], wasteBags = lot.waste_bags || 0) => {
    try {
      await update.mutateAsync({
        id: lot._id,
        data: { outputs: outputsPayload(next), waste_bags: wasteBags } as Partial<Lot>,
      });
      return true;
    } catch (err) {
      toast.error('Could not save the output', { description: getErrorMessage(err) });
      return false;
    }
  };

  const editOutput = (index: number) => router.push(`/operations/lot-output/output?lot=${lot._id}&index=${index}` as never);

  return (
    <Screen edges={['top']}>
      <Header
        title={`Lot ${lot.lot_no} output`}
        subtitle={[lookups.commodityName(refId(lot.commodity_id)), lookups.machineName(refId(lot.machine_id)), formatDate(lot.date)]
          .filter((part) => part && part !== '—')
          .join(' · ')}
      />

      <Body>
        {lot.is_complete && (
          <Callout tone="success" icon="checkmark-done-outline" title="This lot is complete" description="Its output is in stock and can no longer change." />
        )}

        <Card>
          <SectionHeader title="Input" caption={`${lot.inputs?.length ?? 0} from the pre-lot`} />
          <DetailRow label="Bags" value={formatNumber(balance.inputBags)} />
          <DetailRow label="Weight" value={`${formatNumber(balance.inputWeight, 2)} kg`} />
          <DetailRow label="Value" value={formatCurrency(balance.inputAmount)} emphasis />
          <DetailRow label="Average rate" value={balance.inputWeight ? `${formatCurrency(balance.inputAmount / balance.inputWeight)}/kg` : null} />
        </Card>

        <SectionHeader
          title="Outputs"
          caption={outputs.length ? `${formatNumber(balance.outputBags)} bags · ${formatNumber(balance.outputWeight, 2)} kg` : 'None yet'}
        />
        {outputs.length === 0 && (
          <Text variant="caption" tone="muted">
            Add each grade the run produced, with its bags and where they are stored.
          </Text>
        )}
        {outputs.map((output, index) => {
          const weight = outputWeight(output);
          return (
            <RecordCard
              key={output._id ?? index}
              title={lookups.gradeName(refId(output.grade_id))}
              subtitle={[
                lookups.bagConfigName(refId(output.bag_type_id)),
                `${lookups.locationName(refId(output.location_id))} / ${lookups.subLocationName(refId(output.location_id), output.sub_location_id)}`,
                formatDate(output.date),
              ].join(' · ')}
              badge={output.total_amount ? undefined : { label: 'No rate', tone: 'warning' }}
              fields={[
                { label: 'Bags', value: `${formatNumber(output.bags)} × ${formatNumber(output.avg_weight_per_bag, 2)} kg`, emphasis: true },
                { label: 'Weight', value: `${formatNumber(weight, 2)} kg` },
                { label: 'Value', value: formatCurrency(output.total_amount) },
                { label: 'Rate', value: weight ? `${formatCurrency((output.total_amount || 0) / weight)}/kg` : null },
              ]}
              onPress={editable ? () => editOutput(index) : undefined}
              onMenu={editable ? () => setMenuFor(index) : undefined}
            />
          );
        })}
        {editable && (
          <Button
            label="Add output"
            icon="add"
            variant="outline"
            fullWidth
            onPress={() => router.push(`/operations/lot-output/output?lot=${lot._id}` as never)}
          />
        )}

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Waste bags</Text>
              <Text variant="caption" tone="muted">
                Bags discarded in the run
              </Text>
            </View>
            <Text variant="bodyStrong" numeric>
              {formatNumber(lot.waste_bags || 0)}
            </Text>
            {editable && <Button label="Change" size="sm" variant="outline" onPress={() => setWaste(lot.waste_bags || 0)} />}
          </View>
        </Card>

        {grades.length > 0 && (
          <>
            <SectionHeader title="By grade" caption={editable ? 'Tap a grade to set its rate' : 'Share of the input weight'} />
            {grades.map((grade) => (
              <RecordCard
                key={grade.gradeId}
                title={lookups.gradeName(grade.gradeId)}
                badge={{
                  label: `${formatNumber(balance.inputWeight ? (grade.weight / balance.inputWeight) * 100 : 0, 1)}% of input`,
                  tone: 'info',
                }}
                fields={[
                  { label: 'Rate', value: `${formatCurrency(grade.ratePerKg)}/kg`, emphasis: true },
                  { label: 'Value', value: formatCurrency(grade.amount) },
                  { label: 'Bags', value: formatNumber(grade.bags) },
                  { label: 'Weight', value: `${formatNumber(grade.weight, 2)} kg` },
                ]}
                onPress={editable ? () => setRateFor({ gradeId: grade.gradeId, rate: Number(grade.ratePerKg.toFixed(2)) || '' }) : undefined}
              />
            ))}
            {editable && (
              <Button
                label="Balance value to input"
                icon="color-wand-outline"
                variant="outline"
                fullWidth
                disabled={'error' in balanced}
                onPress={() => setBalancing(true)}
              />
            )}
          </>
        )}

        <LotBalanceCard balance={balance} complete={lot.is_complete} />
      </Body>

      {editable && (
        <ActionBar
          summary={
            balance.blocker ? (
              <Text variant="caption" tone="warning">
                {balance.blocker}
              </Text>
            ) : (
              <Badge label="Ready to complete" tone="success" />
            )
          }
        >
          <Button
            label="Complete lot"
            icon="checkmark-done-outline"
            style={{ flex: 1 }}
            disabled={balance.blocker !== null}
            onPress={() => setCompleting(true)}
          />
        </ActionBar>
      )}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor !== null ? lookups.gradeName(refId(outputs[menuFor]?.grade_id)) : undefined}
        actions={[
          { label: 'Edit', icon: 'create-outline', onPress: () => menuFor !== null && editOutput(menuFor) },
          { label: 'Delete', icon: 'trash-outline', tone: 'danger', onPress: () => setDeleteFor(menuFor) },
        ]}
      />

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        loading={update.isPending}
        title="Delete this output?"
        description={
          deleteFor !== null && outputs[deleteFor]
            ? `${formatNumber(outputs[deleteFor].bags)} bags of ${lookups.gradeName(refId(outputs[deleteFor].grade_id))} will be taken out of stock.`
            : undefined
        }
        onConfirm={async () => {
          if (deleteFor === null) return;
          if (await save(outputs.filter((_, index) => index !== deleteFor))) {
            toast.success('Output deleted');
            setDeleteFor(null);
          }
        }}
      />

      <Sheet
        open={rateFor !== null}
        onClose={() => setRateFor(null)}
        title={rateFor ? lookups.gradeName(rateFor.gradeId) : undefined}
        subtitle="One rate for every output of this grade"
        footer={
          <>
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setRateFor(null)} />
            <Button
              label="Save rate"
              style={{ flex: 2 }}
              loading={update.isPending}
              onPress={async () => {
                if (!rateFor) return;
                const rate = Number(rateFor.rate || 0);
                if (rate < 0) return toast.error('The rate cannot be negative');
                if (await save(priceGrade(outputs, rateFor.gradeId, rate))) {
                  toast.success('Rate saved');
                  setRateFor(null);
                }
              }}
            />
          </>
        }
      >
        {rateFor && (
          <SheetBody>
            <Field label="Rate">
              <NumberInput value={rateFor.rate} onChangeValue={(rate) => setRateFor({ ...rateFor, rate })} suffix="₹/kg" autoFocus />
            </Field>
            <Text variant="caption" tone="muted" numeric>
              {(() => {
                const grade = grades.find((row) => row.gradeId === rateFor.gradeId);
                return grade ? `${formatNumber(grade.weight, 2)} kg → ${formatCurrency(grade.weight * Number(rateFor.rate || 0))}` : '';
              })()}
            </Text>
          </SheetBody>
        )}
      </Sheet>

      <Sheet
        open={waste !== null}
        onClose={() => setWaste(null)}
        title="Waste bags"
        subtitle={`Lot ${lot.lot_no}`}
        footer={
          <>
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setWaste(null)} />
            <Button
              label="Save"
              style={{ flex: 2 }}
              loading={update.isPending}
              onPress={async () => {
                const bags = Math.max(0, Math.floor(Number(waste || 0)));
                if (await save(outputs, bags)) {
                  toast.success('Waste bags saved');
                  setWaste(null);
                }
              }}
            />
          </>
        }
      >
        {waste !== null && (
          <SheetBody>
            <Field label="Waste bags">
              <NumberInput value={waste} onChangeValue={setWaste} keyboardType="number-pad" autoFocus />
            </Field>
          </SheetBody>
        )}
      </Sheet>

      <ConfirmSheet
        open={balancing}
        onClose={() => setBalancing(false)}
        loading={update.isPending}
        tone="primary"
        confirmLabel="Balance"
        title="Balance the output value?"
        description={
          heaviest && !('error' in balanced)
            ? `${lookups.gradeName(heaviest.gradeId)}, the heaviest grade, will be re-priced so the output is worth ${formatCurrency(balance.inputAmount)} — the same as the input.`
            : 'error' in balanced
              ? balanced.error
              : undefined
        }
        onConfirm={async () => {
          if ('error' in balanced) return toast.error(balanced.error);
          if (await save(balanced.outputs)) {
            toast.success('Output value balanced');
            setBalancing(false);
          }
        }}
      />

      <ConfirmSheet
        open={completing}
        onClose={() => setCompleting(false)}
        loading={complete.isPending}
        tone="primary"
        confirmLabel="Complete lot"
        title={`Complete lot ${lot.lot_no}?`}
        description="Its inputs and output are locked, whatever its pre-lot still holds unused goes back to stock (no further lot can draw on it), and the machine is freed. This cannot be undone."
        onConfirm={async () => {
          try {
            await complete.mutateAsync(lot._id);
            toast.success(`Lot ${lot.lot_no} completed`);
            setCompleting(false);
          } catch (err) {
            toast.error('Could not complete the lot', { description: getErrorMessage(err) });
          }
        }}
      />
    </Screen>
  );
}
