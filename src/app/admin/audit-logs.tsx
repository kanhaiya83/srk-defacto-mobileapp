import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { useAuditFilters, useAuditLogs } from '@/api/admin-queries';
import { ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { Header, Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { formatDateTime, formatRelative, humanize } from '@/lib/format';
import type { AuditLogEntry } from '@/types/auth';
import { useTheme } from '@/theme';

/**
 * Audit log.
 *
 * Every entry answers who, what and when; tapping one shows the field-level
 * diff. Values are rendered as before → after pairs rather than raw JSON,
 * because the question being asked is "what changed?", not "what is the shape
 * of this document?".
 */
export default function AuditLogsScreen() {
  const theme = useTheme();
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  const filters = useAuditFilters();
  const logs = useAuditLogs({ limit: 100, module: module || undefined, action: action || undefined });

  const entries = logs.data?.data ?? [];

  const toneFor = (entry: AuditLogEntry) =>
    entry.status === 'failure' ? ('danger' as const) : entry.action.toLowerCase().includes('delete') ? ('warning' as const) : ('success' as const);

  return (
    <Screen>
      <Header title="Audit Log" subtitle={`${logs.data?.meta.total ?? 0} recorded events`} />

      <ListBody<AuditLogEntry>
        items={entries}
        isLoading={logs.isLoading}
        isError={logs.isError}
        onRefresh={() => void logs.refetch()}
        refreshing={logs.isRefetching}
        keyExtractor={(item) => item._id}
        sortable={false}
        searchFields={(item) => [item.username, item.action, item.module, item.message, item.recordId]}
        searchPlaceholder="Search user, action, module…"
        emptyTitle="Nothing logged yet"
        emptyDescription="Changes made in the system will be recorded here."
        header={
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <Select
              value={module}
              options={(filters.data?.modules ?? []).map((entry) => ({
                value: entry.key,
                label: entry.label,
                description: entry.category,
              }))}
              onChange={setModule}
              title="Module"
              placeholder="Any module"
              clearable
              style={{ flex: 1 }}
            />
            <Select
              value={action}
              options={(filters.data?.actions ?? []).map((entry) => ({ value: entry, label: humanize(entry) }))}
              onChange={setAction}
              title="Action"
              placeholder="Any action"
              clearable
              style={{ flex: 1 }}
            />
          </View>
        }
        renderItem={(item) => (
          <RecordCard
            title={`${humanize(item.action)} · ${humanize(item.module)}`}
            subtitle={`${item.username} · ${formatRelative(item.createdAt)}`}
            icon={item.status === 'failure' ? 'alert-circle-outline' : 'time-outline'}
            badge={{ label: item.status, tone: toneFor(item) }}
            accent={item.status === 'failure' ? 'danger' : undefined}
            onPress={() => setSelected(item)}
          />
        )}
      />

      <Sheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `${humanize(selected.action)} · ${humanize(selected.module)}` : ''}
        subtitle={selected ? formatDateTime(selected.createdAt) : undefined}
      >
        {selected && (
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
            <View style={{ marginBottom: theme.spacing.md }}>
              <Badge label={selected.status} tone={toneFor(selected)} />
            </View>

            <SectionHeader title="Event" />
            <DetailRow label="User" value={selected.user?.name ?? selected.username} />
            <DetailRow label="Record" value={selected.modelName} />
            <DetailRow label="Record ID" value={selected.recordId} />
            <DetailRow label="Request" value={selected.method ? `${selected.method} ${selected.path ?? ''}` : null} />
            <DetailRow label="IP address" value={selected.ipAddress} />
            <DetailRow label="Request ID" value={selected.requestId} />
            {!!selected.message && <DetailRow label="Message" value={selected.message} />}

            {(selected.previousData || selected.newData) && (
              <>
                <View style={{ height: theme.spacing.lg }} />
                <SectionHeader title="Changes" caption="Before → after" />
                <ChangeList previous={selected.previousData} next={selected.newData} />
              </>
            )}

            <View style={{ height: theme.spacing.lg }} />
            <Button label="Close" variant="outline" fullWidth onPress={() => setSelected(null)} />
          </ScrollView>
        )}
      </Sheet>
    </Screen>
  );
}

/** Field-level diff of the two snapshots the server records. */
function ChangeList({
  previous,
  next,
}: {
  previous?: Record<string, unknown>;
  next?: Record<string, unknown>;
}) {
  const theme = useTheme();
  const keys = [...new Set([...Object.keys(previous ?? {}), ...Object.keys(next ?? {})])].filter(
    (key) => !['_id', '__v', 'createdAt', 'updatedAt'].includes(key)
  );

  const render = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  if (keys.length === 0) {
    return (
      <Text variant="caption" tone="muted">
        No field-level detail was recorded for this event.
      </Text>
    );
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {keys.map((key) => {
        const before = render(previous?.[key]);
        const after = render(next?.[key]);
        const changed = before !== after;
        return (
          <View
            key={key}
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              backgroundColor: changed ? theme.colors.surfaceAlt : 'transparent',
              gap: 3,
            }}
          >
            <Text variant="micro" tone="faint">
              {humanize(key).toUpperCase()}
            </Text>
            {changed ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                <Text variant="caption" tone="danger" style={{ textDecorationLine: 'line-through' }}>
                  {before}
                </Text>
                <Text variant="caption" tone="faint">
                  →
                </Text>
                <Text variant="caption" tone="success">
                  {after}
                </Text>
              </View>
            ) : (
              <Text variant="caption" tone="muted">
                {after}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
