import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { getErrorMessage } from '@/api/request';
import { Button } from '@/components/ui/button';
import { EmptyState, Loading } from '@/components/ui/feedback';
import { Callout } from '@/components/ui/misc';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { toast } from '@/components/ui/toast';
import { MasterFieldInput, cleanPayload, firstValidationError, seedValues } from '@/features/masters/master-form';
import { useReferenceNames } from '@/features/masters/reference';
import { getMasterConfig } from '@/features/masters/registry';
import {
  useCreateResource,
  useResourceItem,
  useResourceList,
  useUpdateResource,
  type MasterRecord,
} from '@/features/masters/use-resource';
import { useModulePermissions, usePermissions } from '@/hooks/use-permissions';
import { useSyncedState } from '@/hooks/use-synced-state';

/**
 * Create/edit screen for every master.
 *
 * Validation runs on submit rather than on every keystroke: an ERP form has
 * fifteen fields and flagging them red as someone tabs through reads as
 * nagging. The first offending field is named in a toast and inlined in place.
 */
export default function MasterFormScreen() {
  const router = useRouter();
  const { module, id } = useLocalSearchParams<{ module: string; id: string }>();
  const config = getMasterConfig(module);
  const isNew = id === 'new';

  const { canCreate, canUpdate } = useModulePermissions(module ?? '');
  const { can } = usePermissions();
  const existing = useResourceItem<MasterRecord>(config?.resource ?? '', isNew ? null : id);
  const create = useCreateResource(config?.resource ?? '');
  const update = useUpdateResource(config?.resource ?? '');
  const names = useReferenceNames(config?.uses);

  // Sibling records, for fields whose values only one record may hold.
  const hasExclusive = Boolean(config?.fields.some((field) => field.exclusive));
  const siblings = useResourceList<MasterRecord>(config?.resource ?? '', hasExclusive);
  const unavailable = useMemo(() => {
    const taken: Record<string, Record<string, string>> = {};
    if (!config) return taken;
    for (const field of config.fields.filter((f) => f.exclusive)) {
      taken[field.key] = {};
      for (const record of siblings.data ?? []) {
        if (record._id === id) continue;
        for (const value of (record[field.key] as string[] | undefined) ?? []) {
          taken[field.key][value] = `In ${config.primary(record, names)}`;
        }
      }
    }
    return taken;
  }, [config, siblings.data, id, names]);

  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  const [values, setValues] = useSyncedState<Record<string, unknown>>(
    isNew ? `new:${module}` : (existing.data?._id ?? null),
    () => seedValues(config?.fields ?? [], isNew ? undefined : (existing.data as Record<string, unknown> | undefined))
  );

  if (!config) {
    return (
      <Screen>
        <Header title="Not found" />
        <EmptyState icon="help-circle-outline" title="Unknown master" description={`No master is registered for “${module}”.`} />
      </Screen>
    );
  }

  const permitted = isNew ? canCreate : canUpdate;
  const saving = create.isPending || update.isPending;

  const submit = async () => {
    const failure = firstValidationError(config.fields, values);
    if (failure) {
      setError(failure);
      toast.error(failure.message);
      return;
    }
    setError(null);

    const payload = cleanPayload(config.fields, values);

    try {
      if (isNew) {
        await create.mutateAsync(payload);
        toast.success(`${config.singular} added`);
      } else {
        await update.mutateAsync({ id: id!, payload });
        toast.success(`${config.singular} updated`);
      }
      router.back();
    } catch (err) {
      toast.error(isNew ? `Could not add ${config.singular.toLowerCase()}` : 'Could not save changes', {
        description: getErrorMessage(err),
      });
    }
  };

  if (!isNew && existing.isLoading) {
    return (
      <Screen>
        <Header title={`Edit ${config.singular}`} />
        <Loading label="Loading record…" />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <Header
        title={isNew ? `New ${config.singular}` : `Edit ${config.singular}`}
        subtitle={isNew ? config.description : config.primary(values, names)}
      />

      <Body>
        {!permitted && (
          <Callout
            tone="warning"
            title="Read-only"
            description={`Your role can view ${config.title.toLowerCase()} but not ${isNew ? 'create' : 'change'} them.`}
          />
        )}

        {config.fields.map((field) => (
          <MasterFieldInput
            key={field.key}
            field={field}
            value={values[field.key]}
            error={error?.key === field.key ? error.message : undefined}
            unavailable={unavailable[field.key]}
            onCreateReference={
              permitted && field.source && can(`${field.source}:create`)
                ? () => router.push(`/masters/${field.source}/new` as never)
                : undefined
            }
            onChange={(next) => {
              setValues((current) => {
                const updated = { ...current, [field.key]: next };
                // New records fill dependent fields as you type (the company slug from its name).
                if (isNew) {
                  for (const other of config.fields) {
                    if (other.derive?.from === field.key) updated[other.key] = other.derive.compute(next);
                  }
                }
                return updated;
              });
              if (error?.key === field.key) setError(null);
            }}
          />
        ))}
      </Body>

      <ActionBar>
        <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
        <Button
          label={isNew ? `Add ${config.singular}` : 'Save changes'}
          style={{ flex: 2 }}
          loading={saving}
          disabled={!permitted}
          onPress={submit}
        />
      </ActionBar>
    </Screen>
  );
}
