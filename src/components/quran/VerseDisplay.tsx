import type { Verse } from '@/services/alquran-cloud';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface VerseDisplayProps {
  verse: Verse;
  fontSize: number; // Base font size for English text in pixels
}

export function VerseDisplay({ verse, fontSize }: VerseDisplayProps) {
  // English text styles based on the passed prop (default 16px)
  const englishStyle = {
    fontSize: `${fontSize}px`,
    lineHeight: '1.6',
    letterSpacing: '0.01em',
  };

  // Arabic text styles (now 24px)
  const arabicStyle = {
    fontSize: '24px', // Increased size
    lineHeight: '1.8', // Adjusted line height
    letterSpacing: '0.005em',
  };

  // Determine if Bismillah should be shown
  // Bismillah is shown at the start of every Surah except Surah 9 (At-Tawbah)
  // It should appear if the current verse is the *first* ayah of any surah *other than* 1 (Al-Fatihah, implicitly included) and 9.
  const ayahNumberInSurah = parseInt(verse.verseReference.split(':')[1], 10);
  const showBismillah = ayahNumberInSurah === 1 && verse.surah?.number !== 1 && verse.surah?.number !== 9;
  const bismillahText = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

  const ayahNumber = verse.verseReference.split(':')[1];

  return (
    // Added border directly here
    <Card className="bg-card border border-border shadow-md flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4 md:px-6">
         {/* Optional Bismillah */}
         {showBismillah && (
           <p className="font-bismillah text-center text-foreground mb-4">
             {bismillahText}
           </p>
         )}
        <div className="flex justify-between items-start gap-4">
          {/* English Title */}
          <div className="text-left">
            <CardTitle className="text-lg font-semibold text-foreground">
               {verse.surah?.number}. {verse.surah?.englishName ?? 'The Quran'}
            </CardTitle>
            <CardDescription className="text-left text-foreground/70">
              {verse.surah?.englishNameTranslation} ({verse.surah?.numberOfAyahs} Ayahs)
            </CardDescription>
          </div>
          {/* Arabic Title */}
          <div className="text-right">
            {/* Use font-amiri for the Arabic title */}
            <CardTitle className="text-lg font-amiri font-normal text-foreground">
               {verse.surah?.name ? `${verse.surah.name} - ${verse.surah.number}` : 'القرآن'}
            </CardTitle>
             {/* Make revelation type smaller and italic */}
            <CardDescription className="text-right text-[0.6rem] italic text-foreground/60"> {/* Reduced font size */}
               {verse.surah?.revelationType}
             </CardDescription>
          </div>
        </div>
      </CardHeader>
      <Separator className="mx-4 md:mx-6" />
      <CardContent className="p-4 md:p-6 flex-grow">
        {/* Single-column layout, Arabic on top, English on bottom */}
        <div className="grid grid-cols-1 gap-4">

          {/* Arabic Text Section (Top) */}
          <div dir="rtl">
            {/* Use font-amiri and apply specific Arabic styles */}
            <p className="font-amiri text-foreground text-right tracking-normal" style={arabicStyle}>
               {verse.arabicText}
               {/* Styling for the Arabic verse number indicator */}
               <span className="text-sm font-normal opacity-70 mx-1 font-sans">﴿{ayahNumber}﴾</span>
            </p>
          </div>

          {/* Horizontal Separator */}
          <Separator className="my-2" />

          {/* English Translation Section (Bottom) */}
          <div>
            <p className="text-foreground text-left tracking-wide" style={englishStyle}>
              <span className="text-xs font-semibold opacity-70 mr-1">{ayahNumber}.</span>
              {verse.englishTranslation}
            </p>
          </div>

        </div>
      </CardContent>
       {/* Placeholder for Bookmark Indicator - can be added conditionally */}
       {/* {verse.isBookmarked && (
         <div className="absolute top-2 right-2 text-yellow-500">
           <Bookmark size={18} /> // Assuming a Bookmark icon component
         </div>
       )} */}
    </Card>
  );
}
