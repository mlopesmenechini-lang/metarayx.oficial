const fs = require('fs');
const path = require('path');

const replacements = [
  // Triple-corrupted patterns
  { from: /ÃƒÂ¡/g, to: 'á' },
  { from: /ÃƒÂ©/g, to: 'é' },
  { from: /ÃƒÂ³/g, to: 'ó' },
  { from: /ÃƒÂº/g, to: 'ú' },
  { from: /ÃƒÂ§/g, to: 'ç' },
  { from: /ÃƒÂ£/g, to: 'ã' },
  { from: /ÃƒÂµ/g, to: 'õ' },
  { from: /ÃƒÂª/g, to: 'ê' },
  { from: /ÃƒÂ´/g, to: 'ô' },
  
  // Double-corrupted patterns
  { from: /Ã­/g, to: 'í' },
  { from: /Ã¡/g, to: 'á' },
  { from: /Ã©/g, to: 'é' },
  { from: /Ã³/g, to: 'ó' },
  { from: /Ãº/g, to: 'ú' },
  { from: /Ã§/g, to: 'ç' },
  { from: /Ã£/g, to: 'ã' },
  { from: /Ãµ/g, to: 'õ' },
  { from: /Ãª/g, to: 'ê' },
  { from: /Ã´/g, to: 'ô' },
  { from: /Ã¢/g, to: 'â' },
  { from: /Ã€/g, to: 'À' },

  // Uppercase
  { from: /Ã\x8D/g, to: 'Í' },
  { from: /Ã\x81/g, to: 'Á' },
  { from: /Ã\x89/g, to: 'É' },
  { from: /Ã\x93/g, to: 'Ó' },
  { from: /Ã\x9A/g, to: 'Ú' },
  { from: /Ã\x87/g, to: 'Ç' },
  { from: /Ã\x95/g, to: 'Õ' },

  // Symbols & Punctuation
  { from: /Ã¢â‚¬â€/g, to: '—' },
  { from: /Ã¢â‚¬Â /g, to: '”' },
  { from: /Ã¢â‚¬Å“/g, to: '“' },
  { from: /Âº/g, to: 'º' },
  { from: /Âª/g, to: 'ª' },

  // Emojis/Icons corruption patterns
  { from: /Ã¢Å“â€¦/g, to: '✅' },
  { from: /á¢Ã…â€œÃ‚Â¨/g, to: '✅' },
  { from: /á¢Ã…â€œÃ¢â‚¬Â¦/g, to: '✅' },
  { from: /á¢Ã‚Â Ã…â€™/g, to: '⚠️' },
  { from: /á¢ Ã…â€™/g, to: '❌' },
  
  // Specific words
  { from: /USUá RIO/g, to: 'USUÁRIO' },
  { from: /USUá  RIO/g, to: 'USUÁRIO' },
];

const filesToFix = [
  'App.tsx',
  'components/Admin/AdminPanel.tsx',
  'components/Admin/AdminUI.tsx',
  'components/Admin/CompetitionsTab.tsx',
  'components/Admin/DiagnosticoTab.tsx',
  'components/Admin/FinanceiroTab.tsx',
  'components/Admin/MiscAdminTabs.tsx',
  'components/Admin/RelatoriosTab.tsx',
  'components/Admin/RemovidosTab.tsx',
  'components/Admin/RessincronizacaoTab.tsx',
  'components/Admin/SincronizacaoTab.tsx',
  'components/Admin/TriagemTab.tsx',
  'components/Admin/UsersTab.tsx',
  'components/Dashboard.tsx',
  'components/SettingsView.tsx',
  'components/HistoryView.tsx',
  'components/Shared.tsx',
  'components/SuggestionsView.tsx',
  'components/WalletView.tsx',
  'components/CompetitionViews.tsx',
  'services/apifyService.ts',
  'types.ts'
];

async function cleanFiles() {
  for (const file of filesToFix) {
    const absolutePath = path.join('d:/METARAYX', file);
    if (!fs.existsSync(absolutePath)) continue;

    let content = fs.readFileSync(absolutePath, 'utf-8');
    let original = content;

    for (const rep of replacements) {
      content = content.replace(rep.from, rep.to);
    }

    if (content !== original) {
      fs.writeFileSync(absolutePath, content, 'utf-8');
      console.log(`Cleaned: ${file}`);
    } else {
      console.log(`No residues found: ${file}`);
    }
  }
}

cleanFiles().then(() => console.log('Cleanup Done!')).catch(console.error);
