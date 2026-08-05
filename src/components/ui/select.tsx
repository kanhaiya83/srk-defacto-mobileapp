import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Button } from './button';
import { Input } from './field';
import { Sheet } from './sheet';
import { Text } from './text';
import { useTheme } from '@/theme';

export interface Option {
  value: string;
  label: string;
  /** Secondary line — the detail that disambiguates two similar labels. */
  description?: string;
  disabled?: boolean;
}

/**
 * Single-select.
 *
 * Opens a searchable sheet rather than a native picker: this app routinely
 * chooses between hundreds of vendors or stock batches, where a wheel picker
 * is unusable. Below eight options the search box is hidden as noise.
 */
export function Select({
  value,
  options,
  onChange,
  placeholder = 'Select',
  disabled,
  error,
  title,
  onCreate,
  createLabel = 'Add new',
  style,
  clearable = false,
}: {
  value?: string | null;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  title?: string;
  /** Shows an inline "add new" action — mirrors the web form's `+` buttons. */
  onCreate?: () => void;
  createLabel?: string;
  style?: ViewStyle;
  clearable?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) || option.description?.toLowerCase().includes(q)
    );
  }, [options, query]);

  return (
    <>
      <View style={[{ flexDirection: 'row', gap: theme.spacing.sm }, style]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title ?? placeholder}. ${selected?.label ?? 'nothing selected'}`}
          accessibilityState={{ disabled, expanded: open }}
          disabled={disabled}
          onPress={() => {
            setQuery('');
            setOpen(true);
          }}
          style={({ pressed }) => [
            styles.trigger,
            {
              flex: 1,
              backgroundColor: disabled ? theme.colors.surfaceAlt : pressed ? theme.colors.surfaceAlt : theme.colors.surface,
              borderColor: error ? theme.colors.danger : theme.colors.border,
              borderWidth: error ? 1.5 : 1,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.spacing.md,
              gap: theme.spacing.sm,
              opacity: disabled ? 0.7 : 1,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text variant="body" tone={selected ? 'default' : 'faint'} numberOfLines={1}>
              {selected?.label ?? placeholder}
            </Text>
            {!!selected?.description && (
              <Text variant="caption" tone="faint" numberOfLines={1}>
                {selected.description}
              </Text>
            )}
          </View>
          {clearable && selected && !disabled ? (
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear selection"
              onPress={() => onChange('')}
            >
              <Ionicons name="close-circle" size={18} color={theme.colors.faintText} />
            </Pressable>
          ) : null}
          <Ionicons name="chevron-down" size={17} color={theme.colors.faintText} />
        </Pressable>

        {onCreate && !disabled && (
          <Button icon="add" variant="outline" onPress={onCreate} accessibilityLabel={createLabel} />
        )}
      </View>

      <Sheet open={open} onClose={() => setOpen(false)} title={title ?? placeholder}>
        <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }}>
          {options.length > 8 && (
            <Input
              leftIcon="search"
              placeholder="Search…"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoFocus
            />
          )}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.value}
          keyboardShouldPersistTaps="handled"
          style={{ marginTop: theme.spacing.md }}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg }}
          ListEmptyComponent={
            <View style={{ paddingVertical: theme.spacing.xxl, alignItems: 'center', gap: theme.spacing.sm }}>
              <Ionicons name="search-outline" size={26} color={theme.colors.faintText} />
              <Text tone="muted">No matches for “{query.trim()}”</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = item.value === value;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled: item.disabled }}
                disabled={item.disabled}
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.primarySoft
                      : pressed
                        ? theme.colors.surfaceAlt
                        : 'transparent',
                    borderRadius: theme.radius.md,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.md,
                    gap: theme.spacing.md,
                    opacity: item.disabled ? 0.4 : 1,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant={isSelected ? 'bodyStrong' : 'body'} tone={isSelected ? 'primary' : 'default'}>
                    {item.label}
                  </Text>
                  {!!item.description && (
                    <Text variant="caption" tone="muted">
                      {item.description}
                    </Text>
                  )}
                </View>
                {isSelected && <Ionicons name="checkmark" size={19} color={theme.colors.primary} />}
              </Pressable>
            );
          }}
        />
      </Sheet>
    </>
  );
}

/** Multi-select. Selected values are shown as removable chips on the trigger. */
export function MultiSelect({
  values,
  options,
  onChange,
  placeholder = 'Select',
  disabled,
  error,
  title,
  onCreate,
  style,
}: {
  values: string[];
  options: Option[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  title?: string;
  onCreate?: () => void;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.filter((option) => values.includes(option.value));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (value: string) =>
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);

  return (
    <>
      <View style={[{ flexDirection: 'row', gap: theme.spacing.sm }, style]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title ?? placeholder}. ${selected.length} selected`}
          disabled={disabled}
          onPress={() => {
            setQuery('');
            setOpen(true);
          }}
          style={({ pressed }) => [
            styles.trigger,
            {
              flex: 1,
              minHeight: 48,
              paddingVertical: selected.length ? theme.spacing.sm : 0,
              backgroundColor: disabled ? theme.colors.surfaceAlt : pressed ? theme.colors.surfaceAlt : theme.colors.surface,
              borderColor: error ? theme.colors.danger : theme.colors.border,
              borderWidth: error ? 1.5 : 1,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.spacing.md,
              gap: theme.spacing.sm,
            },
          ]}
        >
          <View style={[styles.chips, { flex: 1, gap: theme.spacing.xs }]}>
            {selected.length === 0 ? (
              <Text variant="body" tone="faint">
                {placeholder}
              </Text>
            ) : (
              selected.map((option) => (
                <View
                  key={option.value}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: theme.colors.primarySoft,
                    borderRadius: theme.radius.pill,
                    paddingLeft: 10,
                    paddingRight: disabled ? 10 : 6,
                    paddingVertical: 4,
                  }}
                >
                  <Text variant="caption" tone="primary">
                    {option.label}
                  </Text>
                  {!disabled && (
                    <Pressable
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${option.label}`}
                      onPress={() => toggle(option.value)}
                    >
                      <Ionicons name="close-circle" size={14} color={theme.colors.primary} />
                    </Pressable>
                  )}
                </View>
              ))
            )}
          </View>
          <Ionicons name="chevron-down" size={17} color={theme.colors.faintText} />
        </Pressable>

        {onCreate && !disabled && <Button icon="add" variant="outline" onPress={onCreate} accessibilityLabel="Add new" />}
      </View>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={title ?? placeholder}
        subtitle={`${values.length} selected`}
        footer={<Button label="Done" fullWidth onPress={() => setOpen(false)} style={{ flex: 1 }} />}
      >
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          {options.length > 8 && (
            <Input leftIcon="search" placeholder="Search…" value={query} onChangeText={setQuery} autoCorrect={false} />
          )}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.value}
          keyboardShouldPersistTaps="handled"
          style={{ marginTop: theme.spacing.md }}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md }}
          ListEmptyComponent={
            <View style={{ paddingVertical: theme.spacing.xxl, alignItems: 'center' }}>
              <Text tone="muted">Nothing to choose from</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = values.includes(item.value);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                onPress={() => toggle(item.value)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent',
                    borderRadius: theme.radius.md,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.md,
                    gap: theme.spacing.md,
                  },
                ]}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    borderWidth: isSelected ? 0 : 1.5,
                    borderColor: theme.colors.borderStrong,
                    backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isSelected && <Ionicons name="checkmark" size={15} color={theme.colors.primaryText} />}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="body">{item.label}</Text>
                  {!!item.description && (
                    <Text variant="caption" tone="muted">
                      {item.description}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  option: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
});
