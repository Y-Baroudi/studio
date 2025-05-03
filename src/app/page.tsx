import { ReaderView } from '@/components/quran/ReaderView';
import { Header } from '@/components/layout/Header'; // Import Header

export default function Home() {
  return (
    <div className="flex h-screen flex-col"> {/* Use flex-col and h-screen */}
       <Header /> {/* Main App Header */}
       <ReaderView /> {/* ReaderView now contains its own header, scroll area, and controls */}
     </div>
  );
}
