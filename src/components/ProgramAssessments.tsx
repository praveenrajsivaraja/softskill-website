import { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AssessmentPlayer from '@/components/AssessmentPlayer';
import {
  checkLearnerAnswer,
  fetchMyAssessmentAttempts,
  fetchProgramAssessments,
  openLearnerAssessment,
  submitLearnerAssessment,
  type AssessmentAttemptSummary,
  type LearnerAssessment,
  type ProgramAssessment,
} from '@/lib/assessmentApi';

interface ProgramAssessmentsProps {
  courseId: string;
}

const ProgramAssessments = ({ courseId }: ProgramAssessmentsProps) => {
  const [assessments, setAssessments] = useState<ProgramAssessment[]>([]);
  const [bestScores, setBestScores] = useState<Record<string, AssessmentAttemptSummary>>({});
  const [active, setActive] = useState<LearnerAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAssessments = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchProgramAssessments(courseId);
      const published = rows.filter((assessment) => assessment.isPublished && assessment.isActive);
      setAssessments(published);
      const scores = await Promise.all(published.map(async (assessment) => {
        const attempts = await fetchMyAssessmentAttempts(assessment.id);
        return [assessment.id, attempts[0]] as const;
      }));
      setBestScores(Object.fromEntries(scores.filter((entry) => entry[1])));
    } catch (loadError) {
      console.error(JSON.stringify({
        event: 'program_assessments_load_failed',
        message: loadError instanceof Error ? loadError.message : 'Unknown error',
      }));
      setError('Assessments could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssessments();
  }, [courseId]);

  const startAssessment = async (assessmentId: string) => {
    setError(null);
    try {
      setActive(await openLearnerAssessment(assessmentId));
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Could not open this assessment.');
    }
  };

  if (active) {
    return (
      <section id="assessment" className="container mx-auto px-4 py-8 scroll-mt-24">
        <AssessmentPlayer
          title={active.assessment.title}
          instructions={active.assessment.instructions}
          showFeedback={active.assessment.showFeedback}
          durationMinutes={active.assessment.durationMinutes}
          questions={active.questions}
          onCheck={active.assessment.showFeedback ? checkLearnerAnswer : undefined}
          onSubmit={(answers) => submitLearnerAssessment(active.assessment.id, answers)}
          onExit={() => {
            setActive(null);
            void loadAssessments();
          }}
        />
      </section>
    );
  }

  return (
    <section id="assessment" className="container mx-auto px-4 pb-4 scroll-mt-24">
      <div className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900">Assessments</h2>
        <p className="mt-1 text-gray-600">Finish a short challenge for this program and see what to practise next.</p>
      </div>
      {loading && <div className="mt-4 h-28 animate-pulse rounded-3xl bg-white" />}
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {!loading && assessments.length === 0 && (
        <p className="mt-4 text-gray-600">No assessment has been published for this program yet.</p>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {assessments.map((assessment) => {
          const latest = bestScores[assessment.id];
          return (
            <article key={assessment.id} className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-kiki-purple-100 text-kiki-purple-700">
                  <ClipboardCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{assessment.title}</h3>
                  <p className="text-sm text-gray-500">{assessment.durationMinutes} min · pass at {assessment.passingScore}%</p>
                </div>
              </div>
              {assessment.description && <p className="mt-3 text-sm text-gray-600">{assessment.description}</p>}
              {latest && (
                <p className="mt-3 text-sm font-medium text-kiki-purple-700">
                  Latest score {latest.score}/{latest.totalMarks} · {latest.passed ? 'Passed' : 'Not passed yet'}
                </p>
              )}
              <Button className="mt-4 w-full" onClick={() => void startAssessment(assessment.id)}>
                {latest ? 'Try again' : 'Start'}
              </Button>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default ProgramAssessments;
