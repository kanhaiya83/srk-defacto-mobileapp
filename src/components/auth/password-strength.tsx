import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { PASSWORD_RULES } from '@/lib/password-policy';
import { useTheme } from '@/theme';

/**
 * Live password-policy checklist.
 *
 * Every rule is visible from the start — a rule that only appears once broken
 * reads as the app moving the goalposts. Satisfied rules tick green in place.
 */
export function PasswordStrength({ value }: { value: string }) {
  const theme = useTheme();
  const passed = PASSWORD_RULES.filter((rule) => rule.test(value)).length;
  const ratio = passed / PASSWORD_RULES.length;

  const barColor = ratio === 1 ? theme.colors.success : ratio >= 0.6 ? theme.colors.warning : theme.colors.danger;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {PASSWORD_RULES.map((rule, index) => (
          <View
            key={rule.label}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: index < passed ? barColor : theme.colors.surfaceActive,
            }}
          />
        ))}
      </View>

      <Animated.View layout={LinearTransition.duration(160)} style={{ gap: 3 }}>
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(value);
          return (
            <View key={rule.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name={ok ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={ok ? theme.colors.success : theme.colors.faintText}
              />
              <Text variant="caption" tone={ok ? 'success' : 'faint'}>
                {rule.label}
              </Text>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}
