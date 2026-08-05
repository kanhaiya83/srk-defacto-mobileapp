import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Button } from './button';
import { Sheet } from './sheet';
import { Text } from './text';
import { formatDate, toISODate } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * Date field.
 *
 * Values are exchanged as `YYYY-MM-DD` strings, exactly as the web forms and
 * the API use them, so no timezone drift can creep in between the two clients.
 */
export function DateField({
  value,
  onChange,
  placeholder = 'Select date',
  disabled,
  error,
  minimumDate,
  maximumDate,
  clearable,
}: {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
  clearable?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(value) : new Date();
  const valid = !Number.isNaN(parsed.getTime());
  const [draft, setDraft] = useState<Date>(valid ? parsed : new Date());

  const trigger = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${placeholder}. ${value ? formatDate(value) : 'not set'}`}
      disabled={disabled}
      onPress={() => {
        setDraft(valid ? parsed : new Date());
        setOpen(true);
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: error ? 1.5 : 1,
        borderColor: error ? theme.colors.danger : theme.colors.border,
        backgroundColor: disabled ? theme.colors.surfaceAlt : pressed ? theme.colors.surfaceAlt : theme.colors.surface,
        opacity: disabled ? 0.7 : 1,
      })}
    >
      <Ionicons name="calendar-outline" size={17} color={theme.colors.faintText} />
      <Text variant="body" tone={value ? 'default' : 'faint'} style={{ flex: 1 }}>
        {value ? formatDate(value) : placeholder}
      </Text>
      {clearable && value && !disabled && (
        <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear date" onPress={() => onChange('')}>
          <Ionicons name="close-circle" size={18} color={theme.colors.faintText} />
        </Pressable>
      )}
    </Pressable>
  );

  // Android's picker is a system dialog: show it directly, no sheet wrapper.
  if (Platform.OS === 'android') {
    return (
      <>
        {trigger}
        {open && (
          <DateTimePicker
            value={draft}
            mode="date"
            display="calendar"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(event, date) => {
              setOpen(false);
              if (event.type === 'set' && date) onChange(toISODate(date));
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      {trigger}
      <Sheet open={open} onClose={() => setOpen(false)} title={placeholder}>
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg, gap: theme.spacing.lg }}>
          <DateTimePicker
            value={draft}
            mode="date"
            display="inline"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(_event, date) => date && setDraft(date)}
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setOpen(false)} />
            <Button
              label="Set date"
              style={{ flex: 1 }}
              onPress={() => {
                onChange(toISODate(draft));
                setOpen(false);
              }}
            />
          </View>
        </View>
      </Sheet>
    </>
  );
}
