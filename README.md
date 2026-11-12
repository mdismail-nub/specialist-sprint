# Specialist Sprint

Build a Minimal Competitive Programming Progress Tracker

Build a polished, minimal, responsive web application called CP Tracker. It is a personal competitive programming training dashboard designed to help a student track a 60-day journey from beginner-level Codeforces problems to the Specialist rating range (1400+).

The application will initially be designed and generated in Lovable.dev. Later, the project will be transferred to Google AI Studio for further development and converted into a Progressive Web App (PWA). Therefore, keep the architecture clean, modular, maintainable, and easy to extend.

1. Product Philosophy

This is NOT a generic productivity dashboard.

The product should feel like a dedicated training companion for competitive programmers.

Core principles:

- Minimal and distraction-free.

- Clean typography and generous whitespace.

- Fast interactions.

- No unnecessary visualizations.

- No decorative elements.

- Focus on daily consistency and measurable progress.

- Desktop, tablet and mobile responsive.

- Mobile-first interaction design.

Design inspiration:

- Linear

- Raycast

- GitHub

- Modern minimalist productivity applications.

2. Visual Design System

Use a professional light theme as the default.

Colors:

- Background: #FFFFFF

- Primary text: #171717

- Secondary text: #737373

- Borders: #E5E5E5

- Primary accent: #2563EB

- Success: #16A34A

- Warning: #D97706

- Subtle surface: #F8FAFC

Typography:

- Inter or Geist.

- Clear hierarchy.

- Compact headings.

- Highly readable numbers.

UI rules:

- Thin borders instead of heavy shadows.

- Small border radius (8–12px).

- No gradients.

- No glassmorphism.

- No neon colors.

- No oversized cards.

- No charts that do not provide useful information.

- No illustrations, robots, trophies or mascots.

- Avoid unnecessary animations.

3. Application Layout

Create a simple application shell.

Desktop:

- A narrow left sidebar.

- Main content area.

- Compact top header.

Mobile:

- Compact top navigation.

- Bottom navigation with four items.

- No horizontal overflow.

- Touch-friendly controls.

Navigation:

1. Overview

2. Daily Log

3. Roadmap

4. Analytics

5. Settings

The active navigation item should be clearly identifiable.

4. Overview Dashboard

This is the main landing page after opening the app.

Header:

- Greeting: "Keep showing up."

- Subtitle: "Your journey to Codeforces Specialist."

- Current challenge day and date.

Display four compact statistics:

1. Current Codeforces Rating

   - Default: 632

   - Editable by user.

2. Target Rating

   - Default: 1400

3. Problems Solved

   - Calculated from daily logs.

4. Current Streak

   - Calculated automatically from completed training days.

Main progress section:

Title: "60-Day Specialist Challenge"

Show:

- Overall challenge progress percentage.

- Completed days / 60.

- Current phase.

- Remaining days.

- A clean horizontal progress bar.

Use four training phases:

Phase 1: Foundation — Days 1–14

Phase 2: Core Patterns — Days 15–28

Phase 3: Graphs & DP — Days 29–42

Phase 4: Specialist Training — Days 43–60

Today section:

Display:

- Today's date.

- Current roadmap day.

- Today's topic.

- Today's learning objectives.

- Today's problem target.

- Completed problems.

- A button to open the daily log.

Upcoming section:

- Next training topic.

- Next milestone.

- Remaining days until the milestone.

Keep this page compact. Prioritize information instead of filling the screen with cards.

5. Daily Training Log

This is the most important feature.

Allow the user to record daily competitive programming activities.

Each daily entry should contain:

- Date.

- Roadmap day.

- Topic studied.

- Time spent (minutes).

- Number of problems attempted.

- Number of problems solved independently.

- Number of problems solved with hints/editorial.

- Number of problems upsolved.

- Highest problem rating solved.

- Codeforces contest participated in (optional).

- Notes.

- Mistakes and lessons learned.

Training checklist:

- Studied today's topic.

- Solved new problems.

- Upsolved difficult problems.

- Reviewed previous mistakes.

- Updated learning notes.

Features:

- Create daily log.

- Edit existing log.

- Delete log with confirmation.

- View previous logs.

- Prevent accidental duplicate entries for the same date.

- Show daily completion status.

Allow multiple problems to be recorded individually with:

- Problem name.

- Codeforces problem URL.

- Rating.

- Topic/tag.

- Solving status: Independent / Hint / Editorial.

- Time taken.

Make the daily logging process extremely quick and convenient on mobile.

6. Roadmap Page

Create a structured 60-day learning roadmap.

Four phases:

PHASE 1 — FOUNDATION

Days 1–14

Target rating: 800–1000

Topics:

- Implementation and simulation

- Time and space complexity

- Brute force

