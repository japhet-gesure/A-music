const fs = require('fs');
let content = fs.readFileSync('src/components/Settings.tsx', 'utf8');

// 1. RESPONSIVE BREAKPOINT CAP
content = content.replace(
  'className="max-w-4xl mx-auto space-y-12 pb-24"',
  'className="w-full max-w-md mx-auto md:max-w-4xl md:w-full space-y-12 pb-24"'
);

// 2. BREAK TEXT BLOWOUT ON MOBILE
// Internal description wrapper text nodes use `flex-1 min-w-0`
content = content.replace(/className="flex flex-col min-w-0"/g, 'className="flex flex-col flex-1 min-w-0"');

// Fix the one that just had "flex flex-col"
content = content.replace(/<div className="flex flex-col">\s*<span className="text-sm font-semibold text-white\/95">/g, '<div className="flex flex-col flex-1 min-w-0">\n                    <span className="text-sm font-semibold text-white/95">');

// Paragraphs use `text-xs text-neutral-400 break-words whitespace-normal`
content = content.replace(/className="text-xs text-white\/30 truncate"/g, 'className="text-xs text-neutral-400 break-words whitespace-normal"');
content = content.replace(/className="text-xs text-white\/30 leading-relaxed max-w-sm sm:max-w-xl"/g, 'className="text-xs text-neutral-400 break-words whitespace-normal"');
content = content.replace(/className="text-xs text-white\/40 truncate"/g, 'className="text-xs text-neutral-400 break-words whitespace-normal"');

// 3. FLUID LINE ROWS
// Verify all item rows utilize `flex justify-between items-center w-full gap-4`
content = content.replace(/className="flex justify-between items-center py-4/g, 'className="flex justify-between items-center w-full gap-4 py-4');
content = content.replace(/className="flex justify-between items-center py-2/g, 'className="flex justify-between items-center w-full gap-4 py-2');

fs.writeFileSync('src/components/Settings.tsx', content, 'utf8');
console.log('Done!');
