export const KNOWLEDGE_BASE = {
    'programming_js': {
        title: 'JavaScript Basics',
        content: `
# JavaScript Basics
JavaScript is a versatile language used for web development.
Key Concepts:
- Variables (let, const, var)
- Functions (Arrow functions, declarations)
- Asynchronous Programming (Promises, async/await)
- DOM Manipulation
        `,
        quizzes: [
            {
                question: "What is the difference between let and const?",
                options: ["const is immutable", "let is global", "const is faster"],
                answer: 0
            },
            {
                question: "Which symbol is used for arrow functions?",
                options: ["->", "=>", "-->"],
                answer: 1
            }
        ]
    },
    'history_world': {
        title: 'World History - WWII',
        content: `
# World War II
A global conflict involved two opposing military alliances: the Allies and the Axis.
Key dates: 1939 - 1945.
        `,
        quizzes: [
            {
                question: "When did WWII end?",
                options: ["1944", "1945", "1950"],
                answer: 1
            }
        ]
    }
};

export const MOOD_LOGS = []; // Simple in-memory storage for Aurora
