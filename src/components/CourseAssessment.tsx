import { useState } from 'react';
import { CheckCircle2, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  assessmentQuestions,
  englishSkillsAssessment,
  scoreAssessment,
  type AssessmentQuestion,
  type AssessmentScore,
} from '@/lib/englishSkillsAssessment';

const speakRecording = (script: string) => {
  if (!('speechSynthesis' in window)) {
    return;
  }
  window.speechSynthesis.cancel();
  const recording = new SpeechSynthesisUtterance(script);
  recording.lang = 'en-IN';
  window.speechSynthesis.speak(recording);
};

const QuestionFields = ({
  question,
  value,
  onChange,
}: {
  question: AssessmentQuestion;
  value: string;
  onChange: (value: string) => void;
}) => {
  if (question.kind === 'choice' || question.kind === 'listening') {
    return (
      <RadioGroup value={value} onValueChange={onChange} className="mt-3">
        {question.choices.map((choice) => {
          const letter = choice.charAt(0);
          return (
            <div key={choice} className="flex items-start gap-3 rounded-lg border bg-white p-3">
              <RadioGroupItem id={`${question.id}-${letter}`} value={letter} className="mt-1" />
              <Label htmlFor={`${question.id}-${letter}`} className="font-normal leading-6">{choice}</Label>
            </div>
          );
        })}
      </RadioGroup>
    );
  }

  if (question.kind === 'match') {
    return (
      <RadioGroup value={value} onValueChange={onChange} className="mt-3">
        {question.choices.map((choice) => {
          const letter = choice.charAt(0);
          return (
            <div key={choice} className="flex items-start gap-3 rounded-lg border bg-white p-3">
              <RadioGroupItem id={`${question.id}-${letter}`} value={letter} className="mt-1" />
              <Label htmlFor={`${question.id}-${letter}`} className="font-normal leading-6">{choice}</Label>
            </div>
          );
        })}
      </RadioGroup>
    );
  }

  if (question.kind === 'written') {
    return (
      <Textarea
        className="mt-3 bg-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write your answer"
        rows={4}
      />
    );
  }

  return (
    <Input
      className="mt-3 bg-white"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={question.kind === 'order' ? 'Write the sentence' : 'Type the missing word'}
    />
  );
};

const CourseAssessment = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<AssessmentScore | null>(null);
  const [missingIds, setMissingIds] = useState<number[]>([]);
  const section = englishSkillsAssessment.sections[sectionIndex];
  const isLastSection = sectionIndex === englishSkillsAssessment.sections.length - 1;

  const setAnswer = (questionId: number, value: string) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setMissingIds((current) => current.filter((id) => id !== questionId));
  };

  const submitAssessment = () => {
    const unanswered = assessmentQuestions
      .filter((question) => !answers[question.id]?.trim())
      .map((question) => question.id);
    if (unanswered.length > 0) {
      setMissingIds(unanswered);
      const firstMissingSection = englishSkillsAssessment.sections.findIndex((item) =>
        item.questions.some((question) => unanswered.includes(question.id))
      );
      if (firstMissingSection >= 0) {
        setSectionIndex(firstMissingSection);
      }
      return;
    }
    window.speechSynthesis?.cancel();
    setResult(scoreAssessment(answers));
  };

  if (!hasStarted) {
    return (
      <div id="assessment" className="mt-10 rounded-xl border bg-white p-6 scroll-mt-24">
        <p className="text-sm font-medium text-kiki-purple-700">{englishSkillsAssessment.eyebrow}</p>
        <h2 className="text-2xl font-bold text-gray-900 mt-1">{englishSkillsAssessment.title}</h2>
        <p className="text-gray-600 mt-2">
          {englishSkillsAssessment.questionCount} questions · {englishSkillsAssessment.marks} marks · {englishSkillsAssessment.duration}
        </p>
        <p className="text-sm text-gray-500 mt-1">{englishSkillsAssessment.audience}</p>
        <Button className="mt-5" onClick={() => setHasStarted(true)}>
          Start assessment
        </Button>
      </div>
    );
  }

  if (result) {
    return (
      <div id="assessment" className="mt-10 rounded-xl border bg-white p-6 scroll-mt-24">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-kiki-purple-600 mt-1" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">You scored {result.score} / {result.total}</h2>
            <p className="text-gray-600 mt-2">
              This score shows how clearly you can use English in college and workplace situations. Communication improves with every attempt.
            </p>
          </div>
        </div>
        <ul className="mt-6 space-y-2">
          {result.results.filter((item) => !item.awarded).map((item) => (
            <li key={item.id} className="text-sm text-gray-700">
              Question {item.id} needs another look.
            </li>
          ))}
        </ul>
        {result.score === result.total && (
          <p className="mt-4 text-sm text-gray-700">Every question met the marking guide.</p>
        )}
      </div>
    );
  }

  return (
    <div id="assessment" className="mt-10 scroll-mt-24">
      <div className="mb-4">
        <p className="text-sm font-medium text-kiki-purple-700">
          Section {sectionIndex + 1} of {englishSkillsAssessment.sections.length}
        </p>
        <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
        <p className="text-gray-600 mt-1">{section.instructions}</p>
      </div>
      <div className="space-y-4">
        {section.questions.map((question) => (
          <article key={question.id} className={`rounded-xl border p-4 ${missingIds.includes(question.id) ? 'border-red-400 bg-red-50' : 'bg-gray-50'}`}>
            {'passage' in question && question.passage && (
              <div className="mb-4 rounded-lg bg-white p-4 border">
                <h3 className="font-semibold text-gray-900">{question.passageTitle}</h3>
                <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{question.passage}</p>
              </div>
            )}
            {'picture' in question && question.picture && (
              <div className="mb-4 rounded-lg border border-dashed bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-kiki-purple-700">Picture</p>
                <p className="text-sm text-gray-700 mt-2">{question.picture}</p>
              </div>
            )}
            <h3 className="font-semibold text-gray-900">Q{question.id}. {question.prompt}</h3>
            {question.kind === 'order' && (
              <p className="text-sm text-gray-600 mt-2">{question.words.join(' / ')}</p>
            )}
            {question.kind === 'listening' && question.listeningScript && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => speakRecording(question.listeningScript ?? '')}
              >
                <Volume2 className="h-4 w-4 mr-2" />
                Play recording
              </Button>
            )}
            <QuestionFields
              question={question}
              value={answers[question.id] ?? ''}
              onChange={(value) => setAnswer(question.id, value)}
            />
            {missingIds.includes(question.id) && (
              <p className="text-sm text-red-700 mt-2">Answer this question before submitting.</p>
            )}
          </article>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {sectionIndex > 0 && (
          <Button type="button" variant="outline" onClick={() => setSectionIndex(sectionIndex - 1)}>
            Previous section
          </Button>
        )}
        {isLastSection ? (
          <Button type="button" onClick={submitAssessment}>Submit assessment</Button>
        ) : (
          <Button type="button" onClick={() => setSectionIndex(sectionIndex + 1)}>Next section</Button>
        )}
      </div>
    </div>
  );
};

export default CourseAssessment;
