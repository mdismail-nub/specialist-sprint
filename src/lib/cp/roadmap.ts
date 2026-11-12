import type { Topic } from "./types";

export const PHASES = [
  { id: 1, name: "Foundation", start: 1, end: 14, target: "800–1000" },
  { id: 2, name: "Core Patterns", start: 15, end: 28, target: "1000–1200" },
  { id: 3, name: "Graphs & DP", start: 29, end: 42, target: "1200–1300" },
  { id: 4, name: "Specialist Training", start: 43, end: 60, target: "1300–1400+" },
] as const;

type Seed = [name: string, description: string, objectives: string[]];

const PHASE_TOPICS: Seed[][] = [
  [
    [
      "Implementation and simulation",
      "Translate statements into code exactly and carefully.",
      ["Read statements precisely", "Handle edge cases", "Simulate step by step"],
    ],
    [
      "Time and space complexity",
      "Estimate whether a solution fits limits before coding.",
      ["Big-O of loops", "~10^8 ops per second rule", "Pick algorithms by constraints"],
    ],
    [
      "Brute force",
      "Enumerate the search space when constraints allow.",
      ["Spot small constraints", "Nested enumeration", "Bitmask subsets"],
    ],
    [
      "Sorting and searching",
      "Use ordering to simplify problems.",
      ["Custom comparators", "lower_bound / upper_bound", "Sort + scan patterns"],
    ],
    [
      "Basic mathematics",
      "Parity, divisibility, modular arithmetic basics.",
      ["Modular arithmetic", "Parity arguments", "Integer overflow"],
    ],
    [
      "Greedy algorithms",
      "Make locally optimal choices with a proof idea.",
      ["Exchange argument", "Sort then pick", "Counterexample testing"],
    ],
    [
      "C++ STL",
      "Fluency with vector, set, map, priority_queue.",
      ["set/map operations", "priority_queue", "Fast I/O template"],
    ],
  ],
  [
    [
      "Prefix sums",
      "Answer range sum queries in O(1).",
      ["1D prefix sums", "2D prefix sums", "Prefix of counts"],
    ],
    [
      "Difference arrays",
      "Apply range updates efficiently.",
      ["Range add updates", "Reconstruct with prefix", "Sweep line intuition"],
    ],
    [
      "Two pointers",
      "Move two indices monotonically.",
      ["Sorted pair problems", "Merging technique", "Monotonic movement proof"],
    ],
    [
      "Sliding window",
      "Maintain a window satisfying a condition.",
      ["Fixed-size window", "Variable window", "Window with counts"],
    ],
    [
      "Frequency counting",
      "Count occurrences to reason about structure.",
      ["Count arrays", "map counting", "Pigeonhole ideas"],
    ],
    [
      "Hashing",
      "Use hash maps and sets for fast lookups.",
      ["unordered_map pitfalls", "Pair sums via hashing", "Anti-hash awareness"],
    ],
    [
      "Binary search on answer",
      "Search over a monotonic predicate.",
      ["Define check(x)", "Bounds and off-by-one", "Real-valued search"],
    ],
    [
      "Bit manipulation",
      "XOR, AND, OR tricks and bit counting.",
      ["XOR properties", "Per-bit reasoning", "__builtin functions"],
    ],
    [
      "Recursion",
      "Break problems into smaller subproblems.",
      ["Base cases", "Backtracking", "Divide and conquer"],
    ],
  ],
  [
    [
      "Graph representation",
      "Adjacency lists, edge lists, grids as graphs.",
      ["Adjacency list", "Grid neighbours", "Directed vs undirected"],
    ],
    [
      "BFS",
      "Shortest paths in unweighted graphs.",
      ["Queue-based BFS", "Multi-source BFS", "Grid BFS"],
    ],
    [
      "DFS",
      "Explore graphs depth-first.",
      ["Recursive & iterative DFS", "Tree traversal", "Cycle detection"],
    ],
    [
      "Connected components",
      "Group vertices into components.",
      ["Component counting", "DSU basics", "Component sizes"],
    ],
    [
      "Bipartite graphs",
      "Two-colouring and its applications.",
      ["BFS colouring", "Odd cycle detection", "Bipartite reductions"],
    ],
    [
      "Shortest paths",
      "Dijkstra and 0-1 BFS.",
      ["Dijkstra with PQ", "0-1 BFS", "Path reconstruction"],
    ],
    [
      "Dynamic programming",
      "Define states and transitions.",
      ["State design", "Base cases", "1D/2D DP"],
    ],
    [
      "Knapsack",
      "0/1 and unbounded knapsack.",
      ["0/1 knapsack", "Space optimisation", "Subset sum"],
    ],
    [
      "Coin change",
      "Counting ways and minimum coins.",
      ["Min coins DP", "Number of ways", "Order of loops"],
    ],
  ],
  [
    [
      "Constructive algorithms",
      "Build an answer satisfying constraints.",
      ["Small-case patterns", "Invariants", "Output any valid answer"],
    ],
    [
      "Advanced greedy",
      "Greedy with priority queues and proofs.",
      ["Greedy + PQ", "Regret greedy", "Proof by contradiction"],
    ],
    [
      "Binary search applications",
      "Combine binary search with other techniques.",
      ["BS + greedy check", "BS + prefix sums", "Parallel thinking"],
    ],
    [
      "Number theory",
      "Divisors, modular inverse, fast power.",
      ["Divisor enumeration", "Binary exponentiation", "Modular inverse"],
    ],
    [
      "GCD and LCM",
      "Euclid's algorithm and its properties.",
      ["gcd properties", "lcm overflow", "gcd over arrays"],
    ],
    [
      "Sieve",
      "Precompute primes and smallest prime factors.",
      ["Eratosthenes", "SPF sieve", "Counting primes"],
    ],
    [
      "Prime factorization",
      "Factorize quickly and use exponents.",
      ["Trial division", "Factorize with SPF", "Divisor counts"],
    ],
    [
      "Mixed graph and DP problems",
      "Combine techniques under contest pressure.",
      ["DP on trees", "DP on DAGs", "Identify the technique"],
    ],
    [
      "1300–1400 rated practice",
      "Timed sets at the target rating.",
      ["Virtual contests", "Upsolve every miss", "Track weak tags"],
    ],
  ],
];

const MINUTES = [180, 180, 180, 180];
export function buildRoadmap(): Topic[] {
  const topics: Topic[] = [];
  PHASES.forEach((phase, pi) => {
    const list = PHASE_TOPICS[pi] ?? [];
    const span = phase.end - phase.start + 1;
    list.forEach(([name, description, objectives], i) => {
      const startDay = phase.start + Math.floor((i * span) / list.length);
      const endDay = phase.start + Math.floor(((i + 1) * span) / list.length) - 1;
      const days = endDay - startDay + 1;
      topics.push({
        id: `t${pi + 1}-${i + 1}`,
        phase: phase.id,
        name,
        startDay,
        endDay,
        description,
        objectives,
        minutes: (MINUTES[pi] ?? 180) * days,
        targetProblems: 3 * days,
        status: "not_started",
        notes: "",
      });
    });
  });
  return topics;
}
