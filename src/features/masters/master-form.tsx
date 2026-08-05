import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { ReferenceMultiSelect, ReferenceSelect } from './reference';
import type { MasterField } from './registry';
import { IconButton } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Field, Input, NumberInput } from '@/components/ui/field';
import { CheckboxRow } from '@/components/ui/misc';
import { MultiSelect, Select } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { STATES } from '@/lib/states';
import { useTheme } from '@/theme';

/** Blank value for a field, used for both "new record" and "add a row". */
export function emptyValueFor(field: MasterField): unknown {
  switch (field.type) {
    case 'number':
      return '';
    case 'reference-multi':
      return [];
    case 'options':
      return field.multiple ? [] : '';
    case 'string-list':
      return [''];
    case 'object-list':
      return [];
    default:
      return '';
  }
}

/** First failing requirement, in field order — matches the web forms' behaviour. */
export function firstValidationError(
  fields: MasterField[],
  values: Record<string, unknown>
): { key: string; message: string } | null {
  for (const field of fields) {
    if (!field.required) continue;
    const value = values[field.key];
    const missing =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0) ||
      (Array.isArray(value) && value.every((entry) => !entry));
    if (missing) return { key: field.key, message: `${field.label} is required` };
  }
  return null;
}

/**
 * Strips the empty rows people leave behind in list fields, so a vendor with
 * one contact does not arrive at the server with three blank ones.
 */
export function cleanPayload(fields: MasterField[], values: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    if (field.readOnly) continue;
    const value = values[field.key];

    if (field.type === 'string-list') {
      payload[field.key] = ((value as string[]) ?? []).map((entry) => entry?.trim()).filter(Boolean);
    } else if (field.type === 'object-list') {
      payload[field.key] = ((value as Record<string, string>[]) ?? []).filter((row) =>
        Object.values(row).some((entry) => typeof entry === 'string' && entry.trim().length > 0)
      );
    } else if (field.type === 'number') {
      payload[field.key] = value === '' || value === null || value === undefined ? undefined : Number(value);
    } else {
      payload[field.key] = value;
    }
  }

  return payload;
}

