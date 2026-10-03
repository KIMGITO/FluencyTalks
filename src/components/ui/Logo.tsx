export const Logo = ({ compact }: { compact?: boolean }) => (
  <span className="flex items-center gap-2">
    <span className="flex h-9 w-9 items-center justify-center overflow-hidden">
      <img 
        src="/favicon.png" 
        alt="FluencyTalks Logo" 
        className="h-full w-full object-contain" 
      />
    </span>
    {!compact && (
      <span className="font-display text-xl font-bold">
        Fluency<span className="ft-gradient-text">Talks</span>
      </span>
    )}
  </span>
);