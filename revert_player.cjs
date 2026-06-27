const fs = require('fs');
let content = fs.readFileSync('src/components/player/MusicPlayer.tsx', 'utf8');

const targetClasses = " md:flex md:opacity-100 md:pointer-events-auto md:fixed md:bottom-0 md:left-0 md:right-0 md:h-24 md:z-40 md:bg-[#0a0a0a] md:border-t md:border-neutral-950";

content = content.split(targetClasses).join('');

fs.writeFileSync('src/components/player/MusicPlayer.tsx', content, 'utf8');
console.log('Reverted MusicPlayer');
