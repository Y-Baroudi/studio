
import { ReaderView } from '@/components/quran/ReaderView';
// Removed Header import as it's now inside ReaderView

export default function Home() {
  return (
    // ReaderView now encompasses the header and the main content area
    <ReaderView />
  );
}
