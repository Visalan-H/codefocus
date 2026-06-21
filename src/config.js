export const EDITOR_ID = 'cfr-editor-container';

export const LANGUAGES = {
  cpp: {
    label:    'C++17',
    compiler: 'g++-15',
    monaco:   'cpp',
    cfId:     '54',
    template: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
  },
  java: {
    label:    'Java',
    compiler: 'openjdk-25',
    monaco:   'java',
    cfId:     '60',
    template: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        \n    }\n}\n',
  },
  python: {
    label:    'Python3',
    compiler: 'python-3.14',
    monaco:   'python',
    cfId:     '31',
    template: '',
  },
};

export const STORAGE_KEYS = {
  ENABLED:   'cfr_enabled',
  LANG:      'cfr_lang',
  SUBMIT:    'cfr_submit',
  SPLIT_W:   'cfr_split_w',   // left panel width as a percentage (number)
  CONSOLE_H: 'cfr_console_h', // console panel height in px (number)
};
