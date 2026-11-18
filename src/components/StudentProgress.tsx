import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchAdminStudentProgress, isAssessmentStorageMissing, type AdminStudentProgress } from '@/lib/assessmentApi';
import { describeAttemptAnswers, type StudentProgressView } from '@/lib/studentProgress';
import { progressReportSheets } from '@/lib/adminScreenReports';
import DownloadReportButton from '@/components/DownloadReportButton';

const matchesSearch = (student: StudentProgressView, search: string): boolean => {
  const haystack = `${student.studentName} ${student.email} ${student.phone ?? ''}`.toLowerCase();
  return haystack.includes(search.trim().toLowerCase());
};

const StudentProgress = () => {
  const [progress, setProgress] = useState<AdminStudentProgress>({ students: [], questionsByAssessmentId: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('all');
  const [openAttemptId, setOpenAttemptId] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    fetchAdminStudentProgress()
      .then((result) => {
        if (isCurrent) {
          setProgress(result);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        const error = loadError as { code?: string; message?: string };
        const message = error.message ?? 'Unknown error';
        console.error(JSON.stringify({
          event: 'admin_student_progress_load_failed',
          code: error.code,
          message,
        }));
        if (isCurrent) {
          setError(isAssessmentStorageMissing({ code: error.code, message })
            ? 'Run the assessment SQL in Supabase before viewing student results.'
            : 'Student results could not be loaded.');
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  const programs = [...new Map(
    progress.students.flatMap((student) => student.programs.map((program) => [program.courseId, program.courseTitle])),
  ).entries()];
  const visibleStudents = progress.students
    .map((student) => ({
      ...student,
      programs: student.programs.filter((program) => courseId === 'all' || program.courseId === courseId),
    }))
    .filter((student) => student.programs.length > 0 && matchesSearch(student, search));
  const progressReport = progressReportSheets(visibleStudents, progress.questionsByAssessmentId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <BarChart3 className="h-6 w-6" />
            Student progress
          </h2>
          <p className="mt-1 text-gray-600">Review each student’s enrollment, assessment scores, answers, and the correct response.</p>
        </div>
        <DownloadReportButton filename="progress-report.xls" sheets={progressReport} disabled={loading || visibleStudents.length === 0} />
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email, or phone" />
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger><SelectValue placeholder="All programs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programs</SelectItem>
            {programs.map(([id, title]) => <SelectItem key={id} value={id}>{title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {loading && <div className="h-32 animate-pulse rounded-2xl bg-white" />}
      {error && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
      {!loading && !error && visibleStudents.length === 0 && (
        <p className="text-gray-600">No enrolled students match this view.</p>
      )}
      <div className="space-y-4">
        {visibleStudents.map((student) => (
          <article key={student.studentId} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{student.studentName}</h3>
                <p className="text-sm text-gray-600">{student.email}</p>
                {student.phone && <p className="text-sm text-gray-500">{student.phone}</p>}
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {student.programs.map((program) => (
                <section key={program.courseId} className="rounded-xl bg-gray-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">{program.courseTitle}</h4>
                      <p className="text-sm text-gray-600">
                        {program.enrollmentStatus} · course progress {program.progress}% · assessments passed {program.passedCount}/{program.assessmentCount}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/course/${program.courseId}#materials`}>Open program</Link>
                    </Button>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-kiki-purple-600" style={{ width: `${Math.min(program.progress, 100)}%` }} />
                  </div>
                  <div className="mt-4 space-y-3">
                    {program.assessments.length === 0 && <p className="text-sm text-gray-600">This program has no assessments yet.</p>}
                    {program.assessments.map((assessment) => (
                      <div key={assessment.id} className="rounded-xl bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900">{assessment.title}</p>
                            <p className="text-sm text-gray-500">
                              {assessment.isPublished ? 'Published' : 'Draft'}
                              {assessment.latest
                                ? ` · latest ${assessment.latest.score}/${assessment.latest.totalMarks}`
                                : ' · not started'}
                            </p>
                          </div>
                          {assessment.latest && (
                            <Badge className={assessment.latest.passed ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}>
                              {assessment.latest.passed ? 'Passed' : 'Not passed'}
                            </Badge>
                          )}
                        </div>
                        {assessment.attempts.map((attempt) => {
                          const isOpen = openAttemptId === attempt.id;
                          const details = isOpen
                            ? describeAttemptAnswers(progress.questionsByAssessmentId[assessment.id] ?? [], attempt.answers)
                            : [];
                          return (
                            <div key={attempt.id} className="mt-3 border-t pt-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm text-gray-600">
                                  {new Date(attempt.submittedAt).toLocaleString()} · {attempt.score}/{attempt.totalMarks} · {attempt.passed ? 'Passed' : 'Not passed'}
                                </p>
                                <Button type="button" variant="ghost" size="sm" onClick={() => setOpenAttemptId(isOpen ? null : attempt.id)}>
                                  {isOpen ? 'Hide details' : 'View details'}
                                </Button>
                              </div>
                              {isOpen && (
                                <ul className="mt-3 space-y-2">
                                  {details.map((detail) => (
                                    <li key={detail.questionId} className="rounded-lg bg-gray-50 p-3 text-sm">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-kiki-purple-700">{detail.sectionTitle}</p>
                                      <p className="mt-1 font-medium text-gray-900">{detail.prompt}</p>
                                      <p className="mt-1 text-gray-700">Student answer: {detail.responseLabel}</p>
                                      <p className="text-gray-700">Expected: {detail.expectedLabel}</p>
                                      <p className={detail.awarded ? 'text-green-700' : 'text-amber-800'}>
                                        {detail.awarded ? `Correct · ${detail.marks} mark` : `Needs practice · 0 of ${detail.marks}`}
                                      </p>
                                      {detail.guidance && <p className="mt-1 text-gray-600">{detail.guidance}</p>}
                                    </li>
                                  ))}
                                  {details.length === 0 && <li className="text-sm text-gray-600">This attempt has no saved answers.</li>}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default StudentProgress;
