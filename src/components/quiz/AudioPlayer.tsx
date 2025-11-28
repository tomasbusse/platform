import React, { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
  audioUrl: string;
  replaysAllowed: number;
  onComplete?: () => void;
  compact?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  replaysAllowed,
  onComplete,
  compact = false,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [replaysUsed, setReplaysUsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const replaysRemaining = replaysAllowed - replaysUsed;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress(audio.currentTime);
    };

    const handleLoaded = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setHasPlayedOnce(true);
      onComplete?.();
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', handleLoaded);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [onComplete]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // Check if can play (first time or has replays)
      if (hasPlayedOnce && replaysRemaining <= 0) {
        return; // No replays left
      }
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleReplay = () => {
    if (replaysRemaining <= 0) return;

    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    audio.play();
    setIsPlaying(true);
    setReplaysUsed((prev) => prev + 1);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    audio.currentTime = newTime;
    setProgress(newTime);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const canPlay = !hasPlayedOnce || replaysRemaining > 0;

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-2 bg-simmonds-cream/50 rounded-lg">
        <audio ref={audioRef} src={audioUrl} preload="metadata" />

        {/* Play Button */}
        <button
          onClick={togglePlay}
          disabled={!canPlay || isLoading}
          className={`
            w-8 h-8 rounded-full flex items-center justify-center
            transition-all duration-200
            ${!canPlay || isLoading
              ? 'bg-simmonds-stone/30 text-simmonds-stone/50 cursor-not-allowed'
              : 'bg-simmonds-primary text-white hover:bg-simmonds-primary-light'
            }
          `}
        >
          {isLoading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* Progress */}
        <div className="flex-1">
          <div
            className="h-1.5 bg-simmonds-stone/20 rounded-full cursor-pointer"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-simmonds-primary rounded-full transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Time */}
        <span className="text-xs text-simmonds-stone min-w-[40px]">
          {formatTime(progress)}/{formatTime(duration)}
        </span>

        {/* Replays */}
        {replaysAllowed > 0 && (
          <span className={`text-xs ${replaysRemaining === 0 ? 'text-simmonds-terracotta' : 'text-simmonds-stone'}`}>
            {replaysRemaining}x
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-simmonds-cream/50 to-white rounded-2xl p-6 border border-simmonds-cream shadow-sm">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Progress Bar */}
      <div className="mb-5">
        <div
          className="relative h-2 bg-simmonds-stone/20 rounded-full overflow-hidden cursor-pointer"
          onClick={handleSeek}
        >
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-simmonds-primary to-simmonds-primary-light rounded-full transition-all duration-100"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-simmonds-stone font-medium">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Main Play Button */}
          <button
            onClick={togglePlay}
            disabled={!canPlay || isLoading}
            className={`
              w-14 h-14 rounded-full flex items-center justify-center
              transition-all duration-200 transform
              ${!canPlay || isLoading
                ? 'bg-simmonds-stone/30 text-simmonds-stone/50 cursor-not-allowed'
                : 'bg-gradient-to-br from-simmonds-primary to-simmonds-primary-dark text-white hover:scale-105 hover:shadow-lg active:scale-95'
              }
            `}
          >
            {isLoading ? (
              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Replay Button */}
          {replaysAllowed > 0 && (
            <button
              onClick={handleReplay}
              disabled={replaysRemaining <= 0 || isPlaying || !hasPlayedOnce}
              className={`
                w-11 h-11 rounded-full flex items-center justify-center
                transition-all duration-200
                ${replaysRemaining <= 0 || isPlaying || !hasPlayedOnce
                  ? 'bg-simmonds-cream text-simmonds-stone/40 cursor-not-allowed'
                  : 'bg-simmonds-cream text-simmonds-charcoal hover:bg-simmonds-stone/20'
                }
              `}
              title={hasPlayedOnce ? `Replay (${replaysRemaining} left)` : 'Play first to enable replay'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}

          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className="w-11 h-11 rounded-full flex items-center justify-center bg-simmonds-cream text-simmonds-charcoal hover:bg-simmonds-stone/20 transition-all"
          >
            {isMuted ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>

        {/* Replay Counter */}
        {replaysAllowed > 0 && (
          <div className="text-sm font-medium">
            <span className={replaysRemaining === 0 ? 'text-simmonds-terracotta' : 'text-simmonds-stone'}>
              {replaysRemaining} replay{replaysRemaining !== 1 ? 's' : ''} left
            </span>
          </div>
        )}
      </div>

      {/* Instructions */}
      {!hasPlayedOnce && (
        <p className="text-center text-sm text-simmonds-stone mt-4">
          Press play to listen to the audio.
          {replaysAllowed > 0 && ` You can replay ${replaysAllowed} time${replaysAllowed !== 1 ? 's' : ''}.`}
        </p>
      )}

      {/* No replays warning */}
      {hasPlayedOnce && replaysRemaining === 0 && (
        <p className="text-center text-sm text-simmonds-terracotta mt-4">
          No replays remaining. Answer the questions based on what you heard.
        </p>
      )}
    </div>
  );
};

export default AudioPlayer;
