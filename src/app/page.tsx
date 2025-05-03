
import { ReaderView } from '@/components/quran/ReaderView';
import { Header } from '@/components/layout/Header'; // Import Header

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
       <Header /> {/* Main App Header */}
       <main className="flex flex-grow flex-col"> {/* Remove padding/margin, let ReaderView handle it */}
          <ReaderView />
        </main>
     </div>
  );
}
