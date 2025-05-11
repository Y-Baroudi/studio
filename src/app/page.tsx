
import { ReaderView } from '@/components/quran/ReaderView';
// The main navigation will be part of the RootLayout now.
// The ReaderView is kept here as the main content for the homepage for now.
// Users can navigate to other sections via the new AppNav.

export default function Home() {
  return (
    <ReaderView />
  );
}
