import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';
import QuizBuilder from '../components/QuizBuilder';
import QuestionBank from '../components/QuestionBank';

interface PageComponentProps {
  currentUser: User | null;
  company: Company | null;
}

const TeacherTools: React.FC<PageComponentProps> = ({ currentUser, company }) => {
  const [activeTab, setActiveTab] = useState('quiz-builder');
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioText, setAudioText] = useState('');
  const [audioVoice, setAudioVoice] = useState('21m00Tcm4TlvDq8ikWAM'); // Rachel voice
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState('lesson');
  const [contentLevel, setContentLevel] = useState('A1');
  const [contentPrompt, setContentPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);

  // Get company quizzes
  const quizzes = useQuery(
    api.quizzes.getCompanyQuizzes,
    company?._id ? { companyId: company._id as Id<"companies"> } : 'skip'
  );

  // ElevenLabs Voice options
  const voices = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', accent: 'American' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', accent: 'American' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', accent: 'American' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', accent: 'American' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', accent: 'American' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', accent: 'American' },
    { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', accent: 'American' },
  ];

  const generateAudio = async () => {
    if (!audioText || !company?.settings?.elevenLabsApiKey) {
      if (!company?.settings?.elevenLabsApiKey) {
        alert('Please configure your ElevenLabs API key in Settings');
      }
      return;
    }

    setIsGenerating(true);
    setGeneratedAudioUrl(null);

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${audioVoice}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': company.settings.elevenLabsApiKey,
          },
          body: JSON.stringify({
            text: audioText,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      setGeneratedAudioUrl(audioUrl);
      alert('Audio generated successfully!');
    } catch (error) {
      console.error('Audio generation error:', error);
      alert(`Failed to generate audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAIContent = async () => {
    if (!contentPrompt || !company?.settings?.openRouterApiKey) {
      if (!company?.settings?.openRouterApiKey) {
        alert('Please configure your OpenRouter API key in Settings');
      }
      return;
    }

    setIsGenerating(true);
    setGeneratedContent(null);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${company.settings.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Simmonds Language Platform',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [
            {
              role: 'system',
              content: `You are an expert English language teacher creating content for ${contentLevel} level students according to CEFR standards. Create engaging, educational content that is appropriate for this level.`
            },
            {
              role: 'user',
              content: `Create a ${contentType} for ${contentLevel} level English learners about: ${contentPrompt}

              Make it engaging and appropriate for the level. Include:
              - Clear learning objectives
              - Main content/explanation
              - Practice exercises or examples
              - Summary or key takeaways`
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content in response');
      }

      setGeneratedContent(content);
      alert('Content generated successfully!');
    } catch (error) {
      console.error('Content generation error:', error);
      alert(`Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderQuizBuilder = () => (
    <QuizBuilder
      currentUser={currentUser}
      company={company}
      onQuizCreated={(quizId) => {
        console.log('Quiz created:', quizId);
      }}
    />
  );

  const renderQuestionBank = () => (
    <QuestionBank currentUser={currentUser} company={company} />
  );

  const renderQuizList = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-simmonds-charcoal">My Quizzes</h3>
          <button
            onClick={() => setActiveTab('quiz-builder')}
            className="px-4 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light"
          >
            + Create New Quiz
          </button>
        </div>

        {!quizzes || quizzes.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-simmonds-cream rounded-xl">
            <p className="text-simmonds-stone mb-4">No quizzes created yet</p>
            <button
              onClick={() => setActiveTab('quiz-builder')}
              className="px-4 py-2 bg-simmonds-primary/10 text-simmonds-primary rounded-xl font-medium hover:bg-simmonds-primary/20"
            >
              Create Your First Quiz
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {quizzes.map((quiz) => (
              <div
                key={quiz._id}
                className="border border-simmonds-cream rounded-xl p-4 hover:border-simmonds-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-simmonds-charcoal">{quiz.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        quiz.isPublished
                          ? 'bg-simmonds-lime/20 text-simmonds-lime-dark'
                          : 'bg-simmonds-cream text-simmonds-stone'
                      }`}>
                        {quiz.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-simmonds-primary/10 text-simmonds-primary rounded text-xs">
                        {quiz.level}
                      </span>
                      <span className="px-2 py-0.5 bg-simmonds-olive/10 text-simmonds-olive rounded text-xs">
                        {quiz.quizType}
                      </span>
                      <span className="px-2 py-0.5 bg-simmonds-cream text-simmonds-stone rounded text-xs">
                        {quiz.totalQuestions} questions
                      </span>
                      <span className="px-2 py-0.5 bg-simmonds-cream text-simmonds-stone rounded text-xs">
                        {quiz.duration} min
                      </span>
                    </div>
                    {quiz.description && (
                      <p className="text-sm text-simmonds-stone">{quiz.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-sm text-simmonds-primary hover:underline">
                      Edit
                    </button>
                    {!quiz.isPublished && (
                      <button className="text-sm text-simmonds-lime-dark hover:underline">
                        Publish
                      </button>
                    )}
                    <button className="text-sm text-simmonds-olive hover:underline">
                      Assign
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderAudioContent = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Generate Audio with ElevenLabs</h3>
        <p className="text-sm text-simmonds-stone mb-4">
          Convert text to natural-sounding speech for listening exercises
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Voice</label>
            <select
              value={audioVoice}
              onChange={(e) => setAudioVoice(e.target.value)}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
            >
              {voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name} ({voice.accent})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Text to Convert</label>
            <textarea
              value={audioText}
              onChange={(e) => setAudioText(e.target.value)}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-32"
              placeholder="Enter the text you want to convert to speech..."
            />
          </div>

          <button
            onClick={generateAudio}
            disabled={isGenerating || !audioText}
            className="px-6 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : 'Generate Audio'}
          </button>

          {generatedAudioUrl && (
            <div className="mt-4 p-4 bg-simmonds-lime/10 rounded-xl">
              <p className="text-sm font-medium text-simmonds-lime-dark mb-2">Generated Audio:</p>
              <audio controls className="w-full">
                <source src={generatedAudioUrl} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
              <a
                href={generatedAudioUrl}
                download="generated-audio.mp3"
                className="inline-block mt-2 text-sm text-simmonds-primary hover:underline"
              >
                Download Audio
              </a>
            </div>
          )}
        </div>
      </div>

      {!company?.settings?.elevenLabsApiKey && (
        <div className="bg-simmonds-terracotta/10 p-4 rounded-xl">
          <p className="text-simmonds-terracotta font-medium">ElevenLabs API Key Required</p>
          <p className="text-sm text-simmonds-terracotta/80">
            Please configure your ElevenLabs API key in Settings to use audio generation.
          </p>
        </div>
      )}
    </div>
  );

  const renderAIContent = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Generate AI Content with OpenRouter</h3>
        <p className="text-sm text-simmonds-stone mb-4">
          Create lessons, exercises, and educational content using AI
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Content Type</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              >
                <option value="lesson">Lesson</option>
                <option value="exercise">Exercise</option>
                <option value="reading passage">Reading Passage</option>
                <option value="dialogue">Dialogue</option>
                <option value="vocabulary list">Vocabulary List</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Level</label>
              <select
                value={contentLevel}
                onChange={(e) => setContentLevel(e.target.value)}
                className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
              >
                <option value="A1">A1 - Beginner</option>
                <option value="A2">A2 - Elementary</option>
                <option value="B1">B1 - Intermediate</option>
                <option value="B2">B2 - Upper Intermediate</option>
                <option value="C1">C1 - Advanced</option>
                <option value="C2">C2 - Proficient</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">Topic or Instructions</label>
            <textarea
              value={contentPrompt}
              onChange={(e) => setContentPrompt(e.target.value)}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-24"
              placeholder="e.g., Present perfect tense for talking about experiences, Vocabulary about traveling..."
            />
          </div>

          <button
            onClick={generateAIContent}
            disabled={isGenerating || !contentPrompt}
            className="px-6 py-2 bg-simmonds-olive text-white rounded-xl font-medium hover:bg-simmonds-olive-light disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : 'Generate Content'}
          </button>

          {generatedContent && (
            <div className="mt-4 p-4 bg-simmonds-cream/50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-simmonds-charcoal">Generated Content:</p>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedContent)}
                  className="text-sm text-simmonds-primary hover:underline"
                >
                  Copy to Clipboard
                </button>
              </div>
              <div className="prose prose-sm max-w-none text-simmonds-charcoal whitespace-pre-wrap">
                {generatedContent}
              </div>
            </div>
          )}
        </div>
      </div>

      {!company?.settings?.openRouterApiKey && (
        <div className="bg-simmonds-terracotta/10 p-4 rounded-xl">
          <p className="text-simmonds-terracotta font-medium">OpenRouter API Key Required</p>
          <p className="text-sm text-simmonds-terracotta/80">
            Please configure your OpenRouter API key in Settings to use AI content generation.
          </p>
        </div>
      )}
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Total Quizzes</p>
          <p className="text-2xl font-bold text-simmonds-primary">{quizzes?.length || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Published</p>
          <p className="text-2xl font-bold text-simmonds-lime-dark">
            {quizzes?.filter(q => q.isPublished).length || 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Total Questions</p>
          <p className="text-2xl font-bold text-simmonds-olive">
            {quizzes?.reduce((sum, q) => sum + q.totalQuestions, 0) || 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-simmonds-cream">
          <p className="text-sm text-simmonds-stone">Cambridge Aligned</p>
          <p className="text-2xl font-bold text-simmonds-terracotta">
            {quizzes?.filter(q => q.isCambridgeAligned).length || 0}
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <h3 className="text-lg font-semibold text-simmonds-charcoal mb-4">Quizzes by Level</h3>
        <div className="grid grid-cols-6 gap-4">
          {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(level => {
            const count = quizzes?.filter(q => q.level === level).length || 0;
            return (
              <div key={level} className="text-center">
                <div className="w-full h-24 bg-simmonds-cream rounded-xl flex items-end justify-center pb-2">
                  <div
                    className="bg-simmonds-primary rounded-lg w-8"
                    style={{ height: `${Math.min(count * 20, 80)}%` }}
                  />
                </div>
                <p className="mt-2 font-medium text-simmonds-charcoal">{level}</p>
                <p className="text-sm text-simmonds-stone">{count} quiz{count !== 1 ? 'es' : ''}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'quiz-builder', name: 'Quiz Builder', icon: 'Create' },
    { id: 'question-bank', name: 'Question Bank', icon: 'Bank' },
    { id: 'my-quizzes', name: 'My Quizzes', icon: 'List' },
    { id: 'audio', name: 'Audio Generation', icon: 'Audio' },
    { id: 'ai-content', name: 'AI Content', icon: 'AI' },
    { id: 'analytics', name: 'Analytics', icon: 'Stats' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-simmonds-charcoal mb-2">Teacher Tools</h1>
        <p className="text-simmonds-stone">Create quizzes, manage questions, and generate content</p>
      </div>

      <div className="mb-6">
        <nav className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                activeTab === tab.id
                  ? 'bg-simmonds-primary text-white'
                  : 'bg-simmonds-cream text-simmonds-charcoal hover:bg-simmonds-cream-light'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {activeTab === 'quiz-builder' && renderQuizBuilder()}
        {activeTab === 'question-bank' && renderQuestionBank()}
        {activeTab === 'my-quizzes' && renderQuizList()}
        {activeTab === 'audio' && renderAudioContent()}
        {activeTab === 'ai-content' && renderAIContent()}
        {activeTab === 'analytics' && renderAnalytics()}
      </div>
    </div>
  );
};

export default TeacherTools;
