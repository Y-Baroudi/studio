import { ReaderView } from '@/components/quran/ReaderView';
import { Header } from '@/components/layout/Header'; // Import Header

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
       <Header /> {/* Add Header */}
       <main className="flex flex-grow flex-col items-center justify-start p-4 md:p-8 lg:p-12 mt-4"> {/* Adjust padding/margin */}
          <ReaderView />
        </main>
     </div>
  );
}
