import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sheet } from './ui/sheet';
import { Text } from './ui/text';
import { EmptyState, ErrorState, ListSkeleton } from './ui/feedback';
import { SearchBar, Segmented } from './ui/misc';
import { useTheme } from '@/theme';

export type SortOrder = 'newest' | 'oldest';

/**
 * Sorts by recency, mirroring the web client's `RecencySort`. Falls back
 * through `updatedAt → createdAt → _id`, because some collections only ever set
 * one of them.
 */
export function sortByRecency<T extends { createdAt?: string; updatedAt?: string; _id?: string }>(
  items: T[],
  order: SortOrder
): T[] {
  const stamp = (item: T) => {
    const raw = item.updatedAt ?? item.createdAt;
    if (raw) {
      const time = new Date(raw).getTime();
      if (!Number.isNaN(time)) return time;
    }
    return 0;
  };
  return [...items].sort((a, b) => (order === 'newest' ? stamp(b) - stamp(a) : stamp(a) - stamp(b)));
}

export interface ListFilter<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/**
 * Generic list screen body: search, filter chips, pull-to-refresh, empty and
 * error states, and a floating create button.
 *
 * Every list in the app routes through this, so search behaves the same
 * everywhere and no screen has to reimplement a loading state.
 */
export function ListBody<Item, FilterValue extends string = string>({
  items,
  isLoading,
  isError,
  errorMessage,
  onRefresh,
  refreshing,
  renderItem,
  keyExtractor,
  searchable = true,
  searchPlaceholder = 'Search…',
  searchFields,
  filters,
  filterValue,
  onFilterChange,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  header,
  sortable = true,
  footerNote,
}: {
  items: Item[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  renderItem: (item: Item, index: number) => ReactNode;
  keyExtractor: (item: Item, index: number) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Values matched against the query, per item. */
  searchFields?: (item: Item) => unknown[];
  filters?: ListFilter<FilterValue>[];
  filterValue?: FilterValue;
  onFilterChange?: (value: FilterValue) => void;
  emptyTitle: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  /** Rendered above the search bar — summary tiles, callouts. */
  header?: ReactNode;
  sortable?: boolean;
  footerNote?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<SortOrder>('newest');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !searchFields) return items;
    return items.filter((item) =>
      searchFields(item).some((field) => field !== null && field !== undefined && String(field).toLowerCase().includes(q))
    );
  }, [items, query, searchFields]);

  if (isLoading) return <ListSkeleton />;
  if (isError) return <ErrorState message={errorMessage} onRetry={onRefresh} />;

  const listHeader = (
    <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
      {header}
      {searchable && searchFields && (
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={searchPlaceholder}
          right={
            sortable ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={order === 'newest' ? 'Sort oldest first' : 'Sort newest first'}
                onPress={() => {
                  if (Platform.OS !== 'web') void Haptics.selectionAsync();
                  setOrder((current) => (current === 'newest' ? 'oldest' : 'newest'));
                }}
                style={({ pressed }) => ({
                  width: 48,
                  height: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
                })}
              >
                <Ionicons
                  name={order === 'newest' ? 'arrow-down' : 'arrow-up'}
                  size={18}
                  color={theme.colors.mutedText}
                />
              </Pressable>
            ) : undefined
          }
        />
      )}
      {filters && filterValue !== undefined && onFilterChange && (
        <Segmented value={filterValue} options={filters} onChange={onFilterChange} />
      )}
      {query.trim().length > 0 && (
        <Text variant="caption" tone="muted">
          {visible.length} of {items.length} match “{query.trim()}”
        </Text>
      )}
    </View>
  );

  return (
    <FlatList
      data={sortable ? (sortByRecency(visible as never[], order) as Item[]) : visible}
      keyExtractor={keyExtractor}
      renderItem={({ item, index }) => (
        <Animated.View entering={index < 10 ? FadeInDown.delay(index * 22).duration(220) : undefined}>
          {renderItem(item, index)}
        </Animated.View>
      )}
      ListHeaderComponent={listHeader}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        padding: theme.spacing.lg,
        paddingBottom: insets.bottom + 96,
        gap: theme.spacing.md,
      }}
      ItemSeparatorComponent={null}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        ) : undefined
      }
      ListEmptyComponent={
        query.trim() ? (
          <EmptyState
            icon="search-outline"
            title="No matches"
            description={`Nothing matched “${query.trim()}”. Try a shorter search.`}
          />
        ) : (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            actionLabel={emptyActionLabel}
            onAction={onEmptyAction}
          />
        )
      }
      ListFooterComponent={
        footerNote && visible.length > 0 ? (
          <Text variant="caption" tone="faint" style={{ textAlign: 'center', paddingTop: theme.spacing.lg }}>
            {footerNote}
          </Text>
        ) : null
      }
    />
  );
}

/** Floating create button. Sits above the tab bar, thumb-reachable. */
export function Fab({
  onPress,
  icon = 'add',
  label,
  offset = 0,
}: {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  offset?: number;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? 'Create'}
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [
        styles.fab,
        theme.shadow(3),
        {
          bottom: insets.bottom + 20 + offset,
          right: theme.spacing.lg,
          backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.primary,
          borderRadius: theme.radius.pill,
          paddingHorizontal: label ? theme.spacing.lg : 0,
          width: label ? undefined : 56,
          height: 56,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <Ionicons name={icon} size={24} color={theme.colors.primaryText} />
      {!!label && (
        <Text variant="bodyStrong" style={{ color: theme.colors.primaryText }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Action list presented from a row's overflow menu. */
export function ActionSheet({
  open,
  onClose,
  title,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  actions: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    tone?: 'default' | 'danger';
    disabled?: boolean;
    /** Shown instead of the action when disabled — explains the lock. */
    disabledReason?: string;
  }[];
}) {
  const theme = useTheme();

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md }}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ disabled: action.disabled }}
            disabled={action.disabled}
            onPress={() => {
              onClose();
              // Let the sheet's exit animation start before the next screen
              // pushes, so the transition doesn't stutter.
              setTimeout(action.onPress, 120);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              paddingVertical: theme.spacing.md,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.md,
              backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent',
              opacity: action.disabled ? 0.45 : 1,
            })}
          >
            <Ionicons
              name={action.icon}
              size={20}
              color={action.tone === 'danger' ? theme.colors.danger : theme.colors.mutedText}
            />
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="body" tone={action.tone === 'danger' ? 'danger' : 'default'}>
                {action.label}
              </Text>
              {action.disabled && action.disabledReason && (
                <Text variant="caption" tone="faint">
                  {action.disabledReason}
                </Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
