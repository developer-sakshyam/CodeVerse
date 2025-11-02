// server/generate_problems.js
import fs from 'fs';
import path from 'path';

/*
Generates a JSON array of problems (clean JS strings inside backticks).
Run: node server/generate_problems.js
*/

const outPath = path.join(process.cwd(), 'server', 'problems.json');

// A set of templates. Each template returns an object given id number.
const templates = [
  function maxTemplate(i) {
    const id = `p${i}`;
    const fn = `findMax_${i}`;
    return {
      id,
      title: 'Find Maximum',
      statement: `Write a function ${fn}(arr) that returns the maximum number in the array.`,
      functionName: fn,
      starterCode: `function ${fn}(arr) {\n  // TODO: return maximum number\n}\n\nmodule.exports = { ${fn} };`,
      tests: [
        { input: [[1,5,3]], output: 5 },
        { input: [[-1,-5,-3]], output: -1 },
        { input: [[10]], output: 10 },
        { input: [[2,2,2]], output: 2 }
      ]
    };
  },

  function sumTemplate(i) {
    const id = `p${i}`;
    const fn = `sum_${i}`;
    return {
      id,
      title: 'Sum of Array',
      statement: `Write a function ${fn}(a) that returns the sum of all numbers in the array.`,
      functionName: fn,
      starterCode: `function ${fn}(a) {\n  // TODO: return sum of numbers\n}\n\nmodule.exports = { ${fn} };`,
      tests: [
        { input: [[1,2,3]], output: 6 },
        { input: [[-1,5,0]], output: 4 },
        { input: [[100]], output: 100 },
        { input: [[1,1,1,1,1]], output: 5 }
      ]
    };
  },

  function reverseTemplate(i) {
    const id = `p${i}`;
    const fn = `reverseString_${i}`;
    return {
      id,
      title: 'Reverse String',
      statement: `Write a function ${fn}(s) that returns the reversed string.`,
      functionName: fn,
      starterCode: `function ${fn}(s) {\n  // TODO: return reversed string\n}\n\nmodule.exports = { ${fn} };`,
      tests: [
        { input: ['abc'], output: 'cba' },
        { input: ['racecar'], output: 'racecar' },
        { input: [''], output: '' },
        { input: ['hello'], output: 'olleh' }
      ]
    };
  },

  function palindromeTemplate(i) {
    const id = `p${i}`;
    const fn = `isPalindrome_${i}`;
    return {
      id,
      title: 'Check Palindrome',
      statement: `Write a function ${fn}(s) that returns true if s is a palindrome.`,
      functionName: fn,
      starterCode: `function ${fn}(s) {\n  // TODO: check palindrome\n}\n\nmodule.exports = { ${fn} };`,
      tests: [
        { input: ['madam'], output: true },
        { input: ['hello'], output: false },
        { input: ['racecar'], output: true },
        { input: ['a'], output: true }
      ]
    };
  },

  function sumDigitsTemplate(i) {
    const id = `p${i}`;
    const fn = `sumDigits_${i}`;
    return {
      id,
      title: 'Sum of Digits',
      statement: `Write a function ${fn}(n) that returns the sum of digits of n.`,
      functionName: fn,
      starterCode: `function ${fn}(n) {\n  // TODO: sum digits\n}\n\nmodule.exports = { ${fn} };`,
      tests: [
        { input: [123], output: 6 },
        { input: [0], output: 0 },
        { input: [999], output: 27 },
        { input: [456], output: 15 }
      ]
    };
  },

  // add more templates here to increase variety...
];

// helper to pick random template
function pickTemplate(i) {
  const t = templates[i % templates.length];
  return t(i);
}

function generateProblems(count = 100, startIndex = 1) {
  const problems = [];
  for (let i = startIndex; i < startIndex + count; i++) {
    const p = pickTemplate(i);
    problems.push(p);
  }
  return problems;
}

// Write file
const COUNT = 1000; // change to 200 if you want
const problems = generateProblems(COUNT, 1);

fs.writeFileSync(outPath, JSON.stringify(problems, null, 2), 'utf8');
console.log(`Generated ${problems.length} problems -> ${outPath}`);
