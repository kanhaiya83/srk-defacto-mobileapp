import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/ui/feedback';
import { Header, Screen } from '@/components/ui/screen';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Header title="Not found" onBack={() => router.replace('/')} />
      <EmptyState
        icon="compass-outline"
        title="That screen does not exist"
        description="The link may be out of date, or the screen may have moved."
        actionLabel="Go home"
        actionIcon="home-outline"
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}
