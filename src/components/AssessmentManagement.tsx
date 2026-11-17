import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AssessmentPlayer from '@/components/AssessmentPlayer';
import {
  deleteAssessment,
  fetchAssessmentQuestions,
  fetchProgramAssessments,
  isAssessmentStorageMissing,
  replaceAssessmentQuestions,
  saveAssessmentSettings,
  type ProgramAssessment,
} from '@/lib/assessmentApi';
import {
  assessmentQuestionKindLabels,
  assessmentQuestionKinds,
  createQuestionDraft,
  draftsToPayloads,
  formatRequiredPhrases,
  isAssessmentResponseCorrect,
  type AssessmentQuestionDraft,
  type AssessmentQuestionKind,
} from '@/lib/assessmentModel';
import type { LearnerAssessmentQuestion } from '@/lib/assessmentApi';
import { importAssessments } from '@/lib/adminSheetImport';
import { assessmentSheetHeaders, assessmentSheetSample } from '@/lib/sheetTemplates';
import AdminSheetMenu from '@/components/AdminSheetMenu';

interface CourseOption {
  id: string;
  title: string;
}

const emptySettings = {
  title: '',
  description: '',
  instructions: '',
  durationMinutes: '30',
  passingScore: '70',
  sequence: '1',
  isActive: true,
  isPublished: false,
  showFeedback: true,
  allowReview: true,
};

