const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

const replacements = {
  'Ã¡': 'á',
  'Ã£': 'ã',
  'Ã§': 'ç',
  'Ãµ': 'õ',
  'Ã©': 'é',
  'Ãª': 'ê',
  'Ã³': 'ó',
  'Ã­': 'í',
  'TÃ-tulo': 'Título',
  'Âº': 'º',
  'Ãº': 'ú',
  'Ã¢': 'â',
  'Ã\x8D': 'Í',
  'Ã\x87': 'Ç',
  'Ã\x95': 'Õ',
  'Ã\x81': 'Á',
  'Ã\x89': 'É',
  'Ã\x93': 'Ó',
  'Ã\x8A': 'Ê',
  'Ã\x9A': 'Ú',
  'Ã\x83': 'Ã',
  'ANÃLISE': 'ANÁLISE',
  'CONCLUÃDO': 'CONCLUÍDO',
  'UsuÃ¡rio': 'Usuário',
  'Ã€': 'À',
  'AÃ§Ãµes': 'Ações',
  'USUÃ¡RIOS': 'USUÁRIOS',
  'USUÃ¡RIO': 'USUÁRIO',
  'NÃ£o': 'Não'
};

for (const [bad, good] of Object.entries(replacements)) {
  content = content.split(bad).join(good);
}

fs.writeFileSync('App.tsx', content, 'utf8');
console.log('Fixes applied.');
