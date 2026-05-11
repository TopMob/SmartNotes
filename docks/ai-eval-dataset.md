# SmartNotes AI Eval Dataset

Evaluation dataset scaffold for `folder-classification-v1`.

## Goals

- Measure folder accuracy
- Measure visible tag quality
- Measure hidden tag usefulness
- Track invalid output rate
- Track token cost drift per note

## Fixture Version

- `analyze-eval-v1`

## Suggested Record Shape

```json
{
  "id": "fixture-001",
  "note": {
    "title": "...",
    "cleanText": "..."
  },
  "folders": [
    { "id": "folder-1", "name": "Work", "description": "Project tasks" }
  ],
  "expected": {
    "folderId": "folder-1",
    "userTags": ["work", "planning"]
  }
}
```

## First Batch

- Collect 25 real anonymized notes
- Expand to 100 before changing production defaults
- Re-run after each prompt or contract version bump
