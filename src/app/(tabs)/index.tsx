import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  useGenerateGrnEntries,
  useInwardWeighBridgeEntries,
  useLots,
  usePreOutwards,
  useSaleOrders,
  useStockLedgerAll,
} from '@/api/operations-api';
import { Card, SectionHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/feedback';
import { StatTile } from '@/components/ui/misc';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { usePermissions } from '@/hooks/use-permissions';
import { formatNumber, formatRelative, formatWeight } from '@/lib/format';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

/**
 * Home.
 *
 * Answers the three questions an operator opens the app with: what is waiting
 * on me, what is on hand, and what did I just do. Every tile is a shortcut to
 * the screen that resolves it, so a pending count is never a dead end.
 *
 * Each block queries independently and is rendered only when the user's role
 * permits reading that module — an unpermitted block is never mounted, so it
 * never fires a request that would 403.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { can } = usePermissions();
  const [refreshing, setRefreshing] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />}
      >
        <Animated.View entering={FadeInDown.duration(300)} style={{ gap: 3, paddingTop: theme.spacing.sm }}>
          <Text variant="caption" tone="muted">
            {greeting}
          </Text>
          <Text variant="display" numberOfLines={1}>
            {user?.name?.split(' ')[0] ?? 'There'}
          </Text>
        </Animated.View>

        {can('inventory:read') && <StockOnHand />}
        {can('wbi:read') && <GateStatus />}
        {(can('saleorder:read') || can('lot:read') || can('preoutward:read')) && <PipelineStatus />}

        <QuickActions />
      </ScrollView>
    </Screen>
  );
}

// ---------------------------------------------------------------- stock tiles

function StockOnHand() {
  const theme = useTheme();
  const router = useRouter();
  const { data, isLoading } = useStockLedgerAll();

  const totals = useMemo(() => {
    const entries = data ?? [];
    return entries.reduce(
      (acc, entry) => {
        acc.bags += entry.available_bags ?? 0;
        acc.weight += entry.available_weight ?? 0;
        if ((entry.available_bags ?? 0) > 0) acc.batches += 1;
        return acc;
      },
      { bags: 0, weight: 0, batches: 0 }
    );
  }, [data]);

  return (
    <View style={{ gap: theme.spacing.md }}>
      <SectionHeader title="Stock on hand" caption="Across every location and company group" />
      {isLoading ? (
        <TileSkeletons count={3} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          <StatTile
            label="Available bags"
            value={formatNumber(totals.bags)}
            icon="cube-outline"
            onPress={() => router.push('/operations/inventory')}
          />
          <StatTile
            label="Available weight"
            value={formatWeight(totals.weight)}
            icon="scale-outline"
            tone="info"
            onPress={() => router.push('/operations/inventory')}
          />
          <StatTile
            label="Active batches"
            value={formatNumber(totals.batches)}
            icon="layers-outline"
            tone="neutral"
            onPress={() => router.push('/operations/inventory')}
          />
        </View>
      )}
    </View>
  );
}

// ----------------------------------------------------------------- gate tiles

function GateStatus() {
  const theme = useTheme();
  const router = useRouter();
  const { data: wbis, isLoading } = useInwardWeighBridgeEntries();
  const { data: grns } = useGenerateGrnEntries();

  const stats = useMemo(() => {
    const entries = wbis ?? [];
    const awaitingWeight = entries.filter((entry) => !entry.empty_weight || entry.empty_weight <= 0);
    const grnIds = new Set((grns ?? []).map((grn) => grn.wbi_id));
    const awaitingGrn = entries.filter(
      (entry) => entry.empty_weight && entry.empty_weight > 0 && !grnIds.has(entry.wbi_id)
    );
    const todayKey = new Date().toDateString();
    const arrivedToday = entries.filter((entry) => entry.date && new Date(entry.date).toDateString() === todayKey);
    return { awaitingWeight, awaitingGrn, arrivedToday };
  }, [wbis, grns]);

  const recent = useMemo(
    () =>
      [...(wbis ?? [])]
        .sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime())
        .slice(0, 3),
    [wbis]
  );

  return (
    <View style={{ gap: theme.spacing.md }}>
      <SectionHeader title="At the gate" caption="Vehicles moving through the weigh bridge" />

      {isLoading ? (
        <TileSkeletons count={3} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
            <StatTile
              label="Awaiting empty weight"
              value={formatNumber(stats.awaitingWeight.length)}
              hint={stats.awaitingWeight.length > 0 ? 'Needs action' : 'All clear'}
              icon="speedometer-outline"
              tone={stats.awaitingWeight.length > 0 ? 'warning' : 'success'}
              onPress={() => router.push('/operations/wbi-final')}
            />
            <StatTile
              label="Weighed, no GRN"
              value={formatNumber(stats.awaitingGrn.length)}
              icon="document-text-outline"
              tone={stats.awaitingGrn.length > 0 ? 'info' : 'neutral'}
              onPress={() => router.push('/operations/grn')}
            />
            <StatTile
              label="Arrived today"
              value={formatNumber(stats.arrivedToday.length)}
              icon="car-outline"
              tone="neutral"
              onPress={() => router.push('/operations/wbi-initial')}
            />
          </View>

          {recent.length > 0 && (
            <Card padded={false}>
              {recent.map((entry, index) => (
                <Pressable
                  key={entry._id}
                  accessibilityRole="button"
                  accessibilityLabel={`WBI ${entry.wbi_id}, vehicle ${entry.vehicle_no}`}
                  onPress={() => router.push(`/operations/wbi/${entry._id}?mode=initial`)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    padding: theme.spacing.md,
                    backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent',
                    borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: theme.colors.border,
                  })}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor:
                        entry.empty_weight && entry.empty_weight > 0 ? theme.colors.successSoft : theme.colors.warningSoft,
                    }}
                  >
                    <Ionicons
                      name={entry.empty_weight && entry.empty_weight > 0 ? 'checkmark' : 'time-outline'}
                      size={16}
                      color={entry.empty_weight && entry.empty_weight > 0 ? theme.colors.success : theme.colors.warning}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      WBI {entry.wbi_id} · {entry.vehicle_no || 'No vehicle'}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {formatNumber(entry.total_bags)} bags · {formatRelative(entry.updatedAt ?? entry.createdAt)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.faintText} />
                </Pressable>
              ))}
            </Card>
          )}
        </>
      )}
    </View>
  );
}

// ------------------------------------------------------------- pipeline tiles

function PipelineStatus() {
  const theme = useTheme();
  const router = useRouter();
  const { can } = usePermissions();

  const { data: saleOrders } = useSaleOrders();
  const { data: lots } = useLots();
  const { data: preOutwards } = usePreOutwards();

  const openOrders = (saleOrders ?? []).filter((order) => !order.is_completed).length;
  const openLots = (lots ?? []).filter((lot) => !lot.is_complete).length;
  const pendingDispatch = (preOutwards ?? []).reduce((sum, pre) => sum + (pre.total_bags_remaining ?? 0), 0);

  return (
    <View style={{ gap: theme.spacing.md }}>
      <SectionHeader title="In flight" caption="Work already started and not yet closed" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
        {can('saleorder:read') && (
          <StatTile
            label="Open sale orders"
            value={formatNumber(openOrders)}
            icon="cart-outline"
            tone="primary"
            onPress={() => router.push('/operations/saleorder')}
          />
        )}
        {can('lot:read') && (
          <StatTile
            label="Lots in progress"
            value={formatNumber(openLots)}
            icon="cog-outline"
            tone="warning"
            onPress={() => router.push('/operations/lot')}
          />
        )}
        {can('preoutward:read') && (
          <StatTile
            label="Bags reserved"
            value={formatNumber(pendingDispatch)}
            hint="Awaiting dispatch"
            icon="file-tray-full-outline"
            tone="info"
            onPress={() => router.push('/operations/preoutward')}
          />
        )}
      </View>
    </View>
  );
}

// --------------------------------------------------------------- quick action

function QuickActions() {
  const theme = useTheme();
  const router = useRouter();
  const { can } = usePermissions();

  const actions = [
    { label: 'Weigh in', icon: 'speedometer-outline' as const, path: '/operations/wbi/form?mode=initial', permission: 'wbi:create' },
    { label: 'New GRN', icon: 'document-text-outline' as const, path: '/operations/grn/form', permission: 'grn:create' },
    { label: 'Inventory', icon: 'clipboard-outline' as const, path: '/operations/inventory', permission: 'inventory:read' },
    { label: 'Transfer', icon: 'swap-horizontal-outline' as const, path: '/operations/stock-transfer', permission: 'stock-transfer:read' },
    { label: 'Sale order', icon: 'cart-outline' as const, path: '/operations/saleorder/form', permission: 'saleorder:create' },
    { label: 'Dispatch', icon: 'cloud-upload-outline' as const, path: '/operations/outward', permission: 'outward:read' },
  ].filter((action) => can(action.permission));

  if (actions.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.md }}>
      <SectionHeader title="Quick actions" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => router.push(action.path as never)}
            style={({ pressed }) => ({
              width: '30.6%',
              aspectRatio: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.sm,
              borderRadius: theme.radius.lg,
              backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.border,
            })}
          >
            <Ionicons name={action.icon} size={23} color={theme.colors.primary} />
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function TileSkeletons({ count }: { count: number }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} height={96} radius={theme.radius.lg} style={{ flex: 1 }} />
      ))}
    </View>
  );
}
