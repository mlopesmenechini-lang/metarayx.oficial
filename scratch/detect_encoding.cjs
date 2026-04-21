const fs = require('fs');

function detectEncoding(filePath) {
    const buffer = fs.readFileSync(filePath);
    
    // Check for UTF-8 BOM
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return 'utf-8-bom';
    }
    
    // Check for UTF-16 BOM
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) return 'utf-16le';
    if (buffer[0] === 0xFE && buffer[1] === 0xFF) return 'utf-16be';

    // Simple heuristic for UTF-8
    let isUtf8 = true;
    try {
        const text = buffer.toString('utf-8');
        if (text.includes('')) isUtf8 = false;
    } catch (e) {
        isUtf8 = false;
    }

    return isUtf8 ? 'utf-8' : 'likely-windows-1252';
}

console.log(detectEncoding('d:/METARAYX/App.tsx'));
