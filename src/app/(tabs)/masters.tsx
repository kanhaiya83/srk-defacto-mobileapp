import { NavMenu } from '@/components/nav-menu';
import { Header, Screen } from '@/components/ui/screen';
import { MASTERS } from '@/config/navigation';

export default function MastersTab() {
  return (
    <Screen>
      <Header title="Masters" subtitle="Reference data behind every entry" onBack={null} large />
      <NavMenu items={MASTERS} searchPlaceholder="Find a master…" />
    </Screen>
  );
}
