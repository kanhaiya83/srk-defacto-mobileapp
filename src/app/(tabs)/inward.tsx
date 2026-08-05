import { NavMenu } from '@/components/nav-menu';
import { Header, Screen } from '@/components/ui/screen';
import { INWARD } from '@/config/navigation';

export default function InwardTab() {
  return (
    <Screen>
      <Header title="Inward" subtitle="Gate to godown" onBack={null} large />
      <NavMenu items={INWARD} />
    </Screen>
  );
}
