import { ScrollView, View } from 'react-native';

import type { MasterConfig, MasterField, ReferenceNames } from './registry';
import type { MasterRecord } from './use-resource';
import { Button } from '@/components/ui/button';
import { DetailRow } from '@/components/ui/misc';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { useTheme } from '@/theme';

/** One field's stored value as text, with references resolved to names. */
function displayValue(field: MasterField, stored: unknown, names: ReferenceNames): string | null {
  if (stored === null || stored === undefined || stored === '') return null;
  const value = field.load ? field.load(stored) : stored;
  switch (field.type) {
    case 'date':
      return formatDate(String(value));
    case 'number': {
      const num = Number(value);
      if (field.suffix === '₹') return formatCurrency(num);
      return `${formatNumber(num, Number.isInteger(num) ? 0 : 2)}${field.suffix ? ` ${field.suffix}` : ''}`;
    }
    case 'reference':
      return field.source ? (names(field.source, value) ?? null) : String(value);
    case 'reference-multi':
      return (value as unknown[]).map((id) => (field.source && names(field.source, id)) || '').filter(Boolean).join(', ') || null;
    case 'options': {
      const values = Array.isArray(value) ? value : [value];
      const label = (entry: unknown) => field.options?.find((option) => option.value === entry)?.label ?? String(entry);
      return values.map(label).join(', ') || null;
    }
    case 'string-list':
      return (value as string[]).filter(Boolean).join(', ') || null;
    default:
      return String(value);
  }
}

/**
 * Read-only view of every field of a master record — the web client's
 * "details" dialog. It is also what a role without edit rights sees on tap.
 */
export function MasterDetailsSheet({
  config,
  record,
  names,
  onClose,
  onEdit,
}: {
  config: MasterConfig;
  record: MasterRecord | null;
  names: ReferenceNames;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const theme = useTheme();

  return (
    <Sheet
      open={record !== null}
      onClose={onClose}
      title={record ? config.primary(record, names) : undefined}
      subtitle={config.singular}
      footer={onEdit ? <Button label="Edit" icon="create-outline" onPress={onEdit} style={{ flex: 1 }} /> : undefined}
    >
      {record && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
          {config.fields.map((field) => {
            if (field.type !== 'object-list') {
              return <DetailRow key={field.key} label={field.label} value={displayValue(field, record[field.key], names)} />;
            }

            const rows = (record[field.key] as Record<string, string>[] | undefined) ?? [];
            return (
              <View key={field.key} style={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.sm }}>
                <Text variant="caption" tone="muted">
                  {field.label} ({rows.length})
                </Text>
                {rows.length === 0 ? (
                  <Text variant="body" tone="faint">
                    None added
                  </Text>
                ) : (
                  rows.map((row, index) => (
                    <View
                      key={(field.rowId && row[field.rowId]) || index}
                      style={{
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.xs,
                        borderRadius: theme.radius.md,
                        backgroundColor: theme.colors.surfaceAlt,
                      }}
                    >
                      {(field.itemFields ?? []).map((sub) => (
                        <DetailRow key={sub.key} label={sub.label} value={row[sub.key]} />
                      ))}
                    </View>
                  ))
                )}
              </View>
            );
          })}
          <DetailRow label="Created" value={formatDateTime(record.createdAt)} tone="muted" />
          <DetailRow label="Updated" value={formatDateTime(record.updatedAt)} tone="muted" />
        </ScrollView>
      )}
    </Sheet>
  );
}
