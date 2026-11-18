# ADR 0001: KIKI assistant

Status: Approved for ImplementationAgent
Date: 2026-11-18

ImplementationAgent may add only the files in "Allowed files" and the wiring edits in "Allowed edits". Anything else, including new tables, RLS changes, and changes to import or scoring behavior, needs a new ArchitectureAgent decision.

## Context

The site is a Vite React single-page app on Vercel. `vercel.json` sends every path to `index.html`. There is no application server in this repo.

Data access is the Supabase client in the browser (`src/integrations/supabase/client.ts`) plus two Supabase Edge Functions that keep Razorpay secrets on the server (`supabase/functions/create-razorpay-order`, `supabase/functions/verify-razorpay-payment`). There is no LLM client, key, or chat API.

Auth is Supabase Auth (`src/contexts/AuthContext.tsx`). `profiles.role` is `student`, `instructor`, or `admin`. Admin screens check `role === 'admin'`. Row-level security uses `public.is_admin(auth.uid())` or `auth.uid()`. No policy grants an instructor extra rows. `courses.instructor_id` is not an authorization check.

A program is a `courses` row. `course_type` is `course` or `career_test` (`src/lib/courseCatalog.ts`). There is no programs table.

Spreadsheet import is CSV only. `src/components/AdminSheetMenu.tsx` rejects `.xls` and `.xlsx` and tells the admin to save as CSV. `src/lib/adminSheetImport.ts` writes through the signed-in user's session:

- `importUsers` can create accounts and set roles. It accepts a password.
- `importCourses` matches on `course_type` plus title. One match updates. Several matches are an error.
- `importAssessments` matches a program by title, then an assessment by title. An existing assessment is updated, and `replaceAssessmentQuestions` replaces that assessment's questions.
- `importCareerSections` writes `page_sections` where `page_key` is `career_test`.

Those imports commit one row or one assessment at a time. They do not open a database transaction, and they already return created, updated, and error counts.

Course images have no pixel size, aspect ratio, or file-type rule. `CourseManagement` stores `image_url` as a Google or Drive link. `src/lib/courseImages.ts` displays that link, or a built-in `/course-images/` file when the title starts with a known prefix.

Learner assessment questions come from `get_assessment_for_learner`. Correct options and accepted answers are not a learner read. Scoring lives in `submit_assessment_attempt` and `src/lib/assessmentModel.ts`. Question kinds are `choice`, `listening`, `blank`, `match`, `order`, and `written`.

Signup creates `auth.users`, and `handle_new_user` inserts a `profiles` row with role `student` (`supabase/migrations/20250715141500_drop_referrals_and_fix_user_signup.sql`). The UI for that is `src/contexts/AuthContext.tsx` and `src/pages/Login.tsx`.

Admin routes sit outside `Layout`:

| Path | Screen |
| --- | --- |
| `/admin` | Notifications |
| `/admin/users` | Users |
| `/admin/courses` | Courses |
| `/admin/assessments` | Assessments |
| `/admin/progress` | Scores and answers |
| `/admin/career-test` | Career test |
| `/admin/enrollments` | Enrollments |
| `/admin/homepage` | Homepage |
| `/admin/coupons` | Coupons |

Learner routes inside `Layout` include `/`, `/programs`, `/course/:courseId`, `/cart`, `/checkout`, `/enrolled-courses`, `/career-test`, and `/mbti-test`. Login routes are `/login`, `/admin-login`, and `/auth/confirm`.

## Decision

KIKI is a floating assistant. A Supabase Edge Function is the only place that calls a model. The function answers from a fixed query catalog and a curated knowledge note. It never runs SQL written by the model. It never inserts rows. Confirmed imports run in the browser through the existing CSV importers and the caller's session.

### Provider and server boundary

One interface, `LanguageModel`, lives in the edge function. The first adapter speaks the OpenAI-compatible chat-completions HTTP API. A later provider replaces that adapter only.

Secrets, set in the Supabase function environment, not in Vite:

- `KIKI_LLM_API_KEY`
- `KIKI_LLM_BASE_URL` (default `https://api.openai.com/v1` when unset)
- `KIKI_LLM_MODEL`

No `VITE_` variable may hold a model key, service-role key, or database password. The function creates a Supabase client with the caller's `Authorization` bearer token and the anon key. It must not read `SUPABASE_SERVICE_ROLE_KEY`. If `KIKI_LLM_API_KEY` is missing, the function returns a configuration error and the panel says KIKI is unavailable. It must not invent an answer.

