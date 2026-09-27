import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Field, NumberInput } from '@/components/ui/field';
import { Callout, SearchBar } from '@/components/ui/misc';
import { Sheet, SheetBody } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { formatDate, formatNumber } from '@/lib/format';
import { objectId } from '@/lib/object-id';
import { useTheme } from '@/theme';

/** Somewhere bags can be drawn from: a stock batch, or a pre-lot's reserved share of one. */
export interface StockSource {
  id: string;
  title: string;
  subtitle?: string;
  /** Most bags / weight all lines from this source together may take. */
  capBags: number;
  capWeight: number;
  /** Rupees per kg, for the running value. */
  ratePerKg?: number;
}

/** One draw from a source. A source may be drawn from more than once (on different dates). */
export interface StockLine {
  key: string;
  sourceId: string;
  bags: number;
  weight: number;
  date: string;
  /** Already used downstream: the line cannot drop below this or be removed. */
  floorBags?: number;
  floorWeight?: number;
}

export const newLineKey = () => objectId();

const sumFor = (lines: StockLine[], sourceId: string, exceptKey?: string) =>
  lines
    .filter((line) => line.sourceId === sourceId && line.key !== exceptKey)
    .reduce((acc, line) => ({ bags: acc.bags + line.bags, weight: acc.weight + line.weight }), { bags: 0, weight: 0 });

/** What a source still offers after the lines already drawn from it (other than `exceptKey`). */
export const remainingIn = (source: StockSource, lines: StockLine[], exceptKey?: string) => {
  const used = sumFor(lines, source.id, exceptKey);
  return {
    bags: Math.max(0, source.capBags - used.bags),
    weight: Math.max(0, source.capWeight - used.weight),
  };
};

export const lineTotals = (lines: StockLine[], sources: StockSource[]) => {
  const rate = new Map(sources.map((source) => [source.id, source.ratePerKg ?? 0]));
  return lines.reduce(
    (acc, line) => ({
      bags: acc.bags + line.bags,
      weight: acc.weight + line.weight,
      value: acc.value + line.weight * (rate.get(line.sourceId) ?? 0),
    }),
    { bags: 0, weight: 0, value: 0 }
  );
};

type Draft = { key: string | null; sourceId: string; bags: number | ''; weight: number | ''; date: string };

/**
 * Picking stock, line by line — pre-lot allocations and lot inputs.
 *
 * Choosing a source and entering its quantity are two short sheets in turn,
 * never a sheet inside a form sheet, so the keyboard always has room. Weight
 * follows the bags at the source's remaining average and can be corrected.
 */
