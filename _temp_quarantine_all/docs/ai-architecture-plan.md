# SmartNotes AI Architecture Plan

## Step 1: Draft Plan

1. Split the AI system into 4 layers.
- `Ingestion`: normalize note content, strip HTML/markdown, extract plain text, detect language, collect basic metadata.
- `Retrieval`: search candidate folders and later similar notes via `pgvector` and SQL filters.
- `LLM Classification`: choose folder, generate `user_tags`, `hidden_tags`, `relevance`, and minimal resurfacing label.
- `Resurfacing`: keep separate from folder classification so "write and forget" behavior can evolve independently.

2. Define the minimal LLM input contract.
- `note`: `id`, `title`, `clean_text`, `created_at`, `updated_at`, `current_folder_id`, `current_user_tags`, `current_hidden_tags`, `analyzed`, `source_type`, `language`, `char_count`.
- `folder_candidates`: top-N relevant folders from retrieval, not the entire folder catalog.
- `user_context`: language, timezone, most-used folders, most-used tags, optional behavior hints.
- `retrieval_context`: reserved for future similar-note and correction context.
- `task`: exact goal and strict output schema.

3. Move folder selection to retrieval-first.
- Generate a note embedding.
- Search similar folders in `pgvector`.
- Pass only top 5-15 folder candidates to the LLM.
- Allow `folderId = null` when confidence is low.

4. Use a hybrid pipeline.
- SQL filters: user scope, active folders, exclusions.
- Vector retrieval: semantic folder candidates.
- LLM: final semantic decision over narrowed context.
- Deterministic validation after model output.

5. Keep resurfacing as a separate concern.
- Track `importance_score`.
- Track `resurfacing_type`: task / idea / reference / reminder.
- Track `resurfacing_window`: soon / later / long-term.

6. Reserve future AI features without implementing them yet.
- `split_candidate`
- `rewrite_candidate`
- `structure_candidate`

7. Fully rewrite the system prompt.
- Replace the current prompt structure.
- Translate the system instructions to English.
- Keep user content in the original language.
- Separate instructions from structured payload.

8. Prepare Supabase storage.
- `notes`
- `folders`
- `note_embeddings`
- `folder_embeddings`
- `note_analysis_runs`
- `note_analysis_results`
- `note_resurfacing_scores`
- `manual_feedback`

9. Apply modern implementation practices.
- English system prompt.
- Retrieval before generation.
- Bounded context windows.
- Strict JSON validation.
- Idempotent jobs.
- Prompt and contract versioning.

10. Organize the monorepo.
- `apps/web`
- `packages/db`
- `packages/ai-contracts`
- `packages/ai-prompts`
- `packages/ai-pipeline`
- `packages/shared`

## Step 2: Self-Critique

1. The draft plan is too broad for the current stage.
- It risks over-architecting before stabilizing the first useful AI path.

2. Vercel Edge is not the right place for heavy analysis jobs.
- Reindexing, embeddings, retries, and batching should run in Node/serverless workers, not Edge.

3. Token usage can still grow too fast.
- Note text, folder candidates, user context, and future similar-note context can easily bloat prompts.

4. Similar-note context is premature.
- For v1 folder classification, it likely adds noise more than quality.

5. The Supabase/pgvector section is incomplete.
- It does not define embedding model, vector dimensions, re-embedding strategy, or indexing strategy.

6. The write path is underspecified.
- It must be clear when embeddings are generated and how async consistency is handled.

7. Resurfacing is still too abstract.
- It needs a simple taxonomy before implementation, otherwise it becomes vague scoring.

8. Multi-tenant safety must be explicit.
- Retrieval and vector search must be strictly scoped by `user_id`.

9. Fallback strategy is missing.
- Need deterministic behavior when retrieval fails, embeddings are missing, or the model returns invalid JSON.

10. Prompt rewrite needs measurement.
- Without eval datasets and metrics, prompt changes stay subjective.

## Step 3: Final Architecture

1. Lock the current scope.
- Build only:
  - folder assignment
  - user tags
  - hidden tags
  - relevance
  - minimal resurfacing class
- Do not build yet:
  - note splitting
  - rewrite/structure actions
  - full reminder automation UX

2. Choose the execution model.
- Use `Vercel Node runtime` for AI analysis and reindex jobs.
- Do not use Edge for heavy inference or long-running work.
- Run async tasks through Supabase-backed job tables.

3. Define `AI contract v1`.
- Version the input schema.
- Version the output schema.
- Store `contract_version`, `prompt_version`, and `model_version` for every analysis run.

4. Keep the context minimal.
- Send only:
  - one note
  - current tags and folder
  - top 5-10 candidate folders
- Do not include similar notes in v1.

5. Build retrieval-first folder classification.
- Generate note embeddings asynchronously.
- Generate folder embeddings on folder create/update.
- Search only inside the current user scope.
- Retrieve top-N candidate folders.
- Let the LLM choose only among those candidates.

6. Split deterministic and LLM responsibilities.
- Deterministic:
  - text cleaning
  - language detection
  - token trimming
  - folder candidate retrieval
  - schema validation
- LLM:
  - semantic folder choice
  - user tags
  - hidden tags
  - relevance
  - minimal resurfacing class

7. Use a minimal resurfacing taxonomy.
- `task`
- `time-sensitive`
- `idea`
- `reference`
- `archive-like`

8. Rewrite the prompt completely.
- English only for system instructions.
- Short, rigid, structured format.
- Explicit input rules, output rules, and constraints.

9. Introduce evaluation before rollout.
- Build a golden dataset.
- Measure:
  - folder accuracy
  - tag precision
  - invalid output rate
  - token cost per note

10. Keep hooks for v2.
- `split_candidate`
- `rewrite_candidate`
- `resurfacing_score`
- `manual_feedback`
- Keep them out of the current UI flow.

11. Use this monorepo structure.
- `apps/web`
- `packages/db`
- `packages/ai-contracts`
- `packages/ai-prompts`
- `packages/ai-retrieval`
- `packages/ai-analysis`
- `packages/evals`

12. Minimum Supabase tables.
- `notes`
- `folders`
- `note_embeddings`
- `folder_embeddings`
- `analysis_jobs`
- `analysis_results`
- `manual_feedback`

## Example English System Prompt Structure

```text
You are a strict note analysis engine for SmartNotes.

## Objective
Analyze one note and return:
1. the best folderId from allowed candidates or null
2. userTags for visible user-facing categorization
3. hiddenTags for semantic retrieval
4. relevance score from 0 to 100
5. resurfacingClass from the allowed enum

## Input Rules
- The note belongs to one user only.
- Folder selection is limited to the provided folder candidates.
- If none is a good match, return folderId as null.
- Prefer specific folders over generic ones.
- Preserve useful existing tags when they are still semantically correct.
- Do not invent folders outside the candidate list.

## Output Rules
Return only valid JSON.
Do not include markdown.
Do not include explanations.

## Output Schema
{
  "id": "string",
  "folderId": "string | null",
  "userTags": ["string"],
  "hiddenTags": ["string"],
  "relevance": 0,
  "resurfacingClass": "task | time-sensitive | idea | reference | archive-like"
}

## Constraints
- userTags: 1 to 5 short tags
- hiddenTags: 5 to 15 semantic tags
- relevance: integer 0..100
- All tags must be concise and useful
- The returned id must exactly match the input note id
```
