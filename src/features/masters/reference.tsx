import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { Text } from '@/components/ui/text';
import { MultiSelect, Select, type Option } from '@/components/ui/select';
import type { ReferenceNames, ReferenceSource } from './registry';
import { fetchResourceList, useResourceList, type MasterRecord } from './use-resource';
import { usePermissions } from '@/hooks/use-permissions';
import { EM_DASH, refId } from '@/lib/format';

/**
 * Reference fields.
 *
 * Each source knows its own collection and label field. Because the fetch lives
 * inside these components, a screen only ever requests the master data it
 * actually renders — a form without a vendor field never asks for vendors, and
 * so never trips a permission it does not have.
 */
const SOURCES: Record<ReferenceSource, { resource: string; label: string; secondary?: string }> = {
  commodity: { resource: 'commodities', label: 'commodity_name' },
  company: { resource: 'companies', label: 'company_name', secondary: 'gst_no' },
  'bag-type': { resource: 'bag-types', label: 'bag_type_name' },
  'bag-grade': { resource: 'bag-grades', label: 'title' },
  vendor: { resource: 'vendors', label: 'vendor_name', secondary: 'state' },
};

const byLabel = (a: Option, b: Option) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });

/**
 * Picker options for a source, alphabetical as on the web. `unavailable` maps a
 * value to the reason it cannot be picked; those options are shown disabled.
 */
export function useReferenceOptions(
  source: ReferenceSource,
  unavailable?: Record<string, string>
): { options: Option[]; isLoading: boolean } {
  const spec = SOURCES[source];
  const { data, isLoading } = useResourceList(spec.resource);

  const options = useMemo<Option[]>(
    () =>
      (data ?? [])
        .map((item) => {
          const record = item as Record<string, unknown>;
          const value = String(record._id);
          const reason = unavailable?.[value];
          return {
            value,
            label: String(record[spec.label] ?? 'Unnamed'),
            description: reason ?? (spec.secondary ? String(record[spec.secondary] ?? '') || undefined : undefined),
            disabled: Boolean(reason),
          };
        })
        .sort(byLabel),
    [data, spec, unavailable]
  );

  return { options, isLoading };
}

/**
 * Display names for every record of the given sources, for list cards that
 * store only ids. A source the role cannot read is never requested — its names
 * simply resolve to `undefined`.
 */
const NO_SOURCES: ReferenceSource[] = [];

export function useReferenceNames(sources: ReferenceSource[] = NO_SOURCES): ReferenceNames {
  const { can } = usePermissions();

  const combine = useCallback(
    (results: UseQueryResult<MasterRecord[]>[]) =>
      new Map(
        results.map((result, index) => {
          const spec = SOURCES[sources[index]];
          const names = new Map<string, string>();
          for (const record of result.data ?? []) {
            if (record[spec.label]) names.set(String(record._id), String(record[spec.label]));
          }
          return [sources[index], names] as const;
        })
      ),
    [sources]
  );

  const lookups = useQueries({
    queries: sources.map((source) => ({
      queryKey: [SOURCES[source].resource],
      queryFn: () => fetchResourceList(SOURCES[source].resource),
      enabled: can(`${source}:read`),
    })),
    combine,
  });

  return useCallback((source, id) => lookups.get(source)?.get(refId(id)), [lookups]);
}

export function ReferenceSelect({
  source,
  value,
  onChange,
  placeholder,
  title,
  disabled,
  error,
  clearable,
  onCreate,
}: {
  source: ReferenceSource;
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  error?: boolean;
  clearable?: boolean;
  onCreate?: () => void;
}) {
  const { options, isLoading } = useReferenceOptions(source);
  return (
    <Select
      value={value}
      options={options}
      onChange={onChange}
      title={title}
      placeholder={isLoading ? 'Loading…' : (placeholder ?? 'Select')}
      disabled={disabled || isLoading}
      error={error}
      clearable={clearable}
      onCreate={onCreate}
      createLabel={title ? `Add ${title.toLowerCase()}` : undefined}
    />
  );
}

export function ReferenceMultiSelect({
  source,
  values,
  onChange,
  placeholder,
  title,
  disabled,
  error,
  unavailable,
  onCreate,
}: {
  source: ReferenceSource;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  error?: boolean;
  unavailable?: Record<string, string>;
  onCreate?: () => void;
}) {
  const { options, isLoading } = useReferenceOptions(source, unavailable);
  return (
    <MultiSelect
      values={values}
      options={options}
      onChange={onChange}
      title={title}
      placeholder={isLoading ? 'Loading…' : (placeholder ?? 'Select')}
      disabled={disabled || isLoading}
      error={error}
      onCreate={onCreate}
    />
  );
}

/** Renders the human name behind a stored id. */
export function ReferenceName({
  source,
  id,
  variant = 'body',
}: {
  source: ReferenceSource;
  id?: string | null;
  variant?: 'body' | 'caption' | 'bodyStrong';
}) {
  const { options } = useReferenceOptions(source);
  const match = options.find((option) => option.value === id);
  return (
    <Text variant={variant} numberOfLines={1}>
      {match?.label ?? EM_DASH}
    </Text>
  );
}
