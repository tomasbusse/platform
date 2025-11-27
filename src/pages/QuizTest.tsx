import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';

interface QuizTestProps {
  sessionId: string;
  currentUser: User | null;
  company: Company | null;
}

const QuizTest: React.FC<QuizTestProps> = ({ sessionId, currentUser, company }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Queries and mutations
  const session = useQuery(api.testSessions.getTestSession, {
    sessionId: sessionId as Id<"testSessions">
  });
  const completeTestAndAssign = useMutation(api.testSessions.completeTestAndAssignGroup);

  const questions = session?.customQuestions || [];
  const currentQuestion = questions[currentQuestionIndex];

  const handleAnswer = (answer: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: answer }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!session || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Convert answers to the format expected by the mutation
      const answersArray = questions.map((q: any) => ({
        questionId: q.id,
        answer: answers[q.id] || '',
        isCorrect: answers[q.id] === q.correctAnswer,
        timeSpent: 0,
      }));

      const result = await completeTestAndAssign({
        sessionId: sessionId as Id<"testSessions">,
        answers: answersArray,
      });

      setShowResults(true);
      console.log('Test completed:', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit test');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!session) {
    return <div className="p-8 text-center">Loading test...</div>;
  }

  if (showResults) {
    const correctAnswers = Object.entries(answers).filter(([qId, answer]) => {
      const q = questions.find((q: any) => q.id === qId);
      return q && q.correctAnswer === answer;
    }).length;
    const score = Math.round((correctAnswers / questions.length) * 100);

    return (
      <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h1 className="text-3xl font-bold text-simmonds-primary mb-4">Test Completed!</h1>
            <div className="text-5xl font-bold text-simmonds-lime mb-4">{score}%</div>
            <p className="text-lg text-gray-600 mb-8">
              You answered {correctAnswers} out of {questions.length} questions correctly.
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-simmonds-primary text-white rounded-lg font-medium hover:bg-simmonds-primary/90"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return <div className="p-8 text-center">No questions available</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-600">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-simmonds-primary transition-all"
                  style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-6">{currentQuestion.question}</h2>

          <div className="space-y-3 mb-8">
            {currentQuestion.options?.map((option: string, index: number) => (
              <label
                key={index}
                className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${
                  answers[currentQuestion.id] === option
                    ? 'border-simmonds-primary bg-simmonds-primary/5'
                    : 'border-gray-300 hover:border-simmonds-primary/30'
                }`}
              >
                <input
                  type="radio"
                  name={`question-${currentQuestion.id}`}
                  value={option}
                  checked={answers[currentQuestion.id] === option}
                  onChange={() => handleAnswer(option)}
                  className="mr-3"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>

          {error && <div className="text-red-600 mb-4">{error}</div>}

          <div className="flex justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            {currentQuestionIndex < questions.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={!answers[currentQuestion.id]}
                className="px-6 py-2 bg-simmonds-primary text-white rounded-lg hover:bg-simmonds-primary/90 disabled:opacity-50"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !answers[currentQuestion.id]}
                className="px-6 py-2 bg-simmonds-lime text-white rounded-lg hover:bg-simmonds-lime/90 disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Test'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizTest;

