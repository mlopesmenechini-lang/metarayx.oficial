const fs = require('fs');

const fixFile = (filepath) => {
  let content = fs.readFileSync(filepath, 'utf8');

  const replacements = {
    'Ã´': 'ô',
    'Ã‡': 'Ç',
    'Ãƒ': 'Ã',
    'Ã•': 'Õ',
    'AÃ‡Ã•ES': 'AÇÕES',
    'COMPETIÃ‡ÃƒO': 'COMPETIÇÃO',
    'APROVAÃ‡ÃƒO': 'APROVAÇÃO',
    'BÃ´nus': 'Bônus',
    'Ã\x87': 'Ç',
    'Ã\x83': 'Ã',
    'Ã\x95': 'Õ',
    'PÃºblico': 'Público'
  };

  for (let [bad, good] of Object.entries(replacements)) {
    content = content.split(bad).join(good);
  }

  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`Fixes applied to ${filepath}.`);
};

fixFile('App.tsx');
fixFile('types.ts');
