export const EDITOR_ID = 'cfr-editor-container';

// onlinecompiler.io compiler IDs: https://onlinecompiler.io/docs#compilers
export const LANGUAGES = {
  cpp: {
    label: 'C++17', compiler: 'g++-15', monaco: 'cpp', cfId: '54',
    template: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n'
  },
  python: {
    label: 'Python3', compiler: 'python-3.14', monaco: 'python', cfId: '31',
    template: '# write your code here\n'
  },
  java: {
    label: 'Java', compiler: 'openjdk-25', monaco: 'java', cfId: '60',
    template: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        \n    }\n}\n'
  },
};
