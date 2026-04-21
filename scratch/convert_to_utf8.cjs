const fs = require('fs');
const path = require('path');

const filesToConvert = [
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

async function convertFiles() {
  for (const file of filesToConvert) {
    const absolutePath = path.join('d:/METARAYX', file);
    if (!fs.existsSync(absolutePath)) continue;

    // Read as latin1 (Windows-1252 is very close to latin1 for Portuguese chars)
    const buffer = fs.readFileSync(absolutePath);
    
    // Heuristic: if it already looks like it has UTF-8 sequences, we might have mixed encoding.
    // But we know from detection it is likely-windows-1252.
    
    const content = buffer.toString('latin1');
    
    // Save as UTF-8
    fs.writeFileSync(absolutePath, content, 'utf-8');
    console.log(`Converted: ${file}`);
  }
}

convertFiles().then(() => console.log('Conversion Done!')).catch(console.error);
