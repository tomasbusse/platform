import React, { useState } from 'react';
import { User, Company } from '../types';

interface PageComponentProps {
  currentUser: User | null;
  company: Company | null;
}

const TestTaking: React.FC<PageComponentProps> = ({ currentUser, company }) => {
  const [testStarted, setTestStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [testCompleted, setTestCompleted] = useState(false);
  const [testResults, setTestResults] = useState<{ score: number; level: string; skillScores: Record<string, number> } | null>(null);

  // Cambridge English Test Questions - Aligned with CEFR levels A1-C1
  const sampleQuestions = [
    // === A1 LEVEL - Beginner ===
    {
      id: 'cam-a1-1',
      type: 'multiple_choice',
      question: 'Which sentence is correct?',
      options: ['She don\'t like coffee', 'She doesn\'t like coffee', 'She not like coffee', 'She doesn\'t likes coffee'],
      correctAnswer: 'She doesn\'t like coffee',
      skill: 'grammar',
      level: 'A1',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: 'Third person singular uses "doesn\'t" + base verb',
    },
    {
      id: 'cam-a1-2',
      type: 'multiple_choice',
      question: 'What is the plural of "child"?',
      options: ['childs', 'childrens', 'children', 'childes'],
      correctAnswer: 'children',
      skill: 'vocabulary',
      level: 'A1',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: '"Child" has an irregular plural form: "children"',
    },
    {
      id: 'cam-a1-3',
      type: 'multiple_choice',
      question: 'Complete the sentence: "My name ____ John."',
      options: ['am', 'is', 'are', 'be'],
      correctAnswer: 'is',
      skill: 'grammar',
      level: 'A1',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: 'Third person singular "my name" takes "is"',
    },

    // === A2 LEVEL - Elementary ===
    {
      id: 'cam-a2-1',
      type: 'multiple_choice',
      question: 'Choose the correct answer: I ____ to the store yesterday.',
      options: ['go', 'went', 'going', 'goes'],
      correctAnswer: 'went',
      skill: 'grammar',
      level: 'A2',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: '"Yesterday" indicates past tense. "Went" is the past tense of "go"',
    },
    {
      id: 'cam-a2-2',
      type: 'multiple_choice',
      question: 'What is the past tense of "run"?',
      options: ['runned', 'ran', 'run', 'running'],
      correctAnswer: 'ran',
      skill: 'grammar',
      level: 'A2',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: '"Run" is an irregular verb with past tense "ran"',
    },
    {
      id: 'cam-a2-3',
      type: 'multiple_choice',
      question: 'Which word means the opposite of "expensive"?',
      options: ['rich', 'cheap', 'costly', 'valuable'],
      correctAnswer: 'cheap',
      skill: 'vocabulary',
      level: 'A2',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: '"Cheap" is the antonym of "expensive"',
    },
    {
      id: 'cam-a2-4',
      type: 'multiple_choice',
      question: 'Complete: "There ____ many people at the party last night."',
      options: ['was', 'were', 'is', 'are'],
      correctAnswer: 'were',
      skill: 'grammar',
      level: 'A2',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: '"Many people" is plural and "last night" indicates past tense, so use "were"',
    },

    // === B1 LEVEL - Intermediate ===
    {
      id: 'cam-b1-1',
      type: 'multiple_choice',
      question: 'Choose the correct preposition: I\'m interested ____ learning English.',
      options: ['in', 'on', 'at', 'for'],
      correctAnswer: 'in',
      skill: 'grammar',
      level: 'B1',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: 'The adjective "interested" is always followed by the preposition "in"',
    },
    {
      id: 'cam-b1-2',
      type: 'multiple_choice',
      question: 'If I ____ you, I would apologize immediately.',
      options: ['am', 'was', 'were', 'be'],
      correctAnswer: 'were',
      skill: 'grammar',
      level: 'B1',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: 'Second conditional uses "were" for all subjects (subjunctive mood)',
    },
    {
      id: 'cam-b1-3',
      type: 'multiple_choice',
      question: 'She asked me ____ I had finished my homework.',
      options: ['that', 'if', 'what', 'which'],
      correctAnswer: 'if',
      skill: 'grammar',
      level: 'B1',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: 'Reported yes/no questions use "if" or "whether"',
    },
    {
      id: 'cam-b1-4',
      type: 'multiple_choice',
      question: 'Which word best completes: "The meeting was ____ because of the storm."',
      options: ['cancelled', 'rejected', 'refused', 'denied'],
      correctAnswer: 'cancelled',
      skill: 'vocabulary',
      level: 'B1',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: '"Cancelled" is used when an event is called off',
    },
    {
      id: 'cam-b1-5',
      type: 'multiple_choice',
      question: 'By the time we arrived, the film ____.',
      options: ['already started', 'has already started', 'had already started', 'already starts'],
      correctAnswer: 'had already started',
      skill: 'grammar',
      level: 'B1',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: 'Past perfect is used for an action completed before another past action',
    },

    // === B2 LEVEL - Upper Intermediate ===
    {
      id: 'cam-b2-1',
      type: 'multiple_choice',
      question: 'The project ____ by the end of next month.',
      options: ['will complete', 'will be completed', 'will have completed', 'is completing'],
      correctAnswer: 'will be completed',
      skill: 'grammar',
      level: 'B2',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: 'Future passive is used when the subject receives the action',
    },
    {
      id: 'cam-b2-2',
      type: 'multiple_choice',
      question: 'Which word is closest in meaning to "meticulous"?',
      options: ['careless', 'thorough', 'quick', 'lazy'],
      correctAnswer: 'thorough',
      skill: 'vocabulary',
      level: 'B2',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: '"Meticulous" means showing great attention to detail, similar to "thorough"',
    },
    {
      id: 'cam-b2-3',
      type: 'multiple_choice',
      question: 'Not only ____ the exam, but she also got the highest score.',
      options: ['she passed', 'did she pass', 'she did pass', 'passed she'],
      correctAnswer: 'did she pass',
      skill: 'grammar',
      level: 'B2',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: '"Not only" at the start requires inversion: auxiliary + subject + main verb',
    },
    {
      id: 'cam-b2-4',
      type: 'multiple_choice',
      question: 'I wish I ____ harder when I was at university.',
      options: ['study', 'studied', 'had studied', 'would study'],
      correctAnswer: 'had studied',
      skill: 'grammar',
      level: 'B2',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: '"Wish" + past perfect expresses regret about a past situation',
    },
    {
      id: 'cam-b2-5',
      type: 'multiple_choice',
      question: 'The word "ubiquitous" means:',
      options: ['rare', 'everywhere', 'unique', 'ancient'],
      correctAnswer: 'everywhere',
      skill: 'vocabulary',
      level: 'B2',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: '"Ubiquitous" means present, appearing, or found everywhere',
    },

    // === C1 LEVEL - Advanced ===
    {
      id: 'cam-c1-1',
      type: 'multiple_choice',
      question: 'Had I known about the delay, I ____ the earlier train.',
      options: ['would take', 'would have taken', 'had taken', 'took'],
      correctAnswer: 'would have taken',
      skill: 'grammar',
      level: 'C1',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: 'Third conditional with inversion: Had + subject + past participle, would have + past participle',
    },
    {
      id: 'cam-c1-2',
      type: 'multiple_choice',
      question: 'The evidence was ____ circumstantial to secure a conviction.',
      options: ['merely', 'barely', 'hardly', 'scarcely'],
      correctAnswer: 'merely',
      skill: 'vocabulary',
      level: 'C1',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: '"Merely" means only or simply, fitting the context of insufficient evidence',
    },
    {
      id: 'cam-c1-3',
      type: 'multiple_choice',
      question: 'The phenomenon, ____ has puzzled scientists for decades, remains unexplained.',
      options: ['that', 'which', 'what', 'who'],
      correctAnswer: 'which',
      skill: 'grammar',
      level: 'C1',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: 'Non-defining relative clauses use "which" (with commas) for things',
    },
    {
      id: 'cam-c1-4',
      type: 'multiple_choice',
      question: 'Which phrase means "to reveal a secret"?',
      options: ['let the cat out of the bag', 'kill two birds with one stone', 'beat around the bush', 'bite the bullet'],
      correctAnswer: 'let the cat out of the bag',
      skill: 'vocabulary',
      level: 'C1',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: '"Let the cat out of the bag" is an idiom meaning to accidentally reveal a secret',
    },
    {
      id: 'cam-c1-5',
      type: 'multiple_choice',
      question: 'Seldom ____ such a remarkable performance.',
      options: ['I have seen', 'have I seen', 'I saw', 'did I saw'],
      correctAnswer: 'have I seen',
      skill: 'grammar',
      level: 'C1',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: 'Negative adverbs (seldom, rarely, never) at the start require inversion',
    },

    // === Reading Comprehension ===
    {
      id: 'cam-read-1',
      type: 'reading_comprehension',
      question: 'Read the passage and answer: "The Thames Barrier, completed in 1984, protects London from flooding. It consists of 10 steel gates that can be raised when water levels are dangerously high. Since its construction, the barrier has been closed over 200 times." What is the main purpose of the Thames Barrier?',
      options: ['To generate electricity', 'To protect London from flooding', 'To control boat traffic', 'To provide drinking water'],
      correctAnswer: 'To protect London from flooding',
      skill: 'reading',
      level: 'B1',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: 'The passage explicitly states the barrier "protects London from flooding"',
    },
    {
      id: 'cam-read-2',
      type: 'reading_comprehension',
      question: 'Based on the passage: "Studies show that bilingual individuals often display enhanced cognitive flexibility and may delay the onset of dementia by several years compared to monolinguals." What benefit of bilingualism is mentioned?',
      options: ['Better physical health', 'Improved cognitive abilities', 'Higher income', 'More travel opportunities'],
      correctAnswer: 'Improved cognitive abilities',
      skill: 'reading',
      level: 'B2',
      audioUrl: null,
      cambridgeAligned: true,
      explanation: '"Enhanced cognitive flexibility" and "delay onset of dementia" relate to cognitive abilities',
    },

    // === Listening Section (placeholder audio) ===
    {
      id: 'cam-listen-1',
      type: 'listening',
      question: '[Audio Exercise] Listen to the announcement and identify where this would most likely be heard:',
      audioUrl: null,
      options: ['In a supermarket', 'At a train station', 'In a hospital', 'At a school'],
      correctAnswer: 'At a train station',
      skill: 'listening',
      level: 'A2',
      cambridgeAligned: true,
      explanation: 'The announcement mentions platforms, arrivals, and departures',
    },
    {
      id: 'cam-listen-2',
      type: 'listening',
      question: '[Audio Exercise] Listen to the conversation. What is the main topic being discussed?',
      audioUrl: null,
      options: ['Planning a holiday', 'A job interview', 'A restaurant reservation', 'A medical appointment'],
      correctAnswer: 'Planning a holiday',
      skill: 'listening',
      level: 'B1',
      cambridgeAligned: true,
      explanation: 'Key words like destination, flights, and accommodation indicate holiday planning',
    },
  ];

  const startTest = () => {
    setTestStarted(true);
    setTestCompleted(false);
    setTestResults(null);
    setAnswers({});
    setCurrentQuestion(0);
  };

  const submitAnswers = () => {
    // Calculate score based on correct answers
    const answersArray = Object.entries(answers).map(([questionId, answer]) => {
      const question = sampleQuestions.find(q => q.id === questionId);
      const isCorrect = question ? question.correctAnswer === answer : false;
      return {
        questionId,
        answer,
        isCorrect,
      };
    });

    const correctAnswers = answersArray.filter(a => a.isCorrect).length;
    const totalScore = Math.round((correctAnswers / sampleQuestions.length) * 100);

    // Determine recommended level based on score
    let recommendedLevel = 'A1';
    if (totalScore >= 90) recommendedLevel = 'C1';
    else if (totalScore >= 80) recommendedLevel = 'B2';
    else if (totalScore >= 70) recommendedLevel = 'B1';
    else if (totalScore >= 60) recommendedLevel = 'A2';

    // Calculate skill scores for all skills
    const calculateSkillScore = (skill: string) => {
      const skillQuestions = sampleQuestions.filter(q => q.skill === skill);
      if (skillQuestions.length === 0) return 0;
      const correctCount = answersArray.filter(a => {
        const q = sampleQuestions.find(sq => sq.id === a.questionId);
        return q?.skill === skill && a.isCorrect;
      }).length;
      return Math.round((correctCount / skillQuestions.length) * 100);
    };

    const skillScores = {
      grammar: calculateSkillScore('grammar'),
      vocabulary: calculateSkillScore('vocabulary'),
      reading: calculateSkillScore('reading'),
      listening: calculateSkillScore('listening'),
    };

    setTestResults({ score: totalScore, level: recommendedLevel, skillScores });
    setTestCompleted(true);
  };

  if (!testStarted) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-simmonds-charcoal mb-2">English Assessment</h1>
          <p className="text-simmonds-stone">Test your English language skills</p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-simmonds-cream">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-simmonds-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-simmonds-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-simmonds-charcoal mb-2">Cambridge English Assessment</h2>
            <p className="text-simmonds-stone mb-4">
              This assessment will evaluate your English language skills across reading, listening,
              writing, and speaking. Based on your results, you'll be assigned to the appropriate level.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="text-center p-4 bg-simmonds-primary/5 rounded-xl border border-simmonds-primary/10">
              <div className="w-10 h-10 bg-simmonds-primary/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-simmonds-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="font-semibold text-simmonds-charcoal">Reading</h3>
              <p className="text-sm text-simmonds-stone">Comprehension</p>
            </div>
            <div className="text-center p-4 bg-simmonds-olive/10 rounded-xl border border-simmonds-olive/20">
              <div className="w-10 h-10 bg-simmonds-olive/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-simmonds-olive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </div>
              <h3 className="font-semibold text-simmonds-charcoal">Listening</h3>
              <p className="text-sm text-simmonds-stone">Audio exercises</p>
            </div>
            <div className="text-center p-4 bg-simmonds-lime/10 rounded-xl border border-simmonds-lime/30">
              <div className="w-10 h-10 bg-simmonds-lime/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-simmonds-lime-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="font-semibold text-simmonds-charcoal">Grammar</h3>
              <p className="text-sm text-simmonds-stone">Language structure</p>
            </div>
            <div className="text-center p-4 bg-simmonds-terracotta/10 rounded-xl border border-simmonds-terracotta/20">
              <div className="w-10 h-10 bg-simmonds-terracotta/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-simmonds-terracotta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="font-semibold text-simmonds-charcoal">Vocabulary</h3>
              <p className="text-sm text-simmonds-stone">Word knowledge</p>
            </div>
          </div>

          <div className="bg-simmonds-cream-light border border-simmonds-cream rounded-xl p-4 mb-6">
            <h4 className="font-semibold text-simmonds-charcoal mb-2">Important Information</h4>
            <ul className="text-sm text-simmonds-stone space-y-1">
              <li>• Duration: 25-35 minutes</li>
              <li>• {sampleQuestions.length} questions covering grammar, vocabulary, reading, and listening</li>
              <li>• Questions span CEFR levels A1 to C1</li>
              <li>• Results will determine your recommended English level</li>
              <li>• Make sure you're in a quiet environment</li>
            </ul>
          </div>

          <div className="text-center">
            <button
              onClick={startTest}
              className="bg-simmonds-primary text-white px-8 py-3 rounded-xl font-semibold hover:bg-simmonds-primary-light transition-colors"
            >
              Start Assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show results screen
  if (testCompleted && testResults) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-simmonds-charcoal mb-2">Test Results</h1>
          <p className="text-simmonds-stone">Your assessment is complete</p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-simmonds-cream">
          <div className="text-center mb-8">
            <div className="w-28 h-28 bg-simmonds-lime/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl font-bold text-simmonds-primary">{testResults.score}%</span>
            </div>
            <h2 className="text-2xl font-semibold text-simmonds-charcoal mb-2">Recommended Level: {testResults.level}</h2>
            <p className="text-simmonds-stone">
              Based on your performance across all skill areas
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="text-center p-4 bg-simmonds-lime/10 rounded-xl border border-simmonds-lime/30">
              <h3 className="font-semibold text-simmonds-charcoal">Grammar</h3>
              <p className="text-2xl font-bold text-simmonds-lime-dark">{testResults.skillScores.grammar}%</p>
            </div>
            <div className="text-center p-4 bg-simmonds-terracotta/10 rounded-xl border border-simmonds-terracotta/20">
              <h3 className="font-semibold text-simmonds-charcoal">Vocabulary</h3>
              <p className="text-2xl font-bold text-simmonds-terracotta">{testResults.skillScores.vocabulary}%</p>
            </div>
            <div className="text-center p-4 bg-simmonds-primary/10 rounded-xl border border-simmonds-primary/20">
              <h3 className="font-semibold text-simmonds-charcoal">Reading</h3>
              <p className="text-2xl font-bold text-simmonds-primary">{testResults.skillScores.reading}%</p>
            </div>
            <div className="text-center p-4 bg-simmonds-olive/10 rounded-xl border border-simmonds-olive/20">
              <h3 className="font-semibold text-simmonds-charcoal">Listening</h3>
              <p className="text-2xl font-bold text-simmonds-olive">{testResults.skillScores.listening}%</p>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => {
                setTestStarted(false);
                setTestCompleted(false);
                setTestResults(null);
                setAnswers({});
                setCurrentQuestion(0);
              }}
              className="bg-simmonds-primary text-white px-8 py-3 rounded-xl font-semibold hover:bg-simmonds-primary-light transition-colors"
            >
              Take Another Test
            </button>
          </div>
        </div>
      </div>
    );
  }

  const question = sampleQuestions[currentQuestion];
  const isLastQuestion = currentQuestion === sampleQuestions.length - 1;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-simmonds-charcoal">Assessment in Progress</h1>
          <div className="text-sm text-simmonds-stone">
            Question {currentQuestion + 1} of {sampleQuestions.length}
          </div>
        </div>
        <div className="w-full bg-simmonds-cream rounded-full h-2 mt-2">
          <div
            className="bg-simmonds-lime h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / sampleQuestions.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
        <div className="mb-6">
          <div className="flex items-center flex-wrap gap-2 mb-4">
            <span className="bg-simmonds-primary/10 text-simmonds-primary text-sm font-medium px-3 py-1 rounded-full">
              {question.type === 'multiple_choice' ? 'Multiple Choice' : question.type === 'reading_comprehension' ? 'Reading' : 'Listening'}
            </span>
            <span className="bg-simmonds-lime/20 text-simmonds-lime-dark text-sm font-medium px-3 py-1 rounded-full capitalize">
              {question.skill}
            </span>
            <span className="bg-simmonds-olive/20 text-simmonds-olive text-sm font-medium px-3 py-1 rounded-full">
              Level {question.level}
            </span>
            {question.type === 'listening' && (
              <button className="ml-2 flex items-center text-simmonds-primary hover:text-simmonds-primary-light">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Play Audio
              </button>
            )}
          </div>
          <h2 className="text-xl font-semibold text-simmonds-charcoal mb-4">{question.question}</h2>
        </div>

        <div className="space-y-3 mb-6">
          {question.options?.map((option, index) => (
            <label
              key={index}
              className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
                answers[question.id] === option
                  ? 'border-simmonds-primary bg-simmonds-primary/5'
                  : 'border-simmonds-cream hover:border-simmonds-primary/30 hover:bg-simmonds-cream-light'
              }`}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option}
                checked={answers[question.id] === option}
                onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                className="mr-3 text-simmonds-primary focus:ring-simmonds-primary"
              />
              <span className="text-simmonds-charcoal">{option}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
            disabled={currentQuestion === 0}
            className="px-6 py-2 border border-simmonds-cream rounded-xl text-simmonds-stone hover:bg-simmonds-cream-light disabled:opacity-50 transition-colors"
          >
            Previous
          </button>
          <button
            onClick={isLastQuestion ? submitAnswers : () => setCurrentQuestion(currentQuestion + 1)}
            disabled={!answers[question.id]}
            className="px-6 py-2 bg-simmonds-primary text-white rounded-xl hover:bg-simmonds-primary-light disabled:opacity-50 transition-colors"
          >
            {isLastQuestion ? 'Submit Assessment' : 'Next Question'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestTaking;