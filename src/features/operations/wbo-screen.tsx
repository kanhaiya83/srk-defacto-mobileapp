import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  useCreateOutwardWeighBridgeEntry,
  useDeleteOutwardWeighBridgeEntry,
  useOutwardWeighBridgeEntries,
  useOutwards,
  useUpdateOutwardWeighBridgeEntry,
  type OutwardWeighBridgeEntry,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ActionSheet, Fab, ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Field, Input, NumberInput } from '@/components/ui/field';
import { Callout } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet, Sheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import {
  dedupeByVehicle,
  formatVehicleNumber,
  isValidVehicleNumber,
  toVehicleRecord,
  VEHICLE_FORMAT_HINT,
} from '@/features/operations/vehicle';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatDate, formatNumber, refId, today } from '@/lib/format';
import { useTheme } from '@/theme';

interface FormState {
  id?: string;
  wbo_id: string;
  date: string;
  vehicle_no: string;
  driver_name: string;
  mobile_no: string;
  drivers_license_no: string;
  rc_copy_no: string;
  empty_weight: number | '';
  weight_fully_loaded: number | '';
  outward_id: string;
}

/**
 * Outward weigh bridge, in two phases.
 *
 * `empty` weighs the vehicle in before loading; `loaded` weighs it again on the
 * way out and ties it to the dispatch it is carrying. One component serves both
 * because the record is the same — only which half is editable changes.
 */
