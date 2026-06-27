const fs = require('fs');
let content = fs.readFileSync('src/components/layout/Shell.tsx', 'utf8');

const targetStr = '<footer className="fixed bottom-16 left-0 right-0 h-0 bg-transparent border-none z-50 md:flex md:opacity-100 md:pointer-events-auto md:fixed md:bottom-0 md:left-0 md:right-0 md:h-24 md:z-40 md:bg-[#0a0a0a] md:border-t md:border-neutral-950">';
const replacementStr = '<footer className="fixed bottom-16 left-0 right-0 h-0 bg-transparent border-none z-50 md:flex md:opacity-100 md:pointer-events-auto md:fixed md:bottom-0 md:left-0 md:right-0 md:h-24 md:z-[105] md:bg-[#0a0a0a] md:border-t md:border-neutral-950">';

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync('src/components/layout/Shell.tsx', content, 'utf8');
  console.log('Fixed Shell footer');
} else {
  console.log('Shell footer not found. It might be different.');
}