const AssessmentManagement = () => {
  const { toast } = useToast();
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [courseId, setCourseId] = useState('');
  const [assessments, setAssessments] = useState<ProgramAssessment[]>([]);
  const [settings, setSettings] = useState(emptySettings);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestionDraft[]>([]);
  const [previewQuestions, setPreviewQuestions] = useState<LearnerAssessmentQuestion[] | null>(null);
  const [storageMissing, setStorageMissing] = useState(false);

  const loadCourses = async () => {
    const { data, error } = await supabase.from('courses').select('id, title').order('title');
    if (error) {
      toast({ title: 'Programs', description: 'Could not load programs.', variant: 'destructive' });
      return;
    }
    setCourses(data ?? []);
    if (!courseId && data && data.length > 0) {
      setCourseId(data[0].id);
    }
  };

  const loadAssessments = async (selectedCourseId: string) => {
    try {
      setAssessments(await fetchProgramAssessments(selectedCourseId));
      setStorageMissing(false);
    } catch (error) {
      if (isAssessmentStorageMissing(error as { code?: string; message?: string })) {
        setStorageMissing(true);
        return;
      }
      toast({ title: 'Assessments', description: 'Could not load assessments.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    void loadCourses();
  }, []);

  useEffect(() => {
    if (courseId) {
      void loadAssessments(courseId);
    }
  }, [courseId]);

  const openAssessment = async (assessment: ProgramAssessment) => {
    setEditingId(assessment.id);
    setSettings({
      title: assessment.title,
      description: assessment.description ?? '',
      instructions: assessment.instructions ?? '',
      durationMinutes: String(assessment.durationMinutes),
      passingScore: String(assessment.passingScore),
      sequence: String(assessment.sequence),
      isActive: assessment.isActive,
      isPublished: assessment.isPublished,
      showFeedback: assessment.showFeedback,
      allowReview: assessment.allowReview,
    });
    const rows = await fetchAssessmentQuestions(assessment.id);
    setQuestions(rows.length > 0 ? rows.map((row) => {
      const phrases = Array.isArray(row.required_phrases) ? row.required_phrases as string[][] : [];
      const options = [...(row.assessment_options ?? [])].sort((left, right) => left.sort_order - right.sort_order);
      return createQuestionDraft({
        key: row.id,
        sectionTitle: row.section_title,
        sectionInstructions: row.section_instructions ?? '',
        prompt: row.prompt,
        kind: row.kind as AssessmentQuestionKind,
        pictureText: row.picture_text ?? '',
        pictureUrl: row.picture_url ?? '',
        passageTitle: row.passage_title ?? '',
        passage: row.passage ?? '',
        listeningScript: row.listening_script ?? '',
        marks: String(row.marks),
        minimumWords: String(row.minimum_words ?? 1),
        acceptedAnswers: (row.accepted_answers ?? []).join(', '),
        modelAnswer: row.model_answer ?? '',
        wordBank: (row.word_bank ?? []).join(' / '),
        requiredPhrases: formatRequiredPhrases(phrases),
        guidance: row.guidance ?? '',
        options: options.length > 0
          ? options.map((option) => ({ key: option.id, label: option.label, isCorrect: option.is_correct }))
          : undefined,
      });
    }) : [createQuestionDraft()]);
  };

  const save = async () => {
    if (!courseId || !settings.title.trim()) {
      toast({ title: 'Assessment', description: 'Choose a program and enter a title.', variant: 'destructive' });
      return;
    }
    const durationMinutes = Number(settings.durationMinutes);
    const passingScore = Number(settings.passingScore);
    const sequence = Number(settings.sequence);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || !Number.isInteger(passingScore) || passingScore < 0 || passingScore > 100) {
      toast({ title: 'Assessment', description: 'Duration must be at least 1 minute and the pass mark must be 0–100%.', variant: 'destructive' });
      return;
    }
    const payloads = draftsToPayloads(questions);
    if ('error' in payloads) {
      toast({ title: 'Questions', description: payloads.error, variant: 'destructive' });
      return;
    }
    if (settings.isPublished && payloads.length === 0) {
      toast({ title: 'Questions', description: 'Add at least one question before publishing.', variant: 'destructive' });
      return;
    }
    try {
      const assessmentId = await saveAssessmentSettings(editingId, {
        courseId,
        title: settings.title,
        description: settings.description,
        instructions: settings.instructions,
        durationMinutes,
        passingScore,
        sequence: Number.isInteger(sequence) ? sequence : 1,
        isActive: settings.isActive,
        isPublished: settings.isPublished,
        showFeedback: settings.showFeedback,
        allowReview: settings.allowReview,
      });
      await replaceAssessmentQuestions(assessmentId, payloads);
      setEditingId(assessmentId);
      toast({ title: 'Saved', description: 'The assessment is stored for this program.' });
      await loadAssessments(courseId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the assessment.';
      toast({
        title: 'Assessment',
        description: message.includes('assessments') ? 'Run the assessment SQL in Supabase before saving.' : message,
        variant: 'destructive',
      });
    }
  };

  const updateQuestion = (key: string, patch: Partial<AssessmentQuestionDraft>) => {
    setQuestions((current) => current.map((question) => question.key === key ? { ...question, ...patch } : question));
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    setQuestions((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  };

  const startPreview = () => {
    const payloads = draftsToPayloads(questions);
    if ('error' in payloads) {
      toast({ title: 'Preview', description: payloads.error, variant: 'destructive' });
      return;
    }
    setPreviewQuestions(payloads.map((question, questionIndex) => ({
      id: `preview-${questionIndex}`,
      sectionTitle: question.sectionTitle,
      sectionInstructions: question.sectionInstructions,
      sectionOrder: question.sectionOrder,
      prompt: question.prompt,
      kind: question.kind,
      pictureText: question.pictureText,
      pictureUrl: question.pictureUrl,
      passageTitle: question.passageTitle,
      passage: question.passage,
      listeningScript: question.listeningScript,
      marks: question.marks,
      sortOrder: question.sortOrder,
      wordBank: question.wordBank,
      options: question.options.map((option, optionIndex) => ({
        id: `preview-${questionIndex}-${optionIndex}`,
        label: option.label,
      })),
    })));
  };

  if (previewQuestions) {
    const payloads = draftsToPayloads(questions);
    const scoredQuestions = 'error' in payloads ? [] : payloads;
    return (
      <div className="space-y-4">
        <AssessmentPlayer
          title={settings.title || 'Preview'}
          instructions={settings.instructions}
          showFeedback={settings.showFeedback}
          questions={previewQuestions}
          onCheck={async (questionId, response) => {
            const questionIndex = Number(questionId.replace('preview-', ''));
            const question = scoredQuestions[questionIndex];
            if (!question) {
              return false;
            }
            const optionIndex = response.startsWith('preview-') ? response.split('-').at(-1) ?? '' : response;
            return isAssessmentResponseCorrect({
              ...question,
              options: question.options.map((option, index) => ({ ...option, id: String(index) })),
            }, question.kind === 'choice' || question.kind === 'listening' || question.kind === 'match' ? String(optionIndex) : response);
          }}
          onSubmit={async (answers) => {
            const score = scoredQuestions.reduce((total, question, questionIndex) => {
              const response = answers[`preview-${questionIndex}`] ?? '';
              const optionIndex = response.startsWith('preview-') ? response.split('-').at(-1) ?? '' : response;
              const awarded = isAssessmentResponseCorrect({
                ...question,
                options: question.options.map((option, index) => ({ ...option, id: String(index) })),
              }, question.kind === 'choice' || question.kind === 'listening' || question.kind === 'match' ? String(optionIndex) : response);
              return total + (awarded ? question.marks : 0);
            }, 0);
            const totalMarks = scoredQuestions.reduce((total, question) => total + question.marks, 0);
            return {
              id: 'preview',
              score,
              totalMarks,
              passed: totalMarks === 0 || Math.round((score / totalMarks) * 100) >= Number(settings.passingScore),
              submittedAt: new Date().toISOString(),
              programProgress: null,
              results: [],
            };
          }}
          onExit={() => setPreviewQuestions(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <ClipboardCheck className="h-6 w-6" />
          Assessments
        </h2>
        <p className="mt-1 text-gray-600">Create a separate assessment for each program. Questions stay with that program.</p>
      </div>
      {storageMissing && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Run supabase/migrations/20261115210000_program_assessments.sql in the Supabase SQL editor before saving assessments.
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-[16rem] max-w-xl flex-1 flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <Label>Program</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Choose a program" /></SelectTrigger>
              <SelectContent>
                {courses.map((course) => <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {courseId && (
            <Button asChild variant="outline">
              <Link to={`/course/${courseId}#materials`}>View program</Link>
            </Button>
          )}
        </div>
        <AdminSheetMenu
          label="New assessment"
          singleLabel="Create single assessment"
          multipleLabel="Upload multiple assessments"
          templateFilename="assessments-template.csv"
          templateHeaders={assessmentSheetHeaders}
          templateSample={assessmentSheetSample}
          onCreateOne={() => { setEditingId(null); setSettings(emptySettings); setQuestions([createQuestionDraft()]); }}
          importRows={importAssessments}
          onComplete={() => { if (courseId) void loadAssessments(courseId); }}
        />
      </div>
      <p className="text-sm text-gray-500">
        Use the sample CSV. One row is one question. Rows with the same program and assessment title update that assessment. Set program_title to a saved course title.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {assessments.map((assessment) => (
          <button key={assessment.id} type="button" className="rounded-2xl border bg-white p-4 text-left" onClick={() => void openAssessment(assessment)}>
            <div className="font-semibold text-gray-900">{assessment.title}</div>
            <p className="mt-1 text-sm text-gray-500">
              {assessment.isPublished ? 'Published' : 'Draft'} · {assessment.isActive ? 'Active' : 'Inactive'} · {assessment.durationMinutes} min
            </p>
          </button>
        ))}
      </div>
      {(editingId || questions.length > 0) && (
        <div className="space-y-4 rounded-2xl border bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Title</Label>
              <Input value={settings.title} onChange={(event) => setSettings({ ...settings, title: event.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Textarea value={settings.description} onChange={(event) => setSettings({ ...settings, description: event.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Instructions</Label>
              <Textarea value={settings.instructions} onChange={(event) => setSettings({ ...settings, instructions: event.target.value })} />
            </div>
            <div>
              <Label>Duration (minutes)</Label>
              <Input type="number" min={1} value={settings.durationMinutes} onChange={(event) => setSettings({ ...settings, durationMinutes: event.target.value })} />
            </div>
            <div>
              <Label>Pass mark (%)</Label>
              <Input type="number" min={0} max={100} value={settings.passingScore} onChange={(event) => setSettings({ ...settings, passingScore: event.target.value })} />
            </div>
            <div>
              <Label>Sequence</Label>
              <Input type="number" min={1} value={settings.sequence} onChange={(event) => setSettings({ ...settings, sequence: event.target.value })} />
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-6">
              <Label className="flex items-center gap-2"><Switch checked={settings.isActive} onCheckedChange={(checked) => setSettings({ ...settings, isActive: checked })} /> Active</Label>
              <Label className="flex items-center gap-2"><Switch checked={settings.isPublished} onCheckedChange={(checked) => setSettings({ ...settings, isPublished: checked })} /> Published</Label>
              <Label className="flex items-center gap-2"><Switch checked={settings.showFeedback} onCheckedChange={(checked) => setSettings({ ...settings, showFeedback: checked })} /> Immediate feedback</Label>
              <Label className="flex items-center gap-2"><Switch checked={settings.allowReview} onCheckedChange={(checked) => setSettings({ ...settings, allowReview: checked })} /> Show review</Label>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Questions</h3>
            <Button type="button" variant="outline" size="sm" onClick={() => setQuestions([...questions, createQuestionDraft({ sectionTitle: questions.at(-1)?.sectionTitle ?? 'Questions' })])}>
              Add question
            </Button>
          </div>
          {questions.map((question, index) => (
            <div key={question.key} className="space-y-3 rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">Question {index + 1}</p>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => moveQuestion(index, -1)}>Up</Button>
                  <Button type="button" variant="ghost" size="sm" disabled={index === questions.length - 1} onClick={() => moveQuestion(index, 1)}>Down</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setQuestions(questions.filter((item) => item.key !== question.key))}>
                    <Trash2 className="mr-2 h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Section</Label>
                  <Input value={question.sectionTitle} onChange={(event) => updateQuestion(question.key, { sectionTitle: event.target.value })} />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={question.kind} onValueChange={(value) => updateQuestion(question.key, { kind: value as AssessmentQuestionKind })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {assessmentQuestionKinds.map((kind) => <SelectItem key={kind} value={kind}>{assessmentQuestionKindLabels[kind]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Section instructions</Label>
                  <Input value={question.sectionInstructions} onChange={(event) => updateQuestion(question.key, { sectionInstructions: event.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Prompt</Label>
                  <Textarea value={question.prompt} onChange={(event) => updateQuestion(question.key, { prompt: event.target.value })} />
                </div>
                <div>
                  <Label>Marks</Label>
                  <Input type="number" min={1} value={question.marks} onChange={(event) => updateQuestion(question.key, { marks: event.target.value })} />
                </div>
                <div>
                  <Label>Picture description</Label>
                  <Input value={question.pictureText} onChange={(event) => updateQuestion(question.key, { pictureText: event.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Picture URL</Label>
                  <Input value={question.pictureUrl} onChange={(event) => updateQuestion(question.key, { pictureUrl: event.target.value })} placeholder="/assessment-pictures/teamwork.svg" />
                  <p className="mt-1 text-xs text-gray-500">When a picture link is set, learners see the illustration first and answer from it. The description stays as the image text and is not shown as the question.</p>
                </div>
                <div>
                  <Label>Passage title</Label>
                  <Input value={question.passageTitle} onChange={(event) => updateQuestion(question.key, { passageTitle: event.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Passage</Label>
                  <Textarea value={question.passage} onChange={(event) => updateQuestion(question.key, { passage: event.target.value })} />
                </div>
                {question.kind === 'listening' && (
                  <div className="md:col-span-2">
                    <Label>Recording script</Label>
                    <Textarea value={question.listeningScript} onChange={(event) => updateQuestion(question.key, { listeningScript: event.target.value })} />
                    <p className="mt-1 text-xs text-gray-500">Learners hear this script. It is not shown on the question.</p>
                  </div>
                )}
                {question.kind === 'blank' && (
                  <div className="md:col-span-2">
                    <Label>Accepted answers</Label>
                    <Input value={question.acceptedAnswers} onChange={(event) => updateQuestion(question.key, { acceptedAnswers: event.target.value })} placeholder="at, At" />
                  </div>
                )}
                {question.kind === 'order' && (
                  <>
                    <div className="md:col-span-2">
                      <Label>Word bank</Label>
                      <Input value={question.wordBank} onChange={(event) => updateQuestion(question.key, { wordBank: event.target.value })} placeholder="interview / tomorrow / my" />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Correct sentence</Label>
                      <Input value={question.modelAnswer} onChange={(event) => updateQuestion(question.key, { modelAnswer: event.target.value })} />
                    </div>
                  </>
                )}
                {question.kind === 'written' && (
                  <>
                    <div>
                      <Label>Minimum words</Label>
                      <Input type="number" min={1} value={question.minimumWords} onChange={(event) => updateQuestion(question.key, { minimumWords: event.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Required phrases</Label>
                      <Textarea value={question.requiredPhrases} onChange={(event) => updateQuestion(question.key, { requiredPhrases: event.target.value })} placeholder={'One group per line. Separate alternatives with |'} />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Marking guidance</Label>
                      <Textarea value={question.guidance} onChange={(event) => updateQuestion(question.key, { guidance: event.target.value })} />
                    </div>
                  </>
                )}
              </div>
              {(question.kind === 'choice' || question.kind === 'listening' || question.kind === 'match') && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Turn on Correct for every answer that should be accepted.</p>
                  {question.options.map((option) => (
                    <div key={option.key} className="flex items-center gap-2">
                      <Switch
                        checked={option.isCorrect}
                        onCheckedChange={(checked) => updateQuestion(question.key, {
                          options: question.options.map((item) => item.key === option.key ? { ...item, isCorrect: checked } : item),
                        })}
                        aria-label={option.isCorrect ? 'Correct answer' : 'Mark as correct'}
                      />
                      <span className="w-16 shrink-0 text-xs font-medium text-gray-600">{option.isCorrect ? 'Correct' : 'Option'}</span>
                      <Input
                        value={option.label}
                        onChange={(event) => updateQuestion(question.key, {
                          options: question.options.map((item) => item.key === option.key ? { ...item, label: event.target.value } : item),
                        })}
                        placeholder="Answer option"
                      />
                      <Button type="button" variant="ghost" size="sm" onClick={() => updateQuestion(question.key, { options: question.options.filter((item) => item.key !== option.key) })}>Remove</Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => updateQuestion(question.key, { options: [...question.options, { key: crypto.randomUUID(), label: '', isCorrect: false }] })}>
                    Add option
                  </Button>
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void save()}>Save assessment</Button>
            <Button type="button" variant="outline" onClick={startPreview}>Preview</Button>
            {editingId && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  void deleteAssessment(editingId)
                    .then(() => {
                      setEditingId(null);
                      setQuestions([]);
                      setSettings(emptySettings);
                      return loadAssessments(courseId);
                    })
                    .catch((error: Error) => toast({ title: 'Delete', description: error.message, variant: 'destructive' }));
                }}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentManagement;
