const fs = require('fs');
const path = require('path');

const replacements = [
  // Mojibake UTF-8
  { from: /Ã¡/g, to: 'á' },
  { from: /Ã£/g, to: 'ã' },
  { from: /Ã§/g, to: 'ç' },
  { from: /Ãµ/g, to: 'õ' },
  { from: /Ã©/g, to: 'é' },
  { from: /Ãª/g, to: 'ê' },
  { from: /Ã³/g, to: 'ó' },
  { from: /Ã­/g, to: 'í' },
  { from: /Ã­/g, to: 'í' }, // Repeating for safety with different dash chars
  { from: /Ãº/g, to: 'ú' },
  { from: /Ã¢/g, to: 'â' },
  { from: /Ã€/g, to: 'À' },
  { from: /â€“/g, to: '—' },
  { from: /â€”/g, to: '—' },
  { from: /Ã¢â‚¬â€/g, to: '—' },
  
  // Uppercase Mojibake
  { from: /Ã\x81/g, to: 'Á' },
  { from: /Ã\x89/g, to: 'É' },
  { from: /Ã\x8D/g, to: 'Í' },
  { from: /Ã\x93/g, to: 'Ó' },
  { from: /Ã\x9A/g, to: 'Ú' },
  { from: /Ã\x87/g, to: 'Ç' },
  { from: /Ã\x95/g, to: 'Õ' },
  { from: /Âº/g, to: 'º' },

  // Specific corrupted strings found in App.tsx
  { from: /USUá  RIO/g, to: 'USUÁRIO' },
  { from: /USUá RIO/g, to: 'USUÁRIO' },
  { from: /á¢Ã…â€œÃ‚Â¨/g, to: '✅' },
  { from: /Ã¢Å“â€¦/g, to: '✅' },
  { from: /á¢Ã…â€œÃ¢â‚¬Â¦/g, to: '✅' },
  { from: /á¢Ã‚Â Ã…â€™/g, to: '⚠️' },
  { from: /á¢ Ã…â€™/g, to: '❌' },
  { from: /á¢Ã…â€œÃ¢â‚¬Â¦/g, to: '✅' },
  { from: /á¢Ã…â€œÃ‚Â¨/g, to: '✅' },
  { from: /á¢Ã…â€œÃ‚Â¨/g, to: '✅' },
  
  // Double-corrupted patterns
  { from: /ÃƒÆ’Ã‚Â¡/g, to: 'á' },
  { from: /ÃƒÆ’Ã‚Â£/g, to: 'ã' },
  { from: /ÃƒÆ’Ã‚Â§/g, to: 'ç' },
  { from: /ÃƒÆ’Ã‚Â©/g, to: 'é' },
  { from: /ÃƒÆ’Ã‚Â³/g, to: 'ó' },
  { from: /ÃƒÆ’Ã‚Â­/g, to: 'í' },
  { from: /ÃƒÆ’Ã‚Âº/g, to: 'ú' },
  { from: /ÃƒÆ’Ã‚Âª/g, to: 'ê' },

  // Triple-corrupted patterns found in App.tsx (sanitizeString)
  { from: /ÃƒÆ’Ã¢â‚¬Å¡º/g, to: 'º' },
  { from: /ÃƒÆ’\x81/g, to: 'Á' },
  { from: /ÃƒÆ’\x89/g, to: 'É' },
  { from: /ÃƒÆ’\x8D/g, to: 'Í' },
  { from: /ÃƒÆ’\x93/g, to: 'Ó' },
  { from: /ÃƒÆ’\x87/g, to: 'Ç' },
  { from: /ÃƒÆ’\x95/g, to: 'Õ' },

  // Spacing issues
  { from: /USUá  RIO/g, to: 'USUÁRIO' },
  { from: /USUÃ¡RIO/g, to: 'USUÁRIO' },
  { from: /USUÃ¡rios/g, to: 'usuários' },
  { from: /configuraÃ§Ã£o/g, to: 'configuração' },
  { from: /ConfiguraÃ§Ã£o/g, to: 'Configuração' },
  { from: /sincronizaÃ§Ã£o/g, to: 'sincronização' },
  { from: /SincronizaÃ§Ã£o/g, to: 'Sincronização' },
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
  { from: /ÃƒÆ’Ã‚Â¡/g, to: 'á' },
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

async function fixFiles() {
  for (const file of filesToFix) {
    if (typeof file !== 'string') continue; // Skip objects used for internal logic
    const absolutePath = path.join('d:/METARAYX', file);
    if (!fs.existsSync(absolutePath)) {
      console.log(`File not found: ${file}`);
      continue;
    }

    let content = fs.readFileSync(absolutePath, 'utf-8');
    let originalContent = content;

    for (const rep of replacements) {
      content = content.replace(rep.from, rep.to);
    }

    if (content !== originalContent) {
      fs.writeFileSync(absolutePath, content, 'utf-8');
      console.log(`Fixed: ${file}`);
    } else {
      console.log(`No changes needed: ${file}`);
    }
  }
}

fixFiles().then(() => console.log('Done!')).catch(console.error);
