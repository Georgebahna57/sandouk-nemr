import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Load compiled TS via tsx alternative: inline minimal test by importing built module
// Run after: npx tsx scripts/test-pdf-import.mjs

const pdfPath = process.argv[2] ?? '/home/ubuntu/.cursor/projects/workspace/uploads/___________14-09-2026_1392.pdf';

async function main() {
  const { parseTrialBalancePdfText } = await import('../src/lib/trialBalancePdfImport.ts');
  let text;
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(readFileSync(pdfPath));
    const pdf = await getDocument({ data }).promise;
    const parts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map(item => item.str).join(' '));
    }
    text = parts.join('\n');
  } catch {
    text = readFileSync(pdfPath, 'utf8');
  }

  console.log('TEXT SAMPLE:\n', text.slice(0, 2500));
  const accounts = parseTrialBalancePdfText(text);
  console.log(`Parsed ${accounts.length} accounts`);
  const multi = accounts.filter(a => Object.keys(a.currencies).length > 1);
  console.log(`Multi-currency accounts: ${multi.length}`);
  console.log('Sample multi:', multi.slice(0, 3).map(a => ({
    code: a.code,
    name: a.name,
    currencies: Object.keys(a.currencies),
  })));
  console.log('First 5:', accounts.slice(0, 5));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