export function StockLinesEditor({
  sources,
  lines,
  onChange,
  withDate,
  minDate,
  defaultDate,
  readOnly,
  noun = 'line',
  emptyHint,
  sourcesLoading,
}: {
  sources: StockSource[];
  lines: StockLine[];
  onChange: (lines: StockLine[]) => void;
  /** Each line carries its own date. */
  withDate?: boolean;
  /** Line dates may not be earlier than this (`YYYY-MM-DD`). */
  minDate?: string;
  defaultDate: string;
  readOnly?: boolean;
  /** "allocation", "input" — used in labels. */
  noun?: string;
  emptyHint?: string;
  sourcesLoading?: boolean;
}) {
  const theme = useTheme();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);

  const byId = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);

  const offered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sources
      .map((source) => ({ source, left: remainingIn(source, lines) }))
      .filter(({ left }) => left.bags > 0)
      .filter(({ source }) => !q || [source.title, source.subtitle].join(' ').toLowerCase().includes(q));
  }, [sources, lines, query]);

  const minDay = useMemo(() => {
    const [y, m, d] = (minDate ?? '').split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d) : undefined;
  }, [minDate]);

  const openNew = (source: StockSource) => {
    const left = remainingIn(source, lines);
    setPicking(false);
    // Let the list sheet finish closing before the quantity sheet opens.
    setTimeout(
      () => setDraft({ key: null, sourceId: source.id, bags: left.bags, weight: Number(left.weight.toFixed(2)), date: defaultDate }),
      160
    );
  };

  const draftSource = draft ? byId.get(draft.sourceId) : undefined;
  const draftLeft = draftSource ? remainingIn(draftSource, lines, draft?.key ?? undefined) : { bags: 0, weight: 0 };
  const draftLine = draft?.key ? lines.find((line) => line.key === draft.key) : undefined;
  const perBag = draftLeft.bags > 0 ? draftLeft.weight / draftLeft.bags : 0;

  const setDraftBags = (value: number | '') => {
    if (!draft) return;
    const bags = value === '' ? '' : Math.max(0, Math.floor(Number(value)));
    // Taking everything left takes exactly the weight left, so rounding never strands a few grams.
    const weight = bags === '' ? '' : bags >= draftLeft.bags ? Number(draftLeft.weight.toFixed(2)) : Number((Number(bags) * perBag).toFixed(2));
    setDraft({ ...draft, bags, weight });
  };

  const commit = () => {
    if (!draft || !draftSource) return;
    const bags = Number(draft.bags || 0);
    const weight = Number(draft.weight || 0);
    if (bags <= 0) return toast.error('Enter how many bags');
    if (bags > draftLeft.bags) return toast.error(`Only ${formatNumber(draftLeft.bags)} bags left in ${draftSource.title}`);
    if (weight > draftLeft.weight + 0.01) {
      return toast.error(`Only ${formatNumber(draftLeft.weight, 2)} kg left in ${draftSource.title}`);
    }
    if (draftLine?.floorBags && bags < draftLine.floorBags) {
      return toast.error(`${formatNumber(draftLine.floorBags)} bags are already used by lots`, {
        description: 'The line cannot go below that.',
      });
    }
    if (draftLine?.floorWeight && weight + 0.01 < draftLine.floorWeight) {
      return toast.error(`${formatNumber(draftLine.floorWeight, 2)} kg is already used by lots`);
    }
    if (withDate && minDate && draft.date < minDate) return toast.error('The date cannot be before the form date');

    const next: StockLine = {
      ...(draftLine ?? {}),
      key: draft.key ?? newLineKey(),
      sourceId: draft.sourceId,
      bags,
      weight,
      date: draft.date,
    };
    onChange(draft.key ? lines.map((line) => (line.key === draft.key ? next : line)) : [...lines, next]);
    setDraft(null);
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      {lines.length === 0 && (
        <Callout tone="info" title={`No ${noun}s yet`} description={emptyHint ?? 'Add the stock to draw from.'} />
      )}

      {lines.map((line) => {
        const source = byId.get(line.sourceId);
        const locked = Boolean(line.floorBags);
        return (
          <Card key={line.key} padded={false}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Change ${noun} from ${source?.title ?? 'stock'}`}
              disabled={readOnly}
              onPress={() =>
                setDraft({ key: line.key, sourceId: line.sourceId, bags: line.bags, weight: line.weight, date: line.date })
              }
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                padding: theme.spacing.md,
                backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent',
              })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {source?.title ?? 'Stock no longer listed'}
                </Text>
                {!!source?.subtitle && (
                  <Text variant="caption" tone="muted" numberOfLines={2}>
                    {source.subtitle}
                  </Text>
                )}
                {(withDate || locked) && (
                  <Text variant="caption" tone="faint">
                    {[withDate ? formatDate(line.date) : null, locked ? `${formatNumber(line.floorBags)} bags used by lots` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 1 }}>
                <Text variant="bodyStrong" tone="primary" numeric>
                  {formatNumber(line.bags)} bags
                </Text>
                <Text variant="caption" tone="faint" numeric>
                  {formatNumber(line.weight, 2)} kg
                </Text>
              </View>
              {!readOnly && (
                <IconButton
                  icon="close"
                  tone="danger"
                  accessibilityLabel={`Remove ${noun}`}
                  onPress={() => {
                    if (locked) {
                      toast.error(`${formatNumber(line.floorBags)} bags of this ${noun} are already used by lots`, {
                        description: 'It cannot be removed.',
                      });
                      return;
                    }
                    onChange(lines.filter((other) => other.key !== line.key));
                  }}
                />
              )}
            </Pressable>
          </Card>
        );
      })}

      {!readOnly && (
        <Button
          label={`Add ${noun}`}
          icon="add"
          variant="outline"
          fullWidth
          loading={sourcesLoading}
          onPress={() => {
            setQuery('');
            setPicking(true);
          }}
        />
      )}

      <Sheet open={picking} onClose={() => setPicking(false)} title="Choose stock" subtitle="Only stock with bags left is listed">
        {sources.length > 6 && (
          <View style={{ paddingHorizontal: theme.spacing.lg }}>
            <SearchBar value={query} onChange={setQuery} placeholder="Search entry, grade, location…" />
          </View>
        )}
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
          {offered.length === 0 && (
            <Text tone="muted" style={{ textAlign: 'center', paddingVertical: theme.spacing.xl }}>
              {query.trim() ? `Nothing matches “${query.trim()}”.` : 'No stock left to draw from.'}
            </Text>
          )}
          {offered.map(({ source, left }) => (
            <Pressable
              key={source.id}
              accessibilityRole="button"
              accessibilityLabel={`Use ${source.title}`}
              onPress={() => openNew(source)}
              style={({ pressed }) => ({
                padding: theme.spacing.md,
                borderRadius: theme.radius.md,
                gap: 3,
                backgroundColor: pressed ? theme.colors.surfaceActive : theme.colors.surfaceAlt,
              })}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}>
                <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                  {source.title}
                </Text>
                <Text variant="bodyStrong" tone="primary" numeric>
                  {formatNumber(left.bags)} bags
                </Text>
              </View>
              {!!source.subtitle && (
                <Text variant="caption" tone="muted">
                  {source.subtitle}
                </Text>
              )}
              <Text variant="caption" tone="faint">
                {formatNumber(left.weight, 2)} kg left
                {source.ratePerKg ? ` · ₹${formatNumber(source.ratePerKg, 2)}/kg` : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>

      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draftSource?.title}
        subtitle={draft?.key ? `Change this ${noun}` : `How much for this ${noun}?`}
        footer={
          <>
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setDraft(null)} />
            <Button label={draft?.key ? 'Update' : 'Add'} style={{ flex: 2 }} onPress={commit} />
          </>
        }
      >
        {draft && draftSource && (
          <SheetBody>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field
                label="Bags"
                required
                style={{ flex: 1 }}
                error={draft.bags !== '' && Number(draft.bags) > draftLeft.bags ? `Max ${draftLeft.bags}` : undefined}
              >
                <NumberInput
                  value={draft.bags}
                  onChangeValue={setDraftBags}
                  keyboardType="number-pad"
                  autoFocus
                  error={draft.bags !== '' && Number(draft.bags) > draftLeft.bags}
                />
              </Field>
              <Field label="Weight" style={{ flex: 1.3 }}>
                <NumberInput value={draft.weight} onChangeValue={(weight) => setDraft({ ...draft, weight })} suffix="kg" />
              </Field>
            </View>
            <Text variant="caption" tone="muted">
              {formatNumber(draftLeft.bags)} bags · {formatNumber(draftLeft.weight, 2)} kg available
              {perBag ? ` · ${formatNumber(perBag, 2)} kg/bag` : ''}
            </Text>
            {withDate && (
              <Field label="Date" hint={minDate ? 'Not before the form date' : undefined}>
                <DateField value={draft.date} onChange={(date) => setDraft({ ...draft, date })} minimumDate={minDay} />
              </Field>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => setDraft({ ...draft, bags: draftLeft.bags, weight: Number(draftLeft.weight.toFixed(2)) })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
            >
              <Ionicons name="flash-outline" size={15} color={theme.colors.primary} />
              <Text variant="label" tone="primary">
                Take everything left
              </Text>
            </Pressable>
          </SheetBody>
        )}
      </Sheet>
    </View>
  );
}
