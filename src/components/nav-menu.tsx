import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from './ui/feedback';
import { SearchBar } from './ui/misc';
import { Text } from './ui/text';
import type { NavItem } from '@/config/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/theme';

/**
 * Permission-filtered menu of destinations.
 *
 * A user only ever sees what they can actually open — a menu full of links that
 * lead to "access denied" teaches people to distrust the app. With ~35
 * destinations the filter box earns its place; it is hidden below eight items.
 */
export function NavMenu({ items, searchPlaceholder = 'Find a screen…' }: { items: NavItem[]; searchPlaceholder?: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { can } = usePermissions();
  const [query, setQuery] = useState('');

  const permitted = useMemo(
    () => items.filter((item) => can(item.permission ?? `${item.module}:read`)),
    [items, can]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return permitted;
    return permitted.filter(
      (item) => item.label.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q)
    );
  }, [permitted, query]);

  if (permitted.length === 0) {
    return (
      <EmptyState
        icon="lock-closed-outline"
        title="Nothing here for you"
        description="Your role does not include access to any screen in this section. Ask an administrator if you think that is wrong."
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxxl }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {permitted.length > 8 && <SearchBar value={query} onChange={setQuery} placeholder={searchPlaceholder} />}

      {visible.length === 0 ? (
        <EmptyState icon="search-outline" title="No matches" description={`Nothing matched “${query.trim()}”.`} compact />
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {visible.map((item, index) => (
            <Animated.View key={item.path} entering={index < 12 ? FadeInDown.delay(index * 18).duration(200) : undefined}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => router.push(item.path as never)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.lg,
                  backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: theme.colors.border,
                })}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: theme.radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.primarySoft,
                  }}
                >
                  <Ionicons name={item.icon} size={19} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text variant="bodyStrong">{item.label}</Text>
                  {!!item.description && (
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {item.description}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={17} color={theme.colors.faintText} />
              </Pressable>
            </Animated.View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