Each user message does at most two model calls: one to choose a reply or one catalog tool, and a second only when a tool ran, to phrase that tool's result. Tool results are data. The function ignores any instruction inside them.

The function logs JSON with `event`, tool name, user id, and error code. It does not log prompts, document text, emails, or row contents.

Request limits: the last 10 messages, 2,000 characters each, and at most 100,000 characters of extracted document text. Larger bodies are rejected.

### Query catalog

The model may name a tool from this list and supply the listed arguments. The function checks the name, the argument types, and the caller's `profiles.role`. The role is read in the function. The client cannot send a role that the function trusts.

Queries use the caller's token, so existing RLS still applies. Results are capped at 50 rows unless a tool says otherwise. Empty results stay empty.

Definitions the model must not redefine:

- A program is a `courses` row. Engagement for a program is its enrollment count plus its assessment-attempt count.
- Completion is an enrollment whose `status` is `completed` or whose `completed_at` is set.
- An inactive user is an admin-only result: `profiles.is_active` is false, or `admin_user_sign_ins.last_sign_in_at` is null or older than 30 days.
- Assessment averages report attempt count, average `score`, and average `total_marks`. A percentage is included only as `score / total_marks` when `total_marks` is greater than zero.

| Tool | Arguments | student | instructor | admin |
| --- | --- | --- | --- | --- |
| `list_available_courses` | optional `category` | yes | yes | yes |
| `get_course` | `title` | yes, active courses | yes, active courses | yes |
| `list_my_enrollments` | none | own rows | own rows | own rows |
| `list_my_attempts` | none | own score, total, passed, submitted time | same | same |
| `count_courses` | none | no | no | yes |
| `count_users` | none | no | no | count only |
| `count_registrations` | `from`, `to` as ISO dates | no | no | count only |
| `highest_enrollment` | none | no | no | one course and its count |
| `users_completed_course` | `title` | no | no | up to 50 names and emails |
| `average_attempt_score` | optional `title` | no | no | yes |
| `program_engagement` | none | no | no | top 10 |
| `inactive_users` | none | no | no | count plus 20 names and emails |
| `course_report` | `title` | no | no | enrollment and attempt totals |
| `list_assessments` | `title` of the program | no | no | settings, not answer keys |
| `assessment_questions` | `programTitle`, `assessmentTitle` | no | no | questions and correct answers, cap 100 |

`list_available_courses` and `get_course` return title, category, price, duration, age range, mode, and status. They do not return attachment URLs.

Instructor uses the student column. The stored instructor role has no extra database rights, so KIKI does not invent any.

These are never tools: payments, orders, coupons, profiles of other people for a non-admin, `auth.users` except through the existing `admin_user_sign_ins` function for `inactive_users`, service configuration, and any SQL text.

A signed-out visitor gets the knowledge note only. Database tools require a session.

If the question is ambiguous between two tools, the reply asks one clarifying question and calls no tool.

### Codebase answers

`supabase/functions/kiki-chat/knowledge.md` is the only application guide sent to the model. It is written from this ADR and the files named here. It is not a live dump of the repository. It must not contain env values, keys, or connection strings.

The guide must state these facts, which are easy to invent wrongly:

- There is no recommended thumbnail size or aspect ratio. Admins paste a Google or Drive image link on `/admin/courses`.
- New courses are added at `/admin/courses`. Assessments are added at `/admin/assessments`. Users are managed at `/admin/users`.
- A learner enrolls from the course page through the cart and checkout. Current learning is at `/enrolled-courses`.
- Registration is `AuthContext.signUp` and `Login.tsx`. The database trigger `handle_new_user` inserts the profile as `student`.
- Assessment scoring is `submit_assessment_attempt` with the kinds and checks in `src/lib/assessmentModel.ts`. Learners do not receive the answer key from KIKI.

If the guide and the tool results do not contain the answer, KIKI says it does not have that information.

Navigation buttons use only this path list: `/`, `/programs`, `/course/:courseId` when a tool returned that id, `/cart`, `/checkout`, `/enrolled-courses`, `/career-test`, `/login`, `/admin`, `/admin/users`, `/admin/courses`, `/admin/assessments`, `/admin/progress`, `/admin/career-test`, `/admin/enrollments`, `/admin/homepage`, `/admin/coupons`. Admin paths are returned only when the caller is an admin. Any other path is dropped.

### Conversation storage

