import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Card, SectionHeader } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/misc';
import { Text } from '@/components/ui/text';
import type { LotBalance } from '@/features/operations/lot';
import { formatCurrency, formatNumber } from '@/lib/format';
import { useTheme } from '@/theme';

const signed = (value: number, digits = 2) => `${value > 0 ? '+' : ''}${formatNumber(value, digits)}`;

function Check({ ok, label }: { ok: boolean; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'close-circle'}
        size={18}
        color={ok ? theme.colors.success : theme.colors.danger}
      />
      <Text variant="caption" tone={ok ? 'muted' : 'danger'} style={{ flex: 1 }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Input against output, and the two rules a lot must meet to be completed:
 * output weight within 5% of input, output value within ₹1 of input value.
 */
export function LotBalanceCard({ balance, complete }: { balance: LotBalance; complete?: boolean }) {
  const theme = useTheme();
  const weightPct = balance.inputWeight ? (balance.weightGap / balance.inputWeight) * 100 : 0;

  return (
    <Card>
      <SectionHeader title="Balance" caption={complete ? 'As completed' : 'Input against output'} />
      <DetailRow label="Input value" value={formatCurrency(balance.inputAmount)} />
      <DetailRow label="Output value" value={formatCurrency(balance.outputAmount)} />
      <DetailRow
        label="Value difference"
        value={`${balance.amountGap > 0 ? '+' : ''}${formatCurrency(balance.amountGap)}`}
        tone={balance.amountOk ? 'success' : 'danger'}
        emphasis
      />
      <DetailRow
        label="Weight difference"
        value={`${signed(balance.weightGap)} kg (${signed(weightPct, 1)}%)`}
        tone={balance.weightOk ? 'success' : 'danger'}
        emphasis
      />
      {!complete && (
        <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.md }}>
          <Check ok={balance.outputBags > 0} label="Output recorded" />
          <Check
            ok={balance.outputBags > 0 && balance.weightOk}
            label={`Weight within 5% of input (±${formatNumber(balance.weightTolerance, 2)} kg)`}
          />
          <Check ok={balance.outputBags > 0 && balance.amountOk} label="Value matches input within ₹1" />
        </View>
      )}
    </Card>
  );
}
