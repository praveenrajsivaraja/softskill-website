import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Volume2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { LearnerAssessmentQuestion } from '@/lib/assessmentApi';
import type { AssessmentAttemptSummary } from '@/lib/assessmentApi';

interface AssessmentPlayerProps {
  title: string;
  instructions: string | null;
  showFeedback: boolean;
  durationMinutes?: number;
  questions: LearnerAssessmentQuestion[];
  onCheck?: (questionId: string, response: string) => Promise<boolean>;
  onSubmit: (answers: Record<string, string>) => Promise<AssessmentAttemptSummary>;
  onExit: () => void;
}

const praise = ['Nice work!', 'That is the one.', 'You are moving forward.'];
const nudge = ['Not quite.', 'Keep going — the next one is a fresh start.', 'Look at the question once more, then continue.'];

const speakRecording = (script: string) => {
  if (!script || !('speechSynthesis' in window)) {
    return;
  }
  window.speechSynthesis.cancel();
  const recording = new SpeechSynthesisUtterance(script);
  recording.lang = 'en-IN';
  window.speechSynthesis.speak(recording);
};

const formatRemaining = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
};

const AssessmentPlayer = ({
  title,
  instructions,
  showFeedback,
  durationMinutes,
  questions,
  onCheck,
  onSubmit,
  onExit,
}: AssessmentPlayerProps) => {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<AssessmentAttemptSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    durationMinutes && durationMinutes > 0 ? durationMinutes * 60 : null,
  );
  const answersRef = useRef(answers);
  const submittedRef = useRef(false);
  answersRef.current = answers;
  const question = questions[index];
  const progress = questions.length === 0 ? 0 : Math.round((index / questions.length) * 100);
  const response = question ? answers[question.id] ?? '' : '';
  const showSectionIntro = Boolean(question) && (index === 0 || questions[index - 1].sectionTitle !== question.sectionTitle);

  const finish = async (currentAnswers: Record<string, string>) => {
    if (submittedRef.current) {
      return;
    }
    submittedRef.current = true;
    setChecking(true);
    setError(null);
    try {
      window.speechSynthesis?.cancel();
      setResult(await onSubmit(currentAnswers));
    } catch (submitError) {
      submittedRef.current = false;
      setError(submitError instanceof Error ? submitError.message : 'Could not submit the assessment.');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!durationMinutes || durationMinutes < 1 || questions.length === 0) {
      return;
    }
    const endsAt = Date.now() + durationMinutes * 60 * 1000;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(timer);
        void finish(answersRef.current);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [durationMinutes, questions.length]);

  const setResponse = (value: string) => {
    if (!question || feedback) {
      return;
    }
    setAnswers((current) => ({ ...current, [question.id]: value }));
  };

  const advance = async () => {
    if (!question || !response.trim()) {
      return;
    }
    if (showFeedback && onCheck && !feedback) {
      setChecking(true);
      setError(null);
      try {
        const correct = await onCheck(question.id, response);
        const messages = correct ? praise : nudge;
        setFeedback({
          correct,
          message: messages[index % messages.length],
        });
      } catch (checkError) {
        setError(checkError instanceof Error ? checkError.message : 'Could not check that answer.');
      } finally {
        setChecking(false);
      }
      return;
    }

    if (index < questions.length - 1) {
      setFeedback(null);
      setIndex(index + 1);
      return;
    }

    await finish(answers);
  };

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="mt-3 text-gray-600">This assessment does not have any questions yet.</p>
        <Button className="mt-6" variant="outline" onClick={onExit}>Back</Button>
      </div>
    );
  }

  if (result) {
    const percent = result.totalMarks === 0 ? 0 : Math.round((result.score / result.totalMarks) * 100);
    const missed = result.results.filter((item) => !item.awarded);
    return (
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm sm:p-8">
        <div className={`mx-auto flex h-28 w-28 items-center justify-center rounded-full text-3xl font-bold ${result.passed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
          {percent}%
        </div>
        <h2 className="mt-5 text-center text-2xl font-bold text-gray-900">
          {result.passed ? 'Assessment complete' : 'Keep practising'}
        </h2>
        <p className="mt-2 text-center text-gray-600">
          You scored {result.score} out of {result.totalMarks}. {result.passed ? 'You passed this assessment.' : 'Review the sections below and try again when you are ready.'}
        </p>
        {typeof result.programProgress === 'number' && (
          <p className="mt-3 text-center text-sm font-medium text-kiki-purple-700">Program progress is now {result.programProgress}%.</p>
        )}
        {missed.length > 0 && (
          <ul className="mt-6 space-y-3">
            {missed.map((item) => (
              <li key={item.questionId} className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-kiki-purple-700">{item.sectionTitle}</p>
                <p className="mt-1 text-sm text-gray-800">{item.prompt}</p>
                {item.guidance && <p className="mt-2 text-sm text-gray-600">{item.guidance}</p>}
              </li>
            ))}
          </ul>
        )}
        <Button className="mt-6 w-full" onClick={onExit}>Back to the program</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button type="button" className="text-sm font-medium text-gray-500" onClick={onExit}>Exit</button>
        <p className="text-sm font-semibold text-gray-700">
          {index + 1} / {questions.length}
          {secondsLeft !== null ? ` · ${formatRemaining(secondsLeft)}` : ''}
        </p>
      </div>
      <div className="mb-5 h-3 overflow-hidden rounded-full bg-kiki-purple-100">
        <div className="h-full rounded-full bg-kiki-purple-600 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
        <p className="text-sm font-semibold text-kiki-purple-700">{question.sectionTitle}</p>
        {showSectionIntro && question.sectionInstructions && (
          <p className="mt-1 text-sm text-gray-500">{question.sectionInstructions}</p>
        )}
        {instructions && index === 0 && <p className="mt-3 text-sm text-gray-600">{instructions}</p>}
        {question.passage && (
          <div className="mt-4 rounded-2xl bg-kiki-purple-50 p-4">
            {question.passageTitle && <h3 className="font-semibold text-gray-900">{question.passageTitle}</h3>}
            <p className="mt-2 text-sm leading-6 text-gray-700">{question.passage}</p>
          </div>
        )}
        {(question.pictureUrl || question.pictureText) && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-dashed border-kiki-purple-200 bg-kiki-purple-50">
            {question.pictureUrl && <img src={question.pictureUrl} alt="" className="h-48 w-full object-cover" />}
            {question.pictureText && <p className="p-4 text-sm text-gray-700">{question.pictureText}</p>}
          </div>
        )}
        <h2 className="mt-5 text-xl font-bold leading-snug text-gray-900">{question.prompt}</h2>
        {question.kind === 'listening' && question.listeningScript && (
          <Button type="button" variant="outline" className="mt-4" onClick={() => speakRecording(question.listeningScript ?? '')}>
            <Volume2 className="mr-2 h-4 w-4" />
            Play recording
          </Button>
        )}
        {question.kind === 'order' && (
          <p className="mt-3 text-sm text-gray-600">{(question.wordBank ?? []).join(' / ')}</p>
        )}
        {(question.kind === 'choice' || question.kind === 'listening' || question.kind === 'match') && (
          <div className="mt-5 space-y-3">
            {question.options.map((option) => {
              const selected = response === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={Boolean(feedback)}
                  onClick={() => setResponse(option.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left text-base font-medium transition disabled:cursor-default ${selected && feedback?.correct ? 'border-green-600 bg-green-50 text-green-800' : selected && feedback && !feedback.correct ? 'border-amber-500 bg-amber-50 text-amber-900' : selected ? 'border-kiki-purple-600 bg-kiki-purple-50 text-kiki-purple-800' : 'border-gray-200 bg-white text-gray-800'}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
        {question.kind === 'blank' && (
          <Input className="mt-5 h-12 text-base" value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Type the missing word" />
        )}
        {(question.kind === 'order' || question.kind === 'written') && (
          <Textarea className="mt-5 text-base" rows={question.kind === 'written' ? 5 : 3} value={response} onChange={(event) => setResponse(event.target.value)} placeholder={question.kind === 'order' ? 'Write the sentence' : 'Write your answer'} />
        )}
        {feedback && (
          <div className={`mt-5 flex items-start gap-3 rounded-2xl p-4 ${feedback.correct ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>
            {feedback.correct ? <CheckCircle2 className="mt-0.5 h-5 w-5" /> : <XCircle className="mt-0.5 h-5 w-5" />}
            <p className="font-medium">{feedback.message}</p>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        {!showFeedback && index > 0 && (
          <Button type="button" variant="outline" className="mt-6 h-12 w-full text-base" onClick={() => setIndex(index - 1)}>
            Previous
          </Button>
        )}
        <Button className={`${!showFeedback && index > 0 ? 'mt-3' : 'mt-6'} h-12 w-full text-base`} disabled={!response.trim() || checking} onClick={() => void advance()}>
          {checking ? 'Checking…' : showFeedback && onCheck && !feedback ? 'Check' : index === questions.length - 1 ? 'Finish' : 'Continue'}
        </Button>
      </div>
      <p className="mt-4 text-center text-sm text-gray-500">{title}</p>
    </div>
  );
};

export default AssessmentPlayer;
