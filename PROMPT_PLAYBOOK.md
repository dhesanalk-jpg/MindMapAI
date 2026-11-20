# MindMap AI — Prompt-to-Product Playbook

Use this as the structured prompt history / build strategy for a prompt engineering competition. It is a proposed prompt playbook, not a verbatim transcript of development.

## 1. ROLE PROMPT

Act as a senior full-stack engineer, product architect, UX researcher, learning-science product designer and hackathon mentor. Build a reliable, accessible, responsive and deployable web application called MindMap AI. Think like a product team: define the user problem, design the system, implement it, test it and document deployment. Avoid superficial AI claims.

## 2. CONTEXT PROMPT

The problem statement is: students upload a syllabus and receive an intelligent study plan. The product must extract topics from documents, generate daily schedules, identify difficult topics, track completed chapters and generate practice questions. The target users are university and school students with limited time, changing schedules and different levels of confidence.

The product must help students answer:
- What should I study next?
- Why is this topic important?
- How much time should I allocate?
- What happens if I fall behind?
- How do I know whether I actually understand it?

## 3. PRODUCT DIFFERENTIATION PROMPT

Design distinctive features beyond a conventional calendar:
- Knowledge Constellation: topic graph with mastery and prerequisite relationships.
- Plan Rescue Engine: redistribute missed sessions while protecting revision buffers.
- Confidence Reality Check: compare self-reported confidence with practice outcomes.
- Exam Time Machine: compare alternative time-allocation scenarios.
- Forgetting Radar: surface topics for review based on elapsed time and learning evidence.
- Syllabus Traceability: connect extracted topics and questions to source pages/sections.

Do not claim these are globally unique. Research competitors and explain the product's differentiated combination honestly.

## 4. UX / UI PROMPT

Create a polished learning dashboard with a premium editorial visual system:
- Dark indigo sidebar, warm near-white canvas, violet accent, restrained gradients.
- Manrope display typography and DM Sans body typography.
- Clear hierarchy, generous whitespace, calm cards, meaningful micro-interactions.
- Responsive desktop, tablet and mobile layouts.
- Dashboard overview, topic graph, study planner, practice lab and progress analytics.
- Make empty, loading, error and success states visible.
- Use accessible contrast, semantic controls, keyboard focus and descriptive labels.
- Avoid clutter, excessive neon, fake charts and decorative metrics without meaning.

## 5. ARCHITECTURE / CONSTRAINT PROMPT

Use React + TypeScript + Vite for the frontend and Python + FastAPI for the backend. Keep frontend and backend code in separate directories. Provide REST endpoints for health, syllabus analysis, study-plan generation, practice questions and plan rescue.

Constraints:
- Must be compatible with GitHub and Vercel deployment.
- Keep AI API keys server-side only.
- Provide deterministic fallback behaviour when no AI key is configured.
- Do not depend on a local filesystem for durable production storage.
- Make limitations explicit: heuristic extraction, OCR absence, local-only progress and no authentication in MVP.
- Keep code modular, readable and beginner-friendly.

## 6. ITERATIVE IMPLEMENTATION PROMPT

Build in vertical slices:
1. Scaffold project and confirm frontend build.
2. Implement responsive shell and navigation.
3. Add topic data model and browser persistence.
4. Implement syllabus upload and backend text extraction.
5. Add topic review and Knowledge Constellation.
6. Implement plan generation and session completion.
7. Add question generation and confidence tracking.
8. Add plan rescue and progress insights.
9. Add error, loading and empty states.
10. Write setup, environment and deployment instructions.

After each slice, run the frontend production build and backend endpoint checks. Do not silently skip failing checks.

## 7. DEBUGGING PROMPT

When an error occurs:
- Read the exact terminal output and identify the first real error, not downstream symptoms.
- Confirm the current working directory before running commands.
- Check package versions, imports, environment variables and API base URL.
- Reproduce the issue with the smallest test.
- Fix the root cause, not just suppress the error.
- Run `npm run build`, backend import/startup checks and API smoke tests again.
- Report changed files and exact commands.
- Never claim a test passed unless it was actually run.

## 8. FINAL REVIEW PROMPT

Act as a strict hackathon judge. Review product value, technical correctness, novelty claims, UI accessibility, mobile responsiveness, deployment readiness, data privacy and demo reliability. Identify weak points and prioritise fixes. Explain what is genuinely implemented versus simulated or proposed for future development.