export function MasterFieldInput({
  field,
  value,
  onChange,
  error,
}: {
  field: MasterField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}) {
  const theme = useTheme();

  // ------------------------------------------------------------- list fields
  if (field.type === 'string-list') {
    const entries = ((value as string[]) ?? ['']).length ? (value as string[]) : [''];
    return (
      <Field label={field.label} required={field.required} error={error} hint={field.hint}>
        <Animated.View layout={LinearTransition.duration(180)} style={{ gap: theme.spacing.sm }}>
          {entries.map((entry, index) => (
            <Animated.View
              key={index}
              entering={FadeIn.duration(160)}
              exiting={FadeOut.duration(120)}
              style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}
            >
              <Input
                value={entry}
                onChangeText={(text) => {
                  const next = [...entries];
                  next[index] = text;
                  onChange(next);
                }}
                placeholder={`${field.itemLabel ?? field.label} ${index + 1}`}
                keyboardType={field.itemLabel === 'Email' ? 'email-address' : 'default'}
                autoCapitalize="none"
                style={{ flex: 1 }}
              />
              {entries.length > 1 && (
                <IconButton
                  icon="close"
                  tone="danger"
                  accessibilityLabel={`Remove ${field.itemLabel ?? 'entry'} ${index + 1}`}
                  onPress={() => onChange(entries.filter((_, i) => i !== index))}
                />
              )}
            </Animated.View>
          ))}
          <AddRowButton label={`Add ${field.itemLabel?.toLowerCase() ?? 'another'}`} onPress={() => onChange([...entries, ''])} />
        </Animated.View>
      </Field>
    );
  }

  if (field.type === 'object-list') {
    const rows = (value as Record<string, string>[]) ?? [];
    const blankRow = Object.fromEntries((field.itemFields ?? []).map((sub) => [sub.key, '']));

    return (
      <Field label={field.label} required={field.required} error={error} hint={field.hint}>
        <Animated.View layout={LinearTransition.duration(180)} style={{ gap: theme.spacing.md }}>
          {rows.map((row, index) => (
            <Animated.View
              key={index}
              entering={FadeIn.duration(160)}
              exiting={FadeOut.duration(120)}
              style={{
                gap: theme.spacing.sm,
                padding: theme.spacing.md,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surfaceAlt,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="label" tone="muted">
                  {(field.itemLabel ?? 'Item').toUpperCase()} {index + 1}
                </Text>
                <IconButton
                  icon="trash-outline"
                  tone="danger"
                  size={30}
                  accessibilityLabel={`Remove ${field.itemLabel ?? 'item'} ${index + 1}`}
                  onPress={() => onChange(rows.filter((_, i) => i !== index))}
                />
              </View>
              {(field.itemFields ?? []).map((sub) => (
                <Input
                  key={sub.key}
                  value={row[sub.key] ?? ''}
                  placeholder={sub.label}
                  keyboardType={sub.type === 'phone' ? 'phone-pad' : sub.type === 'email' ? 'email-address' : 'default'}
                  autoCapitalize={sub.type === 'email' ? 'none' : 'sentences'}
                  onChangeText={(text) => {
                    const next = [...rows];
                    next[index] = { ...next[index], [sub.key]: text };
                    onChange(next);
                  }}
                />
              ))}
            </Animated.View>
          ))}
          <AddRowButton
            label={`Add ${field.itemLabel?.toLowerCase() ?? 'row'}`}
            onPress={() => onChange([...rows, { ...blankRow }])}
          />
        </Animated.View>
      </Field>
    );
  }

  // -------------------------------------------------------------- references
  if (field.type === 'reference' && field.source) {
    return (
      <Field label={field.label} required={field.required} error={error} hint={field.hint}>
        <ReferenceSelect
          source={field.source}
          value={value as string}
          onChange={onChange}
          title={field.label}
          error={Boolean(error)}
          placeholder={field.placeholder}
        />
      </Field>
    );
  }

  if (field.type === 'reference-multi' && field.source) {
    return (
      <Field label={field.label} required={field.required} error={error} hint={field.hint}>
        <ReferenceMultiSelect
          source={field.source}
          values={(value as string[]) ?? []}
          onChange={onChange}
          title={field.label}
          error={Boolean(error)}
          placeholder={field.placeholder}
        />
      </Field>
    );
  }

  // ------------------------------------------------------------ fixed choices
  if (field.type === 'options') {
    // A field with no explicit options is the state list — the only long,
    // fully static choice set in the masters.
    const options = field.options ?? STATES;

    if (field.multiple) {
      const selected = (value as string[]) ?? [];
      // Two or three choices read better as checkboxes than as a picker sheet.
      if (options.length <= 4) {
        return (
          <Field label={field.label} required={field.required} error={error} hint={field.hint}>
            <View style={{ gap: 2 }}>
              {options.map((option) => (
                <CheckboxRow
                  key={option.value}
                  label={option.label}
                  checked={selected.includes(option.value)}
                  onChange={(checked) =>
                    onChange(
                      checked ? [...selected, option.value] : selected.filter((entry) => entry !== option.value)
                    )
                  }
                />
              ))}
            </View>
          </Field>
        );
      }
      return (
        <Field label={field.label} required={field.required} error={error} hint={field.hint}>
          <MultiSelect values={selected} options={options} onChange={onChange} title={field.label} error={Boolean(error)} />
        </Field>
      );
    }

    return (
      <Field label={field.label} required={field.required} error={error} hint={field.hint}>
        <Select
          value={value as string}
          options={options}
          onChange={onChange}
          title={field.label}
          error={Boolean(error)}
          placeholder={field.placeholder ?? 'Select'}
        />
      </Field>
    );
  }

  // --------------------------------------------------------------- scalars
  if (field.type === 'date') {
    return (
      <Field label={field.label} required={field.required} error={error} hint={field.hint}>
        <DateField
          value={value ? String(value).slice(0, 10) : ''}
          onChange={onChange}
          placeholder={field.placeholder ?? field.label}
          error={Boolean(error)}
          clearable={!field.required}
        />
      </Field>
    );
  }

  if (field.type === 'number') {
    return (
      <Field label={field.label} required={field.required} error={error} hint={field.hint}>
        <NumberInput
          value={value as number | string}
          onChangeValue={onChange}
          placeholder={field.placeholder ?? '0'}
          suffix={field.suffix}
          error={Boolean(error)}
          readOnly={field.readOnly}
        />
      </Field>
    );
  }

  return (
    <Field label={field.label} required={field.required} error={error} hint={field.hint}>
      <Input
        value={(value as string) ?? ''}
        onChangeText={onChange}
        placeholder={field.placeholder}
        multiline={field.type === 'textarea'}
        keyboardType={field.type === 'phone' ? 'phone-pad' : field.type === 'email' ? 'email-address' : 'default'}
        autoCapitalize={field.type === 'email' ? 'none' : 'sentences'}
        autoCorrect={field.type !== 'email'}
        error={Boolean(error)}
        readOnly={field.readOnly}
      />
    </Field>
  );
}

function AddRowButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.colors.borderStrong,
        backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent',
      })}
    >
      <Ionicons name="add" size={17} color={theme.colors.primary} />
      <Text variant="label" tone="primary">
        {label}
      </Text>
    </Pressable>
  );
}