- Sorting and searching

- Basic mathematics

- Greedy algorithms

- C++ STL

PHASE 2 — CORE PATTERNS

Days 15–28

Target rating: 1000–1200

Topics:

- Prefix sums

- Difference arrays

- Two pointers

- Sliding window

- Frequency counting

- Hashing

- Binary search on answer

- Bit manipulation

- Recursion

PHASE 3 — GRAPHS & DP

Days 29–42

Target rating: 1200–1300

Topics:

- Graph representation

- BFS

- DFS

- Connected components

- Bipartite graphs

- Shortest paths

- Dynamic programming

- Knapsack

- Coin change

PHASE 4 — SPECIALIST TRAINING

Days 43–60

Target rating: 1300–1400+

Topics:

- Constructive algorithms

- Advanced greedy

- Binary search applications

- Number theory

- GCD and LCM

- Sieve

- Prime factorization

- Mixed graph and DP problems

- 1300–1400 rated practice

Each roadmap topic should have:

- Topic name.

- Planned date/day.

- Description.

- Learning objectives.

- Estimated study time.

- Target problem count.

- Actual problems solved.

- Status: Not started / In progress / Completed.

- Personal notes.

Allow users to mark topics complete, edit topics and adjust the roadmap.

Show the roadmap as a clean vertical timeline or compact list, not a complicated flowchart.

7. Problem Tracker

Create a dedicated problem management section.

Allow adding Codeforces problems with:

- Problem title.

- Problem URL.

- Rating.

- Topic.

- Date attempted.

- Status:

  - Solved independently

  - Solved with hint

  - Solved after editorial

  - Unsolved

  - Re-solved

Filters:

- By rating.

- By topic.

- By status.

- By date.

Statistics:

- Total problems solved.

- Independent solves.

- Editorial-assisted solves.

- Problems by rating.

- Problems by topic.

Use a clean table on desktop and compact list layout on mobile.

Make Codeforces URLs clickable.

8. Contest Tracker

Create a simple contest history section.

Fields:

- Contest name.

- Contest date.

- Platform.

- Starting rating.

- New rating.

- Rating change.

- Problems solved.

- Rank (optional).

- Performance notes.

Display rating progression over time with a simple line chart only if sufficient rating history exists.

Allow manual entry of contest results.

9. Analytics Page

Provide useful insights without unnecessary dashboard clutter.

Show:

- Total practice days.

- Total practice hours.

- Total problems solved.

- Independent solve percentage.

- Current streak.

- Longest streak.

- Average problems per day.

- Weekly practice consistency.

Include:

1. GitHub-style activity heatmap for 60 days.

2. Problems solved by rating range.

3. Topic-wise practice distribution.

4. Weekly training summary.

Every statistic must be calculated from actual saved data, not hardcoded numbers.

10. Settings

Allow the user to configure:

- Name.

- Starting Codeforces rating (default 632).

- Target rating (default 1400).

- Challenge start date (default November 12, 2026).

- Challenge duration (default 60 days).

- Daily study target (default 180 minutes).

- Daily problem target (default 3).

- Theme: Light / Dark / System.

Add data management:

- Export all data as JSON.

- Import previously exported JSON.

- Reset challenge with confirmation.

11. Data Architecture

Use React, TypeScript and Tailwind CSS.

Use reusable components and a clear separation of UI, business logic and data management.

Initially, create a functional frontend with realistic seed data.

However:

- Do not rely on hardcoded statistics.

- All dashboard statistics should be derived from stored data.

- Keep all data models clean and consistent.

- Use a centralized data layer.

- Avoid unnecessary external dependencies.

Make the application easy to connect to Supabase later, but do not require Supabase for the initial prototype.

Use local persistence so that user-entered data survives refreshes.

Important: The application will later become a PWA through Google AI Studio. Do not add PWA installation functionality yet. Keep the application architecture compatible with future PWA implementation.

12. Important User Experience Details

- Every button must work.

- Every form must validate input.

- Show useful empty states.

- Show confirmation before destructive actions.

- Add success and error feedback.

- Preserve data after page refresh.

- Use realistic seed data only for the initial preview.

- Make it easy to clear sample data and start the real challenge.

- No fake progress updates.

- No non-functional navigation.

- Do not build unnecessary authentication for this personal-first version.

13. Final Quality Requirements

Build the complete functional application, not just a landing page or static dashboard.

Prioritize:

1. Daily logging.

2. Problem tracking.

3. Roadmap management.

4. Accurate progress calculation.

5. Analytics.

6. Mobile responsiveness.

The final product should feel like a lightweight personal training system that a competitive programmer would genuinely use every day for 60 days.

The interface must be clean, professional, minimal and highly usable.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/67dd4055-c4af-43e9-9b88-62b7df99489b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