export function WboScreen({ mode }: { mode: 'empty' | 'loaded' }) {
  const theme = useTheme();
  const lookups = useMasterLookups();
  const list = useOutwardWeighBridgeEntries();
  const outwards = useOutwards();
  const create = useCreateOutwardWeighBridgeEntry();
  const update = useUpdateOutwardWeighBridgeEntry();
  const remove = useDeleteOutwardWeighBridgeEntry();
  const { canCreate, canUpdate, canDelete } = useModulePermissions('wbo');

  const [form, setForm] = useState<FormState | null>(null);
  const [menuFor, setMenuFor] = useState<OutwardWeighBridgeEntry | null>(null);
  const [deleteFor, setDeleteFor] = useState<OutwardWeighBridgeEntry | null>(null);

  const entries = list.data ?? [];
  const isLoadedPhase = mode === 'loaded';

  const hasLoaded = (entry: OutwardWeighBridgeEntry) =>
    Boolean(entry.weight_fully_loaded && entry.weight_fully_loaded > 0);

  const visible = useMemo(
    // The loaded screen is a worklist: vehicles still to be weighed out first.
    () => (isLoadedPhase ? [...entries].sort((a, b) => Number(hasLoaded(a)) - Number(hasLoaded(b))) : entries),
    [entries, isLoadedPhase]
  );

  const pendingCount = entries.filter((entry) => !hasLoaded(entry)).length;

  const vehicleHistory = useMemo(() => dedupeByVehicle(entries.map(toVehicleRecord)), [entries]);

  const search = useCallback(
    (entry: OutwardWeighBridgeEntry) => [entry.wbo_id, entry.vehicle_no, entry.driver_name, entry.mobile_no],
    []
  );

  const openCreate = () => {
    const maxId = entries.reduce((max, entry) => {
      const parsed = parseInt(entry.wbo_id || '0', 10);
      return !Number.isNaN(parsed) && parsed > max ? parsed : max;
    }, 0);
    setForm({
      wbo_id: String(maxId + 1),
      date: today(),
      vehicle_no: '',
      driver_name: '',
      mobile_no: '',
      drivers_license_no: '',
      rc_copy_no: '',
      empty_weight: '',
      weight_fully_loaded: '',
      outward_id: '',
    });
  };

  const openEdit = (entry: OutwardWeighBridgeEntry) =>
    setForm({
      id: entry._id,
      wbo_id: entry.wbo_id,
      date: entry.date ? String(entry.date).slice(0, 10) : today(),
      vehicle_no: entry.vehicle_no ?? '',
      driver_name: entry.driver_name ?? '',
      mobile_no: entry.mobile_no ?? '',
      drivers_license_no: entry.drivers_license_no ?? '',
      rc_copy_no: entry.rc_copy_no ?? '',
      empty_weight: entry.empty_weight ?? '',
      weight_fully_loaded: entry.weight_fully_loaded ?? '',
      outward_id: refId(entry.outward_id),
    });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const netWeight =
    form && form.weight_fully_loaded !== '' && form.empty_weight !== ''
      ? Number(form.weight_fully_loaded) - Number(form.empty_weight)
      : null;

  const submit = async () => {
    if (!form) return;
    if (form.vehicle_no && !isValidVehicleNumber(form.vehicle_no)) {
      return toast.error(`Invalid vehicle number. ${VEHICLE_FORMAT_HINT}`);
    }
    if (!isLoadedPhase && (form.empty_weight === '' || Number(form.empty_weight) <= 0)) {
      return toast.error('Empty weight must be greater than zero');
    }
    if (isLoadedPhase) {
      if (!form.outward_id) return toast.error('Select the outward this vehicle is carrying');
      if (form.weight_fully_loaded === '' || Number(form.weight_fully_loaded) <= 0) {
        return toast.error('Loaded weight must be greater than zero');
      }
      if (Number(form.weight_fully_loaded) <= Number(form.empty_weight)) {
        return toast.error('Loaded weight must be greater than the empty weight');
      }
    }

    const payload = {
      wbo_id: form.wbo_id,
      date: form.date,
      vehicle_no: form.vehicle_no ? formatVehicleNumber(form.vehicle_no) : '',
      driver_name: form.driver_name,
      mobile_no: form.mobile_no,
      drivers_license_no: form.drivers_license_no,
      rc_copy_no: form.rc_copy_no,
      empty_weight: form.empty_weight === '' ? undefined : Number(form.empty_weight),
      weight_fully_loaded: form.weight_fully_loaded === '' ? undefined : Number(form.weight_fully_loaded),
      net_weight: netWeight ?? undefined,
      outward_id: form.outward_id || undefined,
      images: [],
      is_mutable: true,
      is_deletable: true,
    };

    try {
      if (form.id) {
        await update.mutateAsync({ id: form.id, data: payload as Partial<OutwardWeighBridgeEntry> });
        toast.success('Weigh bridge entry updated');
      } else {
        await create.mutateAsync(payload as Omit<OutwardWeighBridgeEntry, '_id' | 'createdAt' | 'updatedAt'>);
        toast.success('Vehicle weighed in', { description: `WBO ${form.wbo_id}` });
      }
      setForm(null);
    } catch (error) {
      toast.error('Could not save the entry', { description: getErrorMessage(error) });
    }
  };

  const handleDelete = async () => {
    if (!deleteFor) return;
    try {
      await remove.mutateAsync(deleteFor._id);
      toast.success('Entry deleted');
      setDeleteFor(null);
    } catch (error) {
      toast.error('Could not delete the entry', { description: getErrorMessage(error) });
    }
  };

  return (
    <Screen>
      <Header
        title={isLoadedPhase ? 'WBO Loaded' : 'WBO Empty'}
        subtitle={
          isLoadedPhase
            ? pendingCount > 0
              ? `${pendingCount} vehicles awaiting loaded weight`
              : 'All vehicles weighed out'
            : 'Vehicles weighed in before loading'
        }
      />

      <ListBody<OutwardWeighBridgeEntry>
        items={visible}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={search}
        searchPlaceholder="Search WBO, vehicle, driver…"
        sortable={!isLoadedPhase}
        emptyTitle="No outward weigh-ins yet"
        emptyDescription="Weigh the empty vehicle in before it is loaded."
        emptyActionLabel={canCreate && !isLoadedPhase ? 'Weigh in' : undefined}
        onEmptyAction={canCreate && !isLoadedPhase ? openCreate : undefined}
        renderItem={(item) => {
          const loaded = hasLoaded(item);
          return (
            <RecordCard
              title={`WBO ${item.wbo_id}`}
              subtitle={`${item.vehicle_no || 'No vehicle'} · ${formatDate(item.date)}`}
              badge={{ label: loaded ? 'Weighed out' : 'Awaiting load', tone: loaded ? 'success' : 'warning' }}
              accent={loaded ? undefined : 'warning'}
              fields={[
                { label: 'Empty', value: item.empty_weight ? `${formatNumber(item.empty_weight)} kg` : null },
                { label: 'Loaded', value: item.weight_fully_loaded ? `${formatNumber(item.weight_fully_loaded)} kg` : null },
                { label: 'Net', value: item.net_weight ? `${formatNumber(item.net_weight)} kg` : null, emphasis: true },
                { label: 'Driver', value: item.driver_name },
              ]}
              onPress={canUpdate ? () => openEdit(item) : undefined}
              onMenu={() => setMenuFor(item)}
              footer={
                isLoadedPhase && !loaded ? (
                  <Button
                    label="Record loaded weight"
                    icon="scale-outline"
                    size="sm"
                    fullWidth
                    disabled={!canUpdate}
                    onPress={() => openEdit(item)}
                  />
                ) : undefined
              }
            />
          );
        }}
      />

      {canCreate && !isLoadedPhase && <Fab label="Weigh in" onPress={openCreate} />}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? `WBO ${menuFor.wbo_id}` : undefined}
        actions={[
          {
            label: 'Edit',
            icon: 'create-outline',
            disabled: !canUpdate || !menuFor?.is_mutable,
            disabledReason: 'Locked — linked to a dispatch',
            onPress: () => menuFor && openEdit(menuFor),
          },
          {
            label: 'Delete',
            icon: 'trash-outline',
            tone: 'danger',
            disabled: !canDelete || !menuFor?.is_deletable,
            disabledReason: 'Locked — linked to a dispatch',
            onPress: () => menuFor && setDeleteFor(menuFor),
          },
        ]}
      />

      <Sheet
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? `WBO ${form.wbo_id}` : 'New outward weigh-in'}
        subtitle={isLoadedPhase ? 'Record the loaded weight and dispatch' : 'Empty vehicle arriving to load'}
        footer={
          <>
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setForm(null)} />
            <Button
              label={form?.id ? 'Save' : 'Create'}
              style={{ flex: 2 }}
              loading={create.isPending || update.isPending}
              onPress={submit}
            />
          </>
        }
      >
        {form && (
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="WBO ID" style={{ flex: 1 }}>
                <Input value={form.wbo_id} readOnly />
              </Field>
              <Field label="Date" required style={{ flex: 1.4 }}>
                <DateField value={form.date} onChange={(date) => set('date', date)} />
              </Field>
            </View>

            <Field label="Vehicle no" hint={VEHICLE_FORMAT_HINT}>
              <Input
                value={form.vehicle_no}
                onChangeText={(value) => set('vehicle_no', value)}
                onBlur={() => set('vehicle_no', formatVehicleNumber(form.vehicle_no))}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="RJ-14-CA-1234"
              />
            </Field>

            {vehicleHistory.length > 0 && !form.id && (
              <Field label="Reuse a vehicle">
                <Select
                  value=""
                  options={vehicleHistory.map((record) => ({
                    value: record.vehicle_no,
                    label: record.vehicle_no,
                    description: [record.driver_name, record.mobile_no].filter(Boolean).join(' · ') || undefined,
                  }))}
                  onChange={(vehicleNo) => {
                    const record = vehicleHistory.find((entry) => entry.vehicle_no === vehicleNo);
                    if (!record) return;
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            vehicle_no: record.vehicle_no,
                            driver_name: record.driver_name || current.driver_name,
                            mobile_no: record.mobile_no || current.mobile_no,
                            drivers_license_no: record.drivers_license_no || current.drivers_license_no,
                            rc_copy_no: record.rc_copy_no || current.rc_copy_no,
                          }
                        : current
                    );
                  }}
                  title="Previous vehicles"
                  placeholder="Copy details from a past trip"
                />
              </Field>
            )}

            <Field label="Driver name">
              <Input value={form.driver_name} onChangeText={(value) => set('driver_name', value)} />
            </Field>
            <Field label="Mobile no">
              <Input value={form.mobile_no} onChangeText={(value) => set('mobile_no', value)} keyboardType="phone-pad" />
            </Field>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="License no" style={{ flex: 1 }}>
                <Input value={form.drivers_license_no} onChangeText={(value) => set('drivers_license_no', value)} />
              </Field>
              <Field label="RC copy no" style={{ flex: 1 }}>
                <Input value={form.rc_copy_no} onChangeText={(value) => set('rc_copy_no', value)} />
              </Field>
            </View>

            <Field label="Empty weight" required={!isLoadedPhase}>
              <NumberInput
                value={form.empty_weight}
                onChangeValue={(value) => set('empty_weight', value)}
                suffix="kg"
                readOnly={isLoadedPhase && Boolean(form.id)}
              />
            </Field>

            {isLoadedPhase && (
              <>
                <Field label="Outward" required hint="The dispatch this vehicle is carrying">
                  <Select
                    value={form.outward_id}
                    options={(outwards.data ?? []).map((outward) => ({
                      value: outward._id,
                      label: `Outward ${outward.outward_no}`,
                      description: `${lookups.vendorName(refId(outward.vendor_id))} · ${formatNumber(outward.total_bags)} bags`,
                    }))}
                    onChange={(value) => set('outward_id', value)}
                    title="Outward"
                  />
                </Field>

                <Field label="Loaded weight" required>
                  <NumberInput
                    value={form.weight_fully_loaded}
                    onChangeValue={(value) => set('weight_fully_loaded', value)}
                    suffix="kg"
                    autoFocus
                  />
                </Field>

                {netWeight !== null && (
                  <Callout
                    tone={netWeight > 0 ? 'success' : 'danger'}
                    icon="calculator-outline"
                    title={`Net weight ${formatNumber(netWeight)} kg`}
                    description={netWeight > 0 ? 'Loaded minus empty' : 'Loaded weight must exceed the empty weight'}
                  />
                )}
              </>
            )}
          </ScrollView>
        )}
      </Sheet>

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="Delete this weigh-in?"
        description={deleteFor ? `WBO ${deleteFor.wbo_id} will be removed.` : undefined}
      />
    </Screen>
  );
}