No new table. The open panel keeps the transcript in React state. Each request sends the last 10 messages. "Clear conversation" drops that state. History does not survive a reload, and it is not written to Postgres. A persistent transcript would be a new data model and is out of scope.

### Document confirm-then-insert

Upload is shown only to an admin.

| Format | v1 |
| --- | --- |
| CSV | Parsed with the existing `parseCsv` and `rowsToRecords`. No model call when the headers match a template. |
| TXT | Text is sent to the model to fill one template. |
| PDF | Text extracted in the browser, then the same structuring step. |
| DOCX | Text extracted in the browser, then the same structuring step. |
| XLS, XLSX | Rejected. The admin saves the file as CSV, which is the current `AdminSheetMenu` rule. |
| DOC | Rejected. Legacy `.doc` has no parser in the app. The admin saves as DOCX or CSV. |

The model may fill only these existing header sets:

- course rows: `courseSheetHeaders` in `src/lib/sheetTemplates.ts`, imported with `importCourses` and `courseType` `course`
- assessment rows: `assessmentSheetHeaders`, imported with `importAssessments`
- career-test section rows: `careerSectionSheetHeaders`, imported with `importCareerSections`

User sheets are excluded. KIKI must not create accounts, set passwords, or change roles.

The function validates proposed rows with the same required columns and field parsing the importers already use. It returns the preview. It does not write.

The panel lets the admin edit or remove rows, then confirm. The confirm button calls the existing importer in the browser. That call uses the admin session, so RLS stays in force. The completion report is the importer's `created`, `updated`, and `errors`. Rows that do not save stay in `errors`. There is no batch rollback, because the current importers do not have one. The preview for an assessment whose title already exists on that program must say that confirming replaces that assessment's questions.

A non-admin confirm request is not given an importer call.

### UI placement

Mount one `KikiAssistant` in `src/App.tsx` inside `BrowserRouter` and `AuthProvider`, beside `Routes`. `Layout` does not wrap `/admin`, so a button in the header or footer would be missing from the admin panel.

Hide it on `/login`, `/admin-login`, and `/auth/confirm`.

The button is fixed to the bottom-right. Below the `lg` breakpoint the panel is full screen. Otherwise it is a pane above the button. The panel includes the transcript, timestamps, a typing state, suggested questions, a clear action, admin file upload, tables, stat lines, navigation links, and the import preview. The welcome text is: "Hi! I'm KIKI, your intelligent learning assistant. I can help you explore courses, analyze platform data, manage learning content, understand application features, and guide you through your learning journey. What would you like to know?"

Suggested questions for a student come from the student tools and the public routes. Suggested questions for an admin may include counts and import. They are static lists, not model output.

### Allowed files

- `src/components/KikiAssistant.tsx`
- `src/lib/kiki/routes.ts`
- `src/lib/kiki/extractDocument.ts`
- `src/lib/kiki/proposedRows.ts`
- `supabase/functions/kiki-chat/index.ts`
- `supabase/functions/kiki-chat/model.ts`
- `supabase/functions/kiki-chat/catalog.ts`
- `supabase/functions/kiki-chat/validate.ts`
- `supabase/functions/kiki-chat/knowledge.md`

PDF text uses `pdfjs-dist`. DOCX text uses `mammoth`. If either package does not install, stop and return here. Do not add a second model SDK.

### Allowed edits

- `src/App.tsx`: render `KikiAssistant` in the placement above.
- `package.json` and the lockfile: `pdfjs-dist` and `mammoth` only.

### Not allowed

- Editing `adminSheetImport`, `sheetRows`, `assessmentModel`, `assessmentApi`, auth, checkout, or RLS.
- New tables, views, or a generic SQL function.
- Using the service role inside `kiki-chat`.
- Executing model-written SQL or letting the model choose a table name.
- Sending secrets, payment rows, coupon codes, or other people's data to a student session.
- Answering database questions without a catalog result.
- Inserting before the admin presses confirm.

## Consequences

Students can ask about their own learning and the public catalog. Admins can ask the catalog questions and import courses, assessments, and career-test sections after a preview. Instructors see the same assistant as students.

Cross-device chat history, Excel and legacy Word parsing, account creation, and a transactional batch rollback are not part of this design.

TestAgent, after ReviewAgent, covers catalog role gates, rejected SQL-shaped tool names, import preview with no write before confirm, the assessment-replace warning, student versus admin tool results, and the responsive panel.
