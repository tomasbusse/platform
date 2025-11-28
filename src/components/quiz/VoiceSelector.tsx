import React, { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';

interface Voice {
  id: string;
  name: string;
  gender: 'male' | 'female';
}

interface VoiceSelectorProps {
  language: 'english' | 'german';
  selectedVoiceId: string;
  onSelect: (voiceId: string, voiceName: string) => void;
  apiKey: string;
}

const VOICES: Record<string, Voice[]> = {
  english: [
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Emma', gender: 'female' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'James', gender: 'male' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Daniel', gender: 'male' },
  ],
  german: [
    { id: 'oWAxZDx7w5VEj9dCyTzz', name: 'Freya', gender: 'female' },
    { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Hans', gender: 'male' },
  ],
};

const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  language,
  selectedVoiceId,
  onSelect,
  apiKey,
}) => {
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const getPreview = useAction(api.ai.generateQuizAudio.getVoicePreview);

  const handlePreview = async (voiceId: string) => {
    // Stop any current preview
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }

    if (!apiKey) {
      setPreviewError('ElevenLabs API key not configured');
      return;
    }

    setPreviewingVoice(voiceId);
    setPreviewError(null);

    try {
      const result = await getPreview({ apiKey, voiceId, language });

      if (!result.success || !result.audioUrl) {
        setPreviewError(result.error || 'Failed to generate preview');
        setPreviewingVoice(null);
        return;
      }

      const audio = new Audio(result.audioUrl);
      audio.onended = () => {
        setPreviewingVoice(null);
      };
      audio.onerror = () => {
        setPreviewError('Failed to play audio');
        setPreviewingVoice(null);
      };
      audio.play();
      setPreviewAudio(audio);
    } catch (error) {
      console.error('Preview failed:', error);
      setPreviewError('Failed to generate preview');
      setPreviewingVoice(null);
    }
  };

  const stopPreview = () => {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }
    setPreviewingVoice(null);
  };

  const voices = VOICES[language] || VOICES.english;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-simmonds-charcoal">
        Select Voice for Audio
      </label>

      {previewError && (
        <div className="text-sm text-simmonds-terracotta bg-simmonds-terracotta/10 px-3 py-2 rounded-lg">
          {previewError}
        </div>
      )}

      <div className="grid gap-2">
        {voices.map((voice) => (
          <div
            key={voice.id}
            className={`
              flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer
              transition-all duration-200
              ${selectedVoiceId === voice.id
                ? 'border-simmonds-primary bg-simmonds-primary/5'
                : 'border-simmonds-cream hover:border-simmonds-stone/30'
              }
            `}
            onClick={() => onSelect(voice.id, voice.name)}
          >
            <div className="flex items-center gap-3">
              {/* Selection indicator */}
              <div
                className={`
                  w-5 h-5 rounded-full border-2 flex items-center justify-center
                  transition-all duration-200
                  ${selectedVoiceId === voice.id
                    ? 'border-simmonds-primary bg-simmonds-primary'
                    : 'border-simmonds-stone/40'
                  }
                `}
              >
                {selectedVoiceId === voice.id && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>

              {/* Voice info */}
              <div>
                <p className="font-medium text-simmonds-charcoal">{voice.name}</p>
                <p className="text-sm text-simmonds-stone capitalize">{voice.gender}</p>
              </div>
            </div>

            {/* Preview button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (previewingVoice === voice.id) {
                  stopPreview();
                } else {
                  handlePreview(voice.id);
                }
              }}
              disabled={previewingVoice !== null && previewingVoice !== voice.id}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium
                flex items-center gap-1.5 transition-all
                ${previewingVoice === voice.id
                  ? 'bg-simmonds-primary text-white'
                  : previewingVoice !== null
                    ? 'bg-simmonds-cream/50 text-simmonds-stone/50 cursor-not-allowed'
                    : 'bg-simmonds-cream text-simmonds-charcoal hover:bg-simmonds-stone/20'
                }
              `}
            >
              {previewingVoice === voice.id ? (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Playing...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Preview
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {!apiKey && (
        <p className="text-sm text-simmonds-stone">
          Configure ElevenLabs API key in Settings to preview voices.
        </p>
      )}
    </div>
  );
};

export default VoiceSelector;
