import { useMemo } from 'react';

import { Text } from '@/components/ui/text';
import { MultiSelect, Select, type Option } from '@/components/ui/select';
import type { ReferenceSource } from './registry';
import { useResourceList } from './use-resource';
import { EM_DASH } from '@/lib/format';

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

export function useReferenceOptions(source: ReferenceSource): { options: Option[]; isLoading: boolean } {
  const spec = SOURCES[source];
  const { data, isLoading } = useResourceList(spec.resource);

  const options = useMemo<Option[]>(
    () =>
      (data ?? []).map((item) => ({
        value: String((item as Record<string, unknown>)._id),
        label: String((item as Record<string, unknown>)[spec.label] ?? 'Unnamed'),
        description: spec.secondary ? (String((item as Record<string, unknown>)[spec.secondary] ?? '') || undefined) : undefined,
      })),
    [data, spec]
  );

  return { options, isLoading };
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
}: {
  source: ReferenceSource;
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  error?: boolean;
  clearable?: boolean;
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
}: {
  source: ReferenceSource;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  error?: boolean;
}) {
  const { options, isLoading } = useReferenceOptions(source);
  return (
    <MultiSelect
      values={values}
      options={options}
      onChange={onChange}
      title={title}
      placeholder={isLoading ? 'Loading…' : (placeholder ?? 'Select')}
      disabled={disabled || isLoading}
      error={error}
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
