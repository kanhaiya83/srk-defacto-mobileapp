import { NavMenu } from '@/components/nav-menu';
import { Header, Screen } from '@/components/ui/screen';
import { OUTWARD } from '@/config/navigation';

export default function OutwardTab() {
  return (
    <Screen>
      <Header title="Outward" subtitle="Orders to dispatch" onBack={null} large />
      <NavMenu items={OUTWARD} />
    </Screen>
  );
}
