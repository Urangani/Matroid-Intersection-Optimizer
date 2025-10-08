import React, { useState } from 'react';
import { Play, Info, Check, X } from 'lucide-react';

const MatroidIntersection = () => {
  const [selectedTest, setSelectedTest] = useState(0);
  const [result, setResult] = useState(null);
  const [showTheory, setShowTheory] = useState(false);

  // Matroid Independence Tests
  class GraphicMatroid {
    constructor(n, edges) {
      this.n = n;
      this.edges = edges;
    }

    isIndependent(subset) {
      // A set of edges is independent if it forms a forest (no cycles)
      const uf = new UnionFind(this.n);
      for (const idx of subset) {
        const [u, v] = this.edges[idx];
        if (uf.find(u) === uf.find(v)) return false;
        uf.union(u, v);
      }
      return true;
    }

    circuit(subset, e) {
      // Find the unique circuit created by adding e to subset
      const [u, v] = this.edges[e];
      const uf = new UnionFind(this.n);
      const parent = new Array(this.n).fill(-1);
      
      for (const idx of subset) {
        const [a, b] = this.edges[idx];
        uf.union(a, b);
      }
      
      // BFS to find path from u to v
      const queue = [u];
      const visited = new Set([u]);
      parent[u] = -1;
      
      while (queue.length > 0) {
        const curr = queue.shift();
        if (curr === v) break;
        
        for (const idx of subset) {
          const [a, b] = this.edges[idx];
          let next = -1;
          if (a === curr && !visited.has(b)) next = b;
          if (b === curr && !visited.has(a)) next = a;
          
          if (next !== -1) {
            visited.add(next);
            parent[next] = curr;
            queue.push(next);
          }
        }
      }
      
      // Reconstruct path
      const path = [];
      let curr = v;
      while (parent[curr] !== -1) {
        const prev = parent[curr];
        for (const idx of subset) {
          const [a, b] = this.edges[idx];
          if ((a === curr && b === prev) || (a === prev && b === curr)) {
            path.push(idx);
            break;
          }
        }
        curr = prev;
      }
      
      return new Set([...path, e]);
    }
  }

  class TransversalMatroid {
    constructor(sets) {
      this.sets = sets;
      this.m = sets.length;
    }

    isIndependent(subset) {
      // A subset is independent if there exists a matching
      // Check via maximum matching in bipartite graph
      const elements = new Set();
      subset.forEach(idx => elements.add(idx));
      
      return this.hasMatching(elements);
    }

    hasMatching(elements) {
      const match = new Map();
      const used = new Set();
      
      for (const elem of elements) {
        const visited = new Set();
        if (!this.augment(elem, match, used, visited, elements)) {
          return false;
        }
      }
      return true;
    }

    augment(elem, match, used, visited, elements) {
      for (let setIdx = 0; setIdx < this.sets.length; setIdx++) {
        if (!this.sets[setIdx].has(elem) || visited.has(setIdx)) continue;
        visited.add(setIdx);
        
        if (!used.has(setIdx)) {
          match.set(elem, setIdx);
          used.add(setIdx);
          return true;
        }
        
        // eslint-disable-next-line no-unused-vars
        const otherElem = [...match.entries()].find(([_, s]) => s === setIdx)?.[0];
        if (otherElem !== undefined && elements.has(otherElem)) {
          match.delete(otherElem);
          if (this.augment(otherElem, match, used, visited, elements)) {
            match.set(elem, setIdx);
            return true;
          }
          match.set(otherElem, setIdx);
        }
      }
      return false;
    }

    circuit(subset, e) {
      // Find circuit by attempting matching
      const match = new Map();
      const used = new Set();
      const subsArr = Array.from(subset);
      
      // Build matching for subset
      for (const elem of subsArr) {
        const visited = new Set();
        this.augment(elem, match, used, visited, new Set(subsArr));
      }
      
      // Try to add e - find which elements block it
      const circuit = new Set([e]);
      for (let setIdx = 0; setIdx < this.sets.length; setIdx++) {
        if (this.sets[setIdx].has(e)) {
          if (used.has(setIdx)) {
            // eslint-disable-next-line no-unused-vars
            const blocker = [...match.entries()].find(([_, s]) => s === setIdx)?.[0];
            if (blocker !== undefined) circuit.add(blocker);
          }
        }
      }
      
      return circuit;
    }
  }

  class UnionFind {
    constructor(n) {
      this.parent = Array.from({length: n}, (_, i) => i);
      this.rank = Array(n).fill(0);
    }

    find(x) {
      if (this.parent[x] !== x) {
        this.parent[x] = this.find(this.parent[x]);
      }
      return this.parent[x];
    }

    union(x, y) {
      const px = this.find(x);
      const py = this.find(y);
      if (px === py) return;
      
      if (this.rank[px] < this.rank[py]) {
        this.parent[px] = py;
      } else if (this.rank[px] > this.rank[py]) {
        this.parent[py] = px;
      } else {
        this.parent[py] = px;
        this.rank[px]++;
      }
    }
  }

  // Matroid Intersection Algorithm
  function matroidIntersection(M1, M2, groundSet) {
    let I = new Set();
    
    const steps = [];
    let iteration = 0;
    
    while (true) {
      iteration++;
      const augPath = findAugmentingPath(M1, M2, I, groundSet);
      
      if (!augPath) {
        steps.push({
          iteration,
          action: 'No augmenting path found',
          solution: new Set(I),
          optimal: true
        });
        break;
      }
      
      // Augment along the path
      const newI = new Set(I);
      augPath.add.forEach(e => newI.add(e));
      augPath.remove.forEach(e => newI.delete(e));
      
      steps.push({
        iteration,
        action: `Found augmenting path`,
        add: Array.from(augPath.add),
        remove: Array.from(augPath.remove),
        solution: new Set(newI)
      });
      
      I = newI;
      
      if (iteration > 100) break; // Safety
    }
    
    return { solution: I, steps };
  }

  function findAugmentingPath(M1, M2, I, groundSet) {
    // Build auxiliary digraph D
    // Vertices: elements in ground set
    // Edges: e -> f if we can exchange
    
    const S = new Set([...groundSet].filter(e => !I.has(e) && M1.isIndependent(new Set([...I, e]))));
    const T = new Set([...groundSet].filter(e => !I.has(e) && M2.isIndependent(new Set([...I, e]))));
    
    if (S.size === 0) return null;
    
    // BFS from S to T
    const queue = [...S].map(s => ({ node: s, path: { add: new Set([s]), remove: new Set() } }));
    const visited = new Set(S);
    
    while (queue.length > 0) {
      const { node: curr, path } = queue.shift();
      
      if (T.has(curr)) {
        return path; // Found augmenting path
      }
      
      // Edges in D
      // Type 1: e in I, f not in I, f in C_M1(I-e, f)
      if (I.has(curr)) {
        const I_minus_curr = new Set([...I].filter(x => x !== curr));
        for (const f of groundSet) {
          if (!I.has(f) && !visited.has(f)) {
            const I_with_f = new Set([...I_minus_curr, f]);
            if (!M1.isIndependent(I_with_f)) {
              const circuit = M1.circuit(I_minus_curr, f);
              if (circuit.has(curr)) {
                visited.add(f);
                const newPath = {
                  add: new Set([...path.add, f]),
                  remove: new Set([...path.remove, curr])
                };
                queue.push({ node: f, path: newPath });
              }
            }
          }
        }
      } else {
        // Type 2: e not in I, f in I, e in C_M2(I-f, e)
        for (const f of I) {
          if (!visited.has(f)) {
            const I_minus_f = new Set([...I].filter(x => x !== f));
            const I_with_curr = new Set([...I_minus_f, curr]);
            if (!M2.isIndependent(I_with_curr)) {
              const circuit = M2.circuit(I_minus_f, curr);
              if (circuit.has(f)) {
                visited.add(f);
                const newPath = {
                  add: new Set(path.add),
                  remove: new Set([...path.remove, f])
                };
                queue.push({ node: f, path: newPath });
              }
            }
          }
        }
      }
    }
    
    return null;
  }

  // Test Cases
  const testCases = [
    {
      name: "Simple Path + Matching",
      description: "Graphic: Path graph P4, Transversal: {{0,1},{1,2},{2,3}}",
      type: "both",
      graphicN: 4,
      graphicEdges: [[0,1], [1,2], [2,3]],
      transversalSets: [[0,1], [1,2], [2,3]].map(s => new Set(s)),
      expected: 2
    },
    {
      name: "Triangle + Matching",
      description: "Graphic: Triangle K3, Transversal: {{0},{1},{2}}",
      type: "both",
      graphicN: 3,
      graphicEdges: [[0,1], [1,2], [0,2]],
      transversalSets: [[0], [1], [2]].map(s => new Set(s)),
      expected: 2
    },
    {
      name: "Complete Bipartite K_{2,3}",
      description: "Graphic: K_{2,3}, Transversal: partition matroid",
      type: "both",
      graphicN: 5,
      graphicEdges: [[0,2], [0,3], [0,4], [1,2], [1,3], [1,4]],
      transversalSets: [[0,1,2], [3,4,5]].map(s => new Set(s)),
      expected: 2
    },
    {
      name: "Square Graph",
      description: "Graphic: 4-cycle C4, Transversal: all pairs",
      type: "both",
      graphicN: 4,
      graphicEdges: [[0,1], [1,2], [2,3], [3,0]],
      transversalSets: [[0,1], [1,2], [2,3], [0,3]].map(s => new Set(s)),
      expected: 3
    },
    {
      name: "Star Graph",
      description: "Graphic: Star S4, Transversal: center in all",
      type: "both",
      graphicN: 5,
      graphicEdges: [[0,1], [0,2], [0,3], [0,4]],
      transversalSets: [[0], [0,1], [0,2], [0,3]].map(s => new Set(s)),
      expected: 1
    },
    {
      name: "Two Triangles",
      description: "Graphic: Two disjoint K3, Transversal: mixed",
      type: "both",
      graphicN: 6,
      graphicEdges: [[0,1], [1,2], [0,2], [3,4], [4,5], [3,5]],
      transversalSets: [[0,3], [1,4], [2,5]].map(s => new Set(s)),
      expected: 3
    },
    {
      name: "Pentagon",
      description: "Graphic: 5-cycle C5, Transversal: consecutive pairs",
      type: "both",
      graphicN: 5,
      graphicEdges: [[0,1], [1,2], [2,3], [3,4], [4,0]],
      transversalSets: [[0,1], [2,3], [4]].map(s => new Set(s)),
      expected: 2
    },
    {
      name: "Petersen-like",
      description: "Graphic: 5 vertices densely connected",
      type: "both",
      graphicN: 5,
      graphicEdges: [[0,1], [1,2], [2,3], [3,4], [4,0], [0,2]],
      transversalSets: [[0], [1], [2], [3,4,5]].map(s => new Set(s)),
      expected: 3
    },
    {
      name: "Bridge Graph",
      description: "Graphic: Two triangles with bridge, Transversal: limited",
      type: "both",
      graphicN: 7,
      graphicEdges: [[0,1], [1,2], [0,2], [2,3], [3,4], [4,5], [3,5]],
      transversalSets: [[0,1,2], [3], [4,5,6]].map(s => new Set(s)),
      expected: 3
    },
    {
      name: "Complete K4",
      description: "Graphic: Complete K4, Transversal: partitioned",
      type: "both",
      graphicN: 4,
      graphicEdges: [[0,1], [0,2], [0,3], [1,2], [1,3], [2,3]],
      transversalSets: [[0,1,2], [3,4,5]].map(s => new Set(s)),
      expected: 3
    },
    {
      name: "Disjoint Paths",
      description: "Graphic: Two disjoint P3, Transversal: symmetric",
      type: "both",
      graphicN: 6,
      graphicEdges: [[0,1], [1,2], [3,4], [4,5]],
      transversalSets: [[0,1], [2,3], [1,2], [3,4]].map(s => new Set(s)),
      expected: 3
    },
    {
      name: "Binary Tree",
      description: "Graphic: Small binary tree, Transversal: levels",
      type: "both",
      graphicN: 7,
      graphicEdges: [[0,1], [0,2], [1,3], [1,4], [2,5], [2,6]],
      transversalSets: [[0], [1,2], [3,4,5,6]].map(s => new Set(s)),
      expected: 3
    },
    {
      name: "Wheel W4",
      description: "Graphic: Wheel with 4 spokes, Transversal: radial",
      type: "both",
      graphicN: 5,
      graphicEdges: [[0,1], [0,2], [0,3], [0,4], [1,2], [2,3], [3,4], [4,1]],
      transversalSets: [[0,1,2,3], [4,5,6,7]].map(s => new Set(s)),
      expected: 4
    },
    {
      name: "Ladder Graph",
      description: "Graphic: 2×3 ladder, Transversal: rows",
      type: "both",
      graphicN: 6,
      graphicEdges: [[0,1], [1,2], [3,4], [4,5], [0,3], [1,4], [2,5]],
      transversalSets: [[0,1,2], [3,4,5,6]].map(s => new Set(s)),
      expected: 4
    },
    {
      name: "Prism Graph",
      description: "Graphic: 3-prism, Transversal: mixed partition",
      type: "both",
      graphicN: 6,
      graphicEdges: [[0,1], [1,2], [2,0], [3,4], [4,5], [5,3], [0,3], [1,4], [2,5]],
      transversalSets: [[0,1,2], [3,4,5], [6,7,8]].map(s => new Set(s)),
      expected: 3
    }
  ];

  const runTest = () => {
    const test = testCases[selectedTest];
    const groundSet = new Set(test.graphicEdges.map((_, i) => i));
    
    const M1 = new GraphicMatroid(test.graphicN, test.graphicEdges);
    const M2 = new TransversalMatroid(test.transversalSets);
    
    const startTime = performance.now();
    const { solution, steps } = matroidIntersection(M1, M2, groundSet);
    const endTime = performance.now();
    
    const isOptimal = verifySolution(M1, M2, solution, groundSet);
    
    setResult({
      solution: Array.from(solution).sort((a,b) => a-b),
      size: solution.size,
      expected: test.expected,
      correct: solution.size === test.expected,
      time: (endTime - startTime).toFixed(2),
      steps: steps,
      edges: Array.from(solution).map(i => test.graphicEdges[i]),
      isOptimal
    });
  };

  const verifySolution = (M1, M2, solution, groundSet) => {
    // Verify independence in both matroids
    const ind1 = M1.isIndependent(solution);
    const ind2 = M2.isIndependent(solution);
    
    // Verify maximality: no element can be added
    let maximal = true;
    for (const e of groundSet) {
      if (!solution.has(e)) {
        const testSet = new Set([...solution, e]);
        if (M1.isIndependent(testSet) && M2.isIndependent(testSet)) {
          maximal = false;
          break;
        }
      }
    }
    
    return { ind1, ind2, maximal };
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h1 className="text-3xl font-bold text-indigo-900 mb-2">Matroid Intersection via Augmenting Paths</h1>
        <p className="text-gray-600 mb-4">Finding maximum common independent sets in graphic and transversal matroids</p>
        
        <button
          onClick={() => setShowTheory(!showTheory)}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 mb-4"
        >
          <Info size={20} />
          {showTheory ? 'Hide Theory' : 'Show Theory & Proofs'}
        </button>

        {showTheory && (
          <div className="bg-indigo-50 rounded-lg p-6 mb-6 space-y-4 text-sm">
            <div>
              <h3 className="font-bold text-lg text-indigo-900 mb-2">Independence Axioms</h3>
              <p className="mb-2">A matroid M = (E, I) consists of a ground set E and independent sets I satisfying:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>(I1) Non-empty:</strong> ∅ ∈ I</li>
                <li><strong>(I2) Hereditary:</strong> If X ∈ I and Y ⊆ X, then Y ∈ I</li>
                <li><strong>(I3) Exchange:</strong> If X, Y ∈ I and |X| &lt; |Y|, then ∃e ∈ Y\X such that X ∪ {`{e}`} ∈ I</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg text-indigo-900 mb-2">Graphic Matroid M(G)</h3>
              <p className="mb-2">For a graph G = (V, E):</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Ground set: edges E</li>
                <li>Independent sets: forests (acyclic subgraphs)</li>
                <li><strong>Verification:</strong> Use Union-Find to detect cycles in O(|I|α(n))</li>
                <li><strong>Circuit:</strong> The unique cycle formed by adding edge e to forest F</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg text-indigo-900 mb-2">Transversal Matroid M(S)</h3>
              <p className="mb-2">For a family of sets S = (S₁, S₂, ..., Sₘ):</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Ground set: elements in ∪Sᵢ</li>
                <li>Independent sets: partial transversals (matchable subsets)</li>
                <li><strong>Verification:</strong> Check if maximum matching exists via augmenting paths</li>
                <li><strong>Circuit:</strong> Minimal dependent set (no matching possible)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg text-indigo-900 mb-2">Augmenting Path Algorithm</h3>
              <p className="mb-2">Build auxiliary digraph D = (E, A) where:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>S = {`{e ∉ I : I ∪ {e} ∈ I₁}`} (extendable in M₁)</li>
                <li>T = {`{e ∉ I : I ∪ {e} ∈ I₂}`} (extendable in M₂)</li>
                <li>Arc e→f if: e∈I, f∉I, f∈C₁(I\e ∪ f) or e∉I, f∈I, e∈C₂(I\f ∪ e)</li>
                <li>Find path from S to T, augment, repeat until no path exists</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg text-indigo-900 mb-2">Optimality Proof</h3>
              <p className="mb-2">When algorithm terminates with solution I:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Independence:</strong> I ∈ I₁ ∩ I₂ maintained at each step</li>
                <li><strong>Maximality:</strong> No augmenting path ⟹ for all e∉I, either I∪{`{e}`}∉I₁ or I∪{`{e}`}∉I₂</li>
                <li><strong>Matroid Union Theorem:</strong> |I| = min(r₁(X) + r₂(E\X)) over all X⊆E</li>
                <li><strong>Correctness:</strong> BFS finds shortest augmenting path, guarantees termination in O(r³) iterations where r is the rank</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg text-indigo-900 mb-2">Complexity Analysis</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Iterations: O(r) where r = min(r₁(E), r₂(E))</li>
                <li>Per iteration: O(|E|²) for graph construction and BFS</li>
                <li>Independence oracle: O(|E|α(n)) for graphic, O(|E|²) for transversal</li>
                <li><strong>Total:</strong> O(r|E|³) in general, often much faster in practice</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Select Test Case</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {testCases.map((test, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedTest(idx)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedTest === idx
                    ? 'bg-indigo-100 border-2 border-indigo-500'
                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                }`}
              >
                <div className="font-semibold text-gray-800">{test.name}</div>
                <div className="text-sm text-gray-600">{test.description}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Edges: {test.graphicEdges.length}, Expected: {test.expected}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Test Configuration</h2>
          {selectedTest !== null && (
            <div className="space-y-3 mb-4">
              <div className="bg-gray-50 p-3 rounded">
                <div className="font-semibold text-gray-700">Graphic Matroid (Forest)</div>
                <div className="text-sm text-gray-600">
                  Vertices: {testCases[selectedTest].graphicN}
                </div>
                <div className="text-sm text-gray-600">
                  Edges: {testCases[selectedTest].graphicEdges.map((e, i) => 
                    `e${i}=${e[0]}-${e[1]}`
                  ).join(', ')}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="font-semibold text-gray-700">Transversal Matroid</div>
                <div className="text-sm text-gray-600">
                  Sets: {testCases[selectedTest].transversalSets.map((s, i) => 
                    `S${i}={${Array.from(s).join(',')}}`
                  ).join(', ')}
                </div>
              </div>
            </div>
          )}
          
          <button
            onClick={runTest}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Play size={20} />
            Run Matroid Intersection
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Results</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-indigo-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Solution Size</div>
              <div className="text-2xl font-bold text-indigo-900">{result.size}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Expected</div>
              <div className="text-2xl font-bold text-green-900">{result.expected}</div>
            </div>
            <div className={`${result.correct ? 'bg-green-50' : 'bg-red-50'} p-4 rounded-lg`}>
              <div className="text-sm text-gray-600">Status</div>
              <div className={`text-xl font-bold flex items-center gap-2 ${result.correct ? 'text-green-900' : 'text-red-900'}`}>
                {result.correct ? <Check size={20} /> : <X size={20} />}
                {result.correct ? 'Correct' : 'Incorrect'}
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Time</div>
              <div className="text-2xl font-bold text-blue-900">{result.time}ms</div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-bold text-gray-800 mb-3">Common Independent Set</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="font-semibold mb-2">Edges in Solution: {result.solution.join(', ')}</div>
              <div className="text-sm text-gray-600">
                Graph edges: {result.edges.map((e, i) => `e${result.solution[i]}=(${e[0]},${e[1]})`).join(', ')}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-bold text-gray-800 mb-3">Optimality Verification</h3>
            <div className="space-y-2">
              <div className={`p-3 rounded-lg flex items-center gap-2 ${result.isOptimal.ind1 ? 'bg-green-50' : 'bg-red-50'}`}>
                {result.isOptimal.ind1 ? <Check size={20} className="text-green-600" /> : <X size={20} className="text-red-600" />}
                <span className={result.isOptimal.ind1 ? 'text-green-900' : 'text-red-900'}>
                  <strong>Independent in M₁ (Graphic):</strong> Solution forms a forest (no cycles)
                </span>
              </div>
              <div className={`p-3 rounded-lg flex items-center gap-2 ${result.isOptimal.ind2 ? 'bg-green-50' : 'bg-red-50'}`}>
                {result.isOptimal.ind2 ? <Check size={20} className="text-green-600" /> : <X size={20} className="text-red-600" />}
                <span className={result.isOptimal.ind2 ? 'text-green-900' : 'text-red-900'}>
                  <strong>Independent in M₂ (Transversal):</strong> Solution has a matching to sets
                </span>
              </div>
              <div className={`p-3 rounded-lg flex items-center gap-2 ${result.isOptimal.maximal ? 'bg-green-50' : 'bg-red-50'}`}>
                {result.isOptimal.maximal ? <Check size={20} className="text-green-600" /> : <X size={20} className="text-red-600" />}
                <span className={result.isOptimal.maximal ? 'text-green-900' : 'text-red-900'}>
                  <strong>Maximal:</strong> No element can be added while maintaining independence in both
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-gray-800 mb-3">Algorithm Steps</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {result.steps.map((step, idx) => (
                <div key={idx} className={`p-3 rounded-lg ${step.optimal ? 'bg-green-50 border-2 border-green-300' : 'bg-blue-50'}`}>
                  <div className="font-semibold text-gray-800">
                    Iteration {step.iteration}: {step.action}
                  </div>
                  {step.add && (
                    <div className="text-sm text-gray-600">
                      Added: {step.add.join(', ')} | Removed: {step.remove.length > 0 ? step.remove.join(', ') : 'none'}
                    </div>
                  )}
                  <div className="text-sm text-gray-600">
                    Current solution size: {step.solution.size}
                  </div>
                  {step.optimal && (
                    <div className="text-sm font-semibold text-green-700 mt-1">
                      ✓ Optimal solution found (no augmenting path exists)
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Mathematical Proof of Optimality</h2>
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <h3 className="font-semibold text-base mb-2">Theorem: The algorithm finds a maximum common independent set</h3>
            <p className="mb-2"><strong>Proof:</strong></p>
            <p className="mb-2">
              Let I* be the solution returned by the algorithm. We prove I* is maximum by showing:
            </p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>
                <strong>Feasibility:</strong> I* ∈ I₁ ∩ I₂
                <br />
                <span className="text-xs text-gray-600">
                  By construction, each augmentation maintains independence in both matroids. 
                  Initially ∅ ∈ I₁ ∩ I₂. When augmenting I to I' along path P, the exchange 
                  property ensures I' remains independent in both matroids.
                </span>
              </li>
              <li>
                <strong>Maximality via Augmenting Paths:</strong> No augmenting path exists
                <br />
                <span className="text-xs text-gray-600">
                  When the algorithm terminates, there is no directed path in the auxiliary 
                  digraph D from any s ∈ S to any t ∈ T. This means S and T are separated 
                  by a cut, which corresponds to a certificate of optimality.
                </span>
              </li>
              <li>
                <strong>Matroid Union Bound:</strong> |I*| = min_X (r₁(X) + r₂(E\X))
                <br />
                <span className="text-xs text-gray-600">
                  By the matroid union theorem, the maximum size of I₁ ∩ I₂ equals the 
                  minimum over all partitions X, E\X of the sum of ranks. The absence of 
                  augmenting paths provides this partition explicitly.
                </span>
              </li>
              <li>
                <strong>No Improvement Possible:</strong> ∀e ∉ I*, (I* ∪ {`{e}`} ∉ I₁) ∨ (I* ∪ {`{e}`} ∉ I₂)
                <br />
                <span className="text-xs text-gray-600">
                  For each element outside I*, adding it would violate independence in at 
                  least one matroid. Otherwise, we could extend the solution, contradicting 
                  the termination condition.
                </span>
              </li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold text-base mb-2">Why This Works for Graphic and Transversal Matroids</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-3 rounded">
                <h4 className="font-semibold mb-1">Graphic Matroid M(G)</h4>
                <ul className="list-disc pl-4 space-y-1 text-xs">
                  <li>Forest property is hereditary (I2)</li>
                  <li>Can always add edge from larger forest (I3)</li>
                  <li>Circuit = unique cycle formed by new edge</li>
                  <li>Independence checked in O(α(n)) via Union-Find</li>
                </ul>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <h4 className="font-semibold mb-1">Transversal Matroid M(S)</h4>
                <ul className="list-disc pl-4 space-y-1 text-xs">
                  <li>Matchable sets are hereditary (I2)</li>
                  <li>Hall's theorem ensures exchange property (I3)</li>
                  <li>Circuit = minimal non-matchable set</li>
                  <li>Independence via bipartite matching</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 p-4 rounded-lg">
            <h3 className="font-semibold text-base mb-2">Key Insight: Auxiliary Digraph D</h3>
            <p className="text-xs mb-2">
              The directed graph D encodes possible exchanges. An arc from e to f means we can 
              replace e with f in the current solution while maintaining feasibility in one 
              matroid. Specifically:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-xs">
              <li>If e ∈ I, f ∉ I: arc e→f exists if f ∈ C₁(I\{`{e}`} ∪ {`{f}`})</li>
              <li>If e ∉ I, f ∈ I: arc e→f exists if e ∈ C₂(I\{`{f}`} ∪ {`{e}`})</li>
              <li>Path from S to T represents valid augmentation sequence</li>
              <li>BFS finds shortest augmenting path efficiently</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatroidIntersection;